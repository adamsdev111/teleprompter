import express from 'express';
const app = express();
const PORT = process.env.PORT || 3848;

// Basic Auth middleware
const AUTH_USER = process.env.AUTH_USER || 'Arvis';
const AUTH_PASS = process.env.AUTH_PASS || 'Arvis777';

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Arvis Teleprompter"');
    return res.status(401).send('Authentication required');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === AUTH_USER && pass === AUTH_PASS) {
    return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Arvis Teleprompter"');
  return res.status(401).send('Invalid credentials');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const presentations = new Map();

// Parse slide content - detecta título y bullets
function parseSlide(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return { title: '', bullets: [] };
  
  // Primera línea (o líneas hasta el primer bullet) es el título
  let titleLines = [];
  let bulletLines = [];
  let inBullets = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Detectar si empieza con número y punto, o con bullet
    if (/^[\d]+\./.test(trimmed) && !inBullets) {
      titleLines.push(trimmed);
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      inBullets = true;
      bulletLines.push(trimmed.replace(/^[•\-\*]\s*/, ''));
    } else if (inBullets) {
      bulletLines.push(trimmed);
    } else {
      titleLines.push(trimmed);
    }
  }
  
  return {
    title: titleLines.join(' '),
    bullets: bulletLines
  };
}

// Home page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Arvis Teleprompter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle { color: #888; margin-bottom: 30px; font-size: 1.1rem; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #aaa; font-weight: 500; }
    textarea {
      width: 100%; height: 300px; padding: 15px;
      border: 2px solid rgba(255,255,255,0.1); border-radius: 12px;
      background: rgba(255,255,255,0.05); color: #fff;
      font-size: 16px; line-height: 1.6; resize: vertical;
    }
    textarea:focus { outline: none; border-color: #667eea; }
    .options { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
    .option { flex: 1; min-width: 150px; }
    select, input[type="text"] {
      width: 100%; padding: 12px;
      border: 2px solid rgba(255,255,255,0.1); border-radius: 8px;
      background: rgba(255,255,255,0.05); color: #fff; font-size: 14px;
    }
    select option { background: #1a1a2e; }
    .btn {
      width: 100%; padding: 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none; border-radius: 12px; color: white;
      font-size: 18px; font-weight: 600; cursor: pointer;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3); }
    .tips { margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 12px; }
    .tips h3 { color: #667eea; margin-bottom: 10px; }
    .tips ul { color: #888; padding-left: 20px; }
    .tips li { margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://rackslabs.com/wp-content/uploads/2023/03/Logo-principal-Blanco-sin-fondo.svg" alt="Racks Labs" style="height: 40px;">
    </div>
    <h1>Teleprompter</h1>
    <p class="subtitle">Pega tu script y genera slides estilo Canva</p>
    <form action="/create" method="POST">
      <div class="form-group">
        <label>Tu script (separa slides con ⸻ o ---):</label>
        <textarea name="script" placeholder="1. No te falta dinero. Te falta permiso para desobedecer.
No estás bloqueado por falta de oportunidades. Estás bloqueado porque todo lo que haces necesita ser explicable.
⸻
2. El sistema no quiere que ganes más, quiere que no te salgas.
Ganar un poco más está permitido. Cambiar de nivel no."></textarea>
      </div>
      <div class="options">
        <div class="option">
          <label>Header (texto superior):</label>
          <input type="text" name="header" value="No eres pobre, estás domesticado." placeholder="Texto del header negro">
        </div>
      </div>
      <button type="submit" class="btn">Crear Presentación</button>
    </form>
    <div class="tips">
      <h3>Tips</h3>
      <ul>
        <li>Usa <b>⸻</b> o <b>---</b> para separar slides</li>
        <li>Primera línea de cada slide = título grande</li>
        <li>Resto = bullets</li>
        <li>Flechas o tap para navegar</li>
      </ul>
    </div>
  </div>
</body>
</html>`);
});

// Create presentation
app.post('/create', (req, res) => {
  const { script, header } = req.body;
  if (!script || !script.trim()) return res.redirect('/');
  
  // Split por separadores ⸻ o ---
  // El ⸻ puede estar en cualquier lugar, incluso en medio de una línea
  const slides = script
    .split(/\s*⸻\s*|\s*—\s*—\s*|\n\s*-{2,}\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);
  
  if (slides.length === 0) return res.redirect('/');
  
  const id = Math.random().toString(36).substring(2, 10);
  presentations.set(id, { 
    slides, 
    header: header || 'No eres pobre, estás domesticado.',
    created: Date.now() 
  });
  
  // Cleanup old
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, val] of presentations) {
    if (val.created < dayAgo) presentations.delete(key);
  }
  
  res.redirect('/p/' + id);
});

// View presentation - ESTILO CANVA
app.get('/p/:id', (req, res) => {
  const pres = presentations.get(req.params.id);
  if (!pres) return res.status(404).send('Presentación no encontrada o expirada');
  
  const { slides, header } = pres;
  
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Teleprompter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%; 
      overflow: hidden; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      user-select: none; 
      -webkit-user-select: none;
      background: #fff;
    }
    
    .slide {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #fff;
    }
    
    .header {
      background: #000;
      color: #fff;
      padding: 2.5vh 5vw;
      font-size: clamp(1.2rem, 3vw, 2rem);
      font-weight: 600;
      text-align: center;
      flex-shrink: 0;
    }
    
    .content {
      flex: 1;
      padding: 4vh 6vw;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
    }
    
    .title {
      font-size: clamp(1.8rem, 5vw, 3.5rem);
      font-weight: 700;
      color: #000;
      margin-bottom: 3vh;
      line-height: 1.2;
    }
    
    .bullets {
      list-style: disc;
      padding-left: 1.5em;
      font-size: clamp(1.2rem, 3vw, 2rem);
      color: #000;
      line-height: 1.6;
    }
    
    .bullets li {
      margin-bottom: 1.5vh;
    }
    
    .plain-text {
      font-size: clamp(1.2rem, 3vw, 2rem);
      color: #000;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    
    /* Navigation controls */
    .nav {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 15px;
      z-index: 100;
      opacity: 0.3;
      transition: opacity 0.3s;
    }
    .nav:hover { opacity: 1; }
    
    .nav-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 2px solid #333;
      background: #fff;
      color: #333;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .nav-btn:hover { background: #333; color: #fff; }
    .nav-btn:active { transform: scale(0.95); }
    
    .counter {
      position: fixed;
      bottom: 25px;
      right: 25px;
      font-size: 1rem;
      color: #999;
      z-index: 100;
    }
    
    /* Touch areas invisibles */
    .touch-left, .touch-right {
      position: fixed;
      top: 0;
      bottom: 80px;
      width: 30%;
      z-index: 50;
      cursor: pointer;
    }
    .touch-left { left: 0; }
    .touch-right { right: 0; }
    
    /* Portrait warning */
    @media screen and (orientation: portrait) and (max-width: 768px) {
      .rotate-hint {
        display: flex !important;
      }
    }
    .rotate-hint {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.9);
      color: #fff;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      font-size: 1.5rem;
      z-index: 9999;
    }
    .rotate-hint span { font-size: 4rem; margin-bottom: 20px; }
    .rotate-hint .close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid #fff;
      background: transparent;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rotate-hint .close-btn:hover { background: rgba(255,255,255,0.2); }
    .rotate-hint .skip-btn {
      margin-top: 30px;
      padding: 12px 30px;
      border: 2px solid #fff;
      background: transparent;
      color: #fff;
      font-size: 1rem;
      border-radius: 8px;
      cursor: pointer;
    }
    .rotate-hint .skip-btn:hover { background: rgba(255,255,255,0.2); }
    .rotate-hint.hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="rotate-hint" id="rotateHint">
    <button class="close-btn" id="closeRotate">✕</button>
    <span>📱</span>
    Gira el dispositivo
    <button class="skip-btn" id="skipRotate">Continuar así</button>
  </div>
  
  <div class="slide" id="slide">
    <div class="header" id="header">${header}</div>
    <div class="content" id="content"></div>
  </div>
  
  <div class="touch-left" id="touchLeft"></div>
  <div class="touch-right" id="touchRight"></div>
  
  <div class="nav">
    <button class="nav-btn" id="btnPrev">◀</button>
    <button class="nav-btn" id="btnNext">▶</button>
    <button class="nav-btn" id="btnFS">⛶</button>
  </div>
  
  <div class="counter" id="counter"></div>

  <script>
    const slides = ${JSON.stringify(slides)};
    let current = 0;
    
    function parseSlide(text) {
      const trimmed = text.trim();
      if (!trimmed) return { title: '', body: [] };
      
      // Dividir por frases (punto, exclamación, interrogación seguido de espacio)
      const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];
      
      if (sentences.length <= 2) {
        // Pocas frases: todo es título
        return { title: trimmed, body: [] };
      }
      
      // Título: primeras 2 frases (ej: "1. No te falta dinero." + "Te falta permiso para desobedecer.")
      const title = sentences.slice(0, 2).join(' ').trim();
      
      // Body: resto de frases como bullets
      const body = sentences.slice(2).map(s => s.trim()).filter(Boolean);
      
      return { title, body };
    }
    
    function show(i) {
      if (i < 0) i = 0;
      if (i >= slides.length) i = slides.length - 1;
      current = i;
      
      const { title, body } = parseSlide(slides[current]);
      const content = document.getElementById('content');
      
      let html = '';
      if (title) {
        html += '<div class="title">' + escapeHtml(title) + '</div>';
      }
      
      if (body.length > 0) {
        html += '<ul class="bullets">';
        body.forEach(line => {
          html += '<li>' + escapeHtml(line) + '</li>';
        });
        html += '</ul>';
      }
      
      content.innerHTML = html || '<div class="plain-text">' + escapeHtml(slides[current]) + '</div>';
      document.getElementById('counter').textContent = (current + 1) + ' / ' + slides.length;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function next() { show(current + 1); }
    function prev() { show(current - 1); }
    
    function toggleFS() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(()=>{});
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(()=>{});
        }
      } else {
        document.exitFullscreen();
      }
    }
    
    // Button handlers
    document.getElementById('btnPrev').addEventListener('click', function(e) { e.stopPropagation(); prev(); });
    document.getElementById('btnNext').addEventListener('click', function(e) { e.stopPropagation(); next(); });
    document.getElementById('btnFS').addEventListener('click', function(e) { e.stopPropagation(); toggleFS(); });
    
    // Touch areas
    document.getElementById('touchLeft').addEventListener('click', prev);
    document.getElementById('touchRight').addEventListener('click', next);
    
    // Keyboard (incluye PageUp/PageDown para mandos presenter)
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { 
        e.preventDefault(); 
        next(); 
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { 
        e.preventDefault(); 
        prev(); 
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFS();
      } else if (e.key === 'r' || e.key === 'R') {
        show(0);
      }
    });
    
    // Swipe
    let touchStartX = 0;
    document.addEventListener('touchstart', function(e) { 
      touchStartX = e.touches[0].clientX; 
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) { 
        if (diff > 0) next(); 
        else prev(); 
      }
    }, { passive: true });
    
    // Close rotate hint
    function hideRotateHint() {
      document.getElementById('rotateHint').classList.add('hidden');
    }
    document.getElementById('closeRotate').addEventListener('click', hideRotateHint);
    document.getElementById('skipRotate').addEventListener('click', hideRotateHint);
    
    // Init
    show(0);
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Teleprompter running at http://localhost:' + PORT);
});
