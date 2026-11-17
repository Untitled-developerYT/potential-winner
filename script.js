const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sh = a => [...a].sort(() => Math.random() - .5);
let all = [], pool = [], view = 'flash', i = 0, qz = {};
let P = {}; try { P = JSON.parse(localStorage.revProgress || '{}'); } catch (e) {}
const save = () => { try { localStorage.revProgress = JSON.stringify(P); } catch (e) {} };
const mark = (c, ok) => { P[c.id] = ok ? 1 : 0; save(); };

// ---- CSV parser (handles quotes, commas, newlines) ----
function parseCSV(t) {
  const out = []; let row = [], f = '', q = false;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (q) { if (c == '"') { if (t[k+1] == '"') { f += '"'; k++; } else q = false; } else f += c; }
    else if (c == '"') q = true;
    else if (c == ',') { row.push(f); f = ''; }
    else if (c == '\n' || c == '\r') { if (c == '\r' && t[k+1] == '\n') k++; row.push(f); f = ''; if (row.length > 1) out.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  const h = out.shift().map(x => x.trim());
  return out.map((r, n) => ({ id: n, ...Object.fromEntries(h.map((k, j) => [k, (r[j] || '').trim()])) }));
}

// ---- Setup ----
fetch('dataset.csv').then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => {
  all = parseCSV(t);
  const topics = [...new Set(all.map(c => c.topic))];
  $('#topic').innerHTML = '<option value="">All topics</option>' + topics.map(t => `<option>${esc(t)}</option>`).join('');
  setPool();
}).catch(() => app.innerHTML = '<div class="panel">Could not load <code>dataset.csv</code>. Make sure it sits next to index.html and that you are running via a web server (GitHub Pages or <code>python -m http.server</code>), not by double-clicking the file.</div>');

function setPool() {
  const t = $('#topic').value;
  pool = all.filter(c => !t || c.topic == t); i = 0; startQuiz(); mt = {}; render();
}
$('#topic').onchange = setPool;
$('#nav').onclick = e => {
  if (!e.target.dataset.v) return;
  view = e.target.dataset.v;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b == e.target));
  if (view == 'quiz') startQuiz();
  render();
};
const render = () => ({ flash: vFlash, quiz: vQuiz, match: vMatch, type: vType, sheet: vSheet, stats: vStats })[view]();

// ---- Flashcards ----
function vFlash() {
  const c = pool[i]; if (!c) return app.textContent = 'No cards.';
  app.innerHTML = `<p class="meta">${i + 1}/${pool.length} · ${esc(c.topic)} ${P[c.id] === 1 ? '✅' : P[c.id] === 0 ? '🔁' : ''}</p>
  <div class="card" id="card"><div class="face"><b>${esc(c.question)}</b>${c.hint ? `<small>💡 ${esc(c.hint)}</small>` : ''}</div><div class="face back">${esc(c.answer)}</div></div>
  <p class="meta">Click card or press Space to flip · ← → to move</p>
  <div class="row"><button id="prev">←</button><button id="bad">🔁 Again</button><button id="good" class="pri">✅ Got it</button><button id="next">→</button><button id="shuf">🔀</button></div>`;
  $('#card').onclick = () => $('#card').classList.toggle('flip');
  $('#prev').onclick = () => go(-1); $('#next').onclick = () => go(1);
  $('#good').onclick = () => { mark(c, 1); go(1); }; $('#bad').onclick = () => { mark(c, 0); go(1); };
  $('#shuf').onclick = () => { pool = sh(pool); i = 0; vFlash(); };
}
const go = d => { i = (i + d + pool.length) % pool.length; vFlash(); };
document.onkeydown = e => {
  if (view != 'flash' || !pool.length || e.target.tagName == 'INPUT') return;
  if (e.key == ' ') { e.preventDefault(); $('#card').classList.toggle('flip'); }
  if (e.key == 'ArrowRight') go(1); if (e.key == 'ArrowLeft') go(-1);
};

// ---- Multiple-choice quiz ----
let qlen = 10;
function startQuiz() { qz = { list: sh(pool).slice(0, qlen), n: 0, s: 0 }; }
function vQuiz() {
  if (!qz.list.length) return app.textContent = 'No cards.';
  if (qz.n >= qz.list.length) {
    app.innerHTML = `<div class="panel"><h2>Score: ${qz.s}/${qz.list.length} 🎉</h2><button class="pri" id="again">Try again</button></div>`;
    return $('#again').onclick = () => { startQuiz(); vQuiz(); };
  }
  const c = qz.list[qz.n], uniq = f => [...new Set(all.filter(f).map(x => x.answer))];
  let d = [c.wrong1, c.wrong2, c.wrong3].filter(Boolean);
  if (d.length < 3) d = sh(uniq(x => x.topic == c.topic && x.answer != c.answer)).slice(0, 3);
  if (d.length < 3) d = sh(uniq(x => x.answer != c.answer)).slice(0, 3);
  app.innerHTML = `<p class="meta">Question ${qz.n + 1}/${qz.list.length} · Score ${qz.s} · Length <select id="ql">${[10, 20, 40, 999].map(n => `<option value="${n}" ${n == qlen ? 'selected' : ''}>${n == 999 ? 'All' : n}</option>`).join('')}</select></p>
  <div class="panel"><h2>${esc(c.question)}</h2>${sh([c.answer, ...d]).map(t => `<button class="opt">${esc(t)}</button>`).join('')}<div id="fb"></div></div>`;
  $('#ql').onchange = e => { qlen = +e.target.value; startQuiz(); vQuiz(); };
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const ok = b.textContent == c.answer;
    document.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent == c.answer) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong'); else qz.s++;
    mark(c, ok);
    $('#fb').innerHTML = '<button class="pri" id="nq">Next →</button>';
    $('#nq').onclick = () => { qz.n++; vQuiz(); };
  });
}

// ---- Write It (type answer, then self-mark) ----
function vType() {
  const c = pool[i]; if (!c) return app.textContent = 'No cards.';
  app.innerHTML = `<p class="meta">${i + 1}/${pool.length} · ${esc(c.topic)}</p>
  <div class="panel"><h2>${esc(c.question)}</h2>${c.hint ? `<small class="meta">💡 ${esc(c.hint)}</small>` : ''}
  <input id="in" placeholder="Write your answer from memory…" autocomplete="off"><button class="pri" id="chk">Check</button><div id="fb"></div></div>`;
  const reveal = () => {
    $('#fb').innerHTML = `<div class="ans">${esc(c.answer)}</div><div class="row"><button id="n">🔁 Not quite</button><button id="y" class="pri">✅ Got it</button></div>`;
    $('#y').onclick = () => { mark(c, 1); i = (i + 1) % pool.length; vType(); };
    $('#n').onclick = () => { mark(c, 0); i = (i + 1) % pool.length; vType(); };
  };
  $('#chk').onclick = reveal; $('#in').onkeydown = e => e.key == 'Enter' && reveal(); $('#in').focus();
}

// ---- Cheat sheet ----
function vSheet() {
  app.innerHTML = '<input id="q" placeholder="Search formulae…" style="width:100%"><div id="list"></div>';
  const draw = () => {
    const s = $('#q').value.toLowerCase(), rows = pool.filter(c => (c.question + c.answer).toLowerCase().includes(s));
    $('#list').innerHTML = `<table><tr><th>Question</th><th>Answer</th></tr>${rows.map(c => `<tr><td>${esc(c.question)}</td><td>${esc(c.answer)}</td></tr>`).join('')}</table>`;
  };
  $('#q').oninput = draw; draw();
}

// ---- Progress + tips ----
function vStats() {
  const topics = [...new Set(all.map(c => c.topic))];
  app.innerHTML = `<div class="panel"><h2>Your progress</h2>${topics.map(t => {
    const cs = all.filter(c => c.topic == t), k = cs.filter(c => P[c.id] === 1).length;
    return `<div>${esc(t)} – ${k}/${cs.length} known<div class="bar"><i style="width:${k / cs.length * 100}%"></i></div></div>`;
  }).join('')}<button id="rst">Reset progress</button></div>
  <div class="panel" style="margin-top:1rem"><h2>Revision tips</h2><ul>
  <li>Always rewrite roots and fractions as powers before differentiating or integrating.</li>
  <li>Don't forget <b>+ c</b> for indefinite integrals.</li>
  <li>Check the nature of stationary points with the second derivative.</li>
  <li>Do 10 minutes of cards daily – spaced practice beats cramming.</li>
  <li>Revisit every card marked 🔁 until it turns ✅.</li></ul></div>`;
  $('#rst').onclick = () => { if (confirm('Reset all progress?')) { P = {}; save(); vStats(); } };
}

// ---- Match pairs ----
let mt = {};
function vMatch() {
  if (!mt.cards) { mt.cards = sh(pool).slice(0, 6); mt.L = sh(mt.cards); mt.R = sh(mt.cards); mt.got = 0; }
  app.innerHTML = `<p class="meta">Tap a question, then its matching answer</p><div class="grid">${mt.L.map((c, k) =>
    `<button class="t" data-s="q" data-id="${c.id}">${esc(c.question)}</button><button class="t" data-s="a" data-id="${mt.R[k].id}">${esc(mt.R[k].answer)}</button>`).join('')}</div>`;
  app.querySelectorAll('.t').forEach(b => b.onclick = () => {
    if (b.classList.contains('right')) return;
    const s = app.querySelector('.sel');
    if (!s) return b.classList.add('sel');
    if (s == b) return b.classList.remove('sel');
    if (s.dataset.s == b.dataset.s) { s.classList.remove('sel'); return b.classList.add('sel'); }
    if (s.dataset.id == b.dataset.id) {
      [s, b].forEach(x => { x.classList.remove('sel'); x.classList.add('right'); });
      mark(pool.find(c => c.id == b.dataset.id), 1);
      if (++mt.got == mt.cards.length) {
        app.insertAdjacentHTML('beforeend', '<div class="row"><b>All matched 🎉</b><button class="pri" id="nm">New round</button></div>');
        $('#nm').onclick = () => { mt = {}; vMatch(); };
      }
    } else { [s, b].forEach(x => x.classList.add('wrong')); setTimeout(() => [s, b].forEach(x => x.classList.remove('wrong', 'sel')), 500); }
  });
}
