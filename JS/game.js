// ===== Helpers =====
const $   = id  => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];
const param = k => new URLSearchParams(location.search).get(k);

function triggerBodyFlash(kind /* 'correct' | 'wrong' */){
  const html = document.documentElement; // <html>
  html.classList.remove('flash-correct','flash-wrong');
  // Reflow erzwingen, damit die Animation jedes Mal neu startet
  void html.offsetWidth;
  html.classList.add(kind === 'correct' ? 'flash-correct' : 'flash-wrong');
  // nach 2s wieder sauber entfernen
  setTimeout(() => {
    html.classList.remove('flash-correct','flash-wrong');
  }, 2000);
}

// Einmaliges Erzeugen/Sicherstellen des Overlays
function ensureFlashOverlay(){
  let el = document.getElementById('globalFlashOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalFlashOverlay';
    document.body.appendChild(el);
  }
  return el;
}

// Effekt auslösen (type: "correct" | "wrong")
function flashScreen(type){
  const el = ensureFlashOverlay();
  // laufende Animation zurücksetzen
  el.className = '';
  // Reflow erzwingen, damit die Klasse neu startet
  void el.offsetWidth;
  el.classList.add(type === 'correct' ? 'flash-correct' : 'flash-wrong');
  // Nach 2.1s aufräumen (etwas > Animationsdauer)
  setTimeout(() => { el.className = ''; }, 2100);
}




$("year") && ($("year").textContent = new Date().getFullYear());

// ===== Role visibility =====
const isHost = (param("role") || "").toLowerCase() === "host";
qsa(".host-only").forEach(el => el.classList.toggle("hidden", !isHost));
qsa(".viewer-only").forEach(el => el.classList.toggle("hidden", isHost));
document.body.classList.toggle("is-host", isHost);

// ===== GLOBAL STATE (eine Quelle der Wahrheit) =====
const STATE = (window.STATE ||= {
  quiz: null,
  boardIndex: 0,
  used: new Set(),
  currentCell: null,       // {catIdx,qIdx,points,text,answer}
  players: [],             // nur Spieler (ohne Host)
  currentPlayerIndex: 0,
  hostName: (param("host") || "Host"),
  buzzMode: false,
  currentBuzzPlayer: null,
});

// ===== Elements =====
const gameTitle     = $("gameTitle");
const hostNameBox   = $("hostNameBox");
const boardGrid     = $("boardGrid");
const qText         = $("qText");
const qAnswerWrap   = $("qAnswerWrap");
const qAnswer       = $("qAnswer");
const btnCorrect    = $("btnCorrect");
const btnWrong      = $("btnWrong");
const statusBox     = $("status");
const playerList    = $("playerList");
const buzzerBar     = $("buzzerBar");
const buzzerBtns    = $("buzzerBtns");
const sidebar       = $("sidebar");
const drawerScrim   = $("drawerScrim");
const turnIndicator = $("turnIndicator");

// ===== Init =====
(async function init(){
  const quizId = param("quizId");

  try {
    if (quizId){
      const res = await fetch(`/api/quizzes?id=${encodeURIComponent(quizId)}`);
      if (res.ok) STATE.quiz = await res.json();
    }
  } catch {}

  if (!STATE.quiz && quizId){
    try{
      const list = JSON.parse(localStorage.getItem("quiz:quizzes")||"[]");
      STATE.quiz = list.find(q=>q.id===quizId) || null;
    }catch{}
  }

  if (STATE.quiz){
    gameTitle.textContent = STATE.quiz.title || "Quiz";
  } else {
    status("Kein Quiz gefunden. Nutze setQuizForTest(...) in der Konsole.");
    gameTitle.textContent = "Quiz";
  }

  // UI & Controls IMMER verdrahten (auch ohne Quiz!)
  hostNameBox.textContent = STATE.hostName;
  renderPlayers();
  highlightCurrentPlayer();
  wireControls();
  wireMobileDrawer();
  applyMobileHeights();
  updateMobileIndicator();

  // Board nur rendern, wenn Quiz existiert
  if (STATE.quiz) renderBoard();

  window.addEventListener("resize", applyMobileHeights);
  window.addEventListener("orientationchange", applyMobileHeights);
})();


// ===== Players UI =====
function renderPlayers(){
  playerList.innerHTML = "";
  STATE.players.forEach((p,i)=>{
    const li = document.createElement("li");
    li.className = "player-item" + (i===STATE.currentPlayerIndex ? " current" : "");
    li.innerHTML = `
      <span class="player-name">${p.name}</span>
      <span class="player-score" id="score-${p.id}">${p.score}</span>
    `;
    playerList.appendChild(li);
  });
}
function highlightCurrentPlayer(){
  qsa(".player-item").forEach((el,idx)=> el.classList.toggle("current", idx===STATE.currentPlayerIndex));
  updateMobileIndicator();
}
function getActivePlayer(){ return STATE.players[STATE.currentPlayerIndex]; }
function updateScore(p){ const el = $(`score-${p.id}`); if (el) el.textContent = p.score; }
function advanceTurn(){
  if (!STATE.players.length) return;
  STATE.currentPlayerIndex = (STATE.currentPlayerIndex + 1) % STATE.players.length;
  highlightCurrentPlayer();
}

// ===== Board render =====
function renderBoard(){
  if (!STATE.quiz) return;
  const b = STATE.quiz.boards[STATE.boardIndex];
  const cols = b.categories.length;
  boardGrid.classList.add("narrow");
  boardGrid.style.setProperty("--cols", cols);
  boardGrid.innerHTML = "";

  // Header
  b.categories.forEach(cat=>{
    const cell = document.createElement("div");
    cell.className = "cell header";
    cell.textContent = cat.name || "—";
    boardGrid.appendChild(cell);
  });

  // Fragen
  const rows = Math.max(...b.categories.map(c=>c.questions.length));
  for (let r=1;r<=rows;r++){
    b.categories.forEach((cat,ci)=>{
      const q = cat.questions.find(x=>x.index===r);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell q";
      btn.dataset.cat = ci+1;
      btn.dataset.q = r;
      btn.textContent = q ? `${q.points}` : "—";
      const key = usedKey(STATE.boardIndex, ci+1, r);
      if (STATE.used.has(key)) btn.classList.add("used");
      if (!isHost) btn.classList.add("host-disabled");
      btn.addEventListener("click", ()=> onCellClick(ci+1, r));
      boardGrid.appendChild(btn);
    });
  }

  showQuestion(null);
}
function usedKey(bi,ci,qi){ return `b${bi}-c${ci}-q${qi}`; }

// ===== Question flow =====
function onCellClick(catIdx, qIdx){
  if (!isHost) return;

  const b   = STATE.quiz.boards[STATE.boardIndex];
  const cat = b.categories[catIdx - 1];
  const q   = cat.questions.find(x => x.index === qIdx);
  if (!q) return;

  const key = usedKey(STATE.boardIndex, catIdx, qIdx);
  if (STATE.used.has(key)) return; // bereits belegt → ignorieren

  // ⬇️ Sofort als benutzt markieren (wird direkt rot)
  STATE.used.add(key);
  const btn = boardGrid.querySelector(`.cell.q[data-cat="${catIdx}"][data-q="${qIdx}"]`);
  if (btn) btn.classList.add("used");

  // Frage anzeigen
  STATE.currentCell = { catIdx, qIdx, points: q.points, text: q.text, answer: q.answer };
  showQuestion(STATE.currentCell);
}


function showQuestion(cell){
  if (!cell){
    qText.textContent = "Wähle ein Punktefeld, um die Frage zu zeigen.";
    qAnswerWrap.classList.add("hidden");
    btnCorrect.disabled = true;
    btnWrong.disabled = true;
    closeBuzzer();
    return;
  }
  qText.textContent = cell.text;
  if (isHost){ qAnswer.textContent = cell.answer; qAnswerWrap.classList.remove("hidden"); }
  else { qAnswerWrap.classList.add("hidden"); }
  btnCorrect.disabled = false;
  btnWrong.disabled = false;
  closeBuzzer();
}

// ===== Controls =====
function wireControls(){
  btnCorrect.addEventListener("click", ()=>{
    if (!STATE.currentCell) return;
    flashScreen("correct");


    if (STATE.buzzMode && STATE.currentBuzzPlayer){
      const half = Math.floor(STATE.currentCell.points/2);
      STATE.currentBuzzPlayer.score += half;
      updateScore(STATE.currentBuzzPlayer);
      endQuestionAndAdvance();
      return;
    }

    const active = getActivePlayer();
    if (active){ active.score += STATE.currentCell.points; updateScore(active); }
    endQuestionAndAdvance();
  });

  btnWrong.addEventListener("click", ()=>{
    if (!STATE.currentCell) return;
    flashScreen("wrong");

    if (STATE.buzzMode && STATE.currentBuzzPlayer){
      const half = Math.floor(STATE.currentCell.points/2);
      STATE.currentBuzzPlayer.score -= half;
      updateScore(STATE.currentBuzzPlayer);
      removeBuzzButtonFor(STATE.currentBuzzPlayer);
      setCurrentBuzzPlayer(null);

      if (buzzerBtns.children.length > 0){
        status("Nächster Buzz-Versuch …");
      } else {
        endQuestionAndAdvance();
      }
      return;
    }

    const active = getActivePlayer();
    const half = Math.floor(STATE.currentCell.points/2);
    if (active){ active.score -= half; updateScore(active); }
    openBuzzer();
  });
}

// ===== Mobile Drawer =====
function wireMobileDrawer(){
  if (!sidebar || !turnIndicator || !drawerScrim) return;

  const isMobile = () => window.innerWidth <= 860;

  const openDrawer = () => {
    sidebar.classList.add("open");
    drawerScrim.hidden = false;
    turnIndicator.setAttribute("aria-expanded", "true");
  };
  const closeDrawer = () => {
    sidebar.classList.remove("open");
    drawerScrim.hidden = true;
    turnIndicator.setAttribute("aria-expanded", "false");
  };
  const toggleDrawer = () => {
    if (sidebar.classList.contains("open")) closeDrawer();
    else openDrawer();
  };

  const applyVisibility = () => {
    const show = isMobile();
    turnIndicator.hidden = !show;
    if (!show) closeDrawer();
  };

  // Events
  turnIndicator.addEventListener("click", toggleDrawer);
  drawerScrim.addEventListener("click", closeDrawer);
  window.addEventListener("resize", applyVisibility);

  // Initial
  applyVisibility();
}

// ===== Buzzer =====
function openBuzzer(){
  const candidates = STATE.players.filter((_, idx) => idx !== STATE.currentPlayerIndex);
  buzzerBtns.innerHTML = "";
  STATE.currentBuzzPlayer = null;
  STATE.buzzMode = true;

  if (!candidates.length){
    endQuestionAndAdvance();
    return;
  }

  candidates.forEach(p=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = `→ ${p.name}`;
    b.addEventListener("click", ()=> selectBuzzPlayer(p));
    buzzerBtns.appendChild(b);
  });

  buzzerBar.classList.remove("hidden");
  status("Buzzer offen: wähle, wer versucht zu antworten.");
  showBuzzHint(null);
  updateMobileIndicator();
}

function selectBuzzPlayer(p){
  setCurrentBuzzPlayer(p);
  status(`Buzz-Versuch: ${p.name} – mit Richtig/Falsch bewerten.`);
}

function setCurrentBuzzPlayer(p){
  qsa(".player-item").forEach(el => el.classList.remove("buzzing"));
  STATE.currentBuzzPlayer = p || null;
  if (p){
    const idx = STATE.players.findIndex(x=>x.id===p.id);
    const li = playerList.children[idx];
    if (li) li.classList.add("buzzing");
  }
  showBuzzHint(p);
  updateMobileIndicator();
}

function showBuzzHint(p){
  if (!p){
    qText.textContent = STATE.currentCell?.text || "Wähle ein Punktefeld, um die Frage zu zeigen.";
    return;
  }
  qText.textContent = `${STATE.currentCell?.text || ""} — (Buzz: ${p.name})`;
}

function removeBuzzButtonFor(p){
  const btns = [...buzzerBtns.querySelectorAll("button")];
  const btn = btns.find(b => b.textContent.endsWith(p.name));
  if (btn) btn.remove();
}

function closeBuzzer(){
  buzzerBar.classList.add("hidden");
  buzzerBtns.innerHTML = "";
  setCurrentBuzzPlayer(null);
  STATE.buzzMode = false;
  updateMobileIndicator();
}

// ===== End question + advance turn =====
function endQuestionAndAdvance(){
  if (STATE.currentCell){
    STATE.used.add(`b${STATE.boardIndex}-c${STATE.currentCell.catIdx}-q${STATE.currentCell.qIdx}`);
    const btn = boardGrid.querySelector(`.cell.q[data-cat="${STATE.currentCell.catIdx}"][data-q="${STATE.currentCell.qIdx}"]`);
    if (btn) btn.classList.add("used");
  }
  STATE.currentCell = null;
  showQuestion(null);
  closeBuzzer();
  status("Frage abgeschlossen.");

  if (STATE.players.length) advanceTurn(); // Buzz-Gewinne ändern Reihenfolge NICHT
  checkNextBoard();
}

// ===== Board 1 → Board 2 =====
function checkNextBoard(){
  if (!STATE.quiz || STATE.boardIndex !== 0) return;
  const total = STATE.quiz.boards[0].categories.reduce((s,c)=>s+c.questions.length,0);
  const usedCount = [...STATE.used].filter(k => k.startsWith("b0-")).length;
  if (usedCount >= total){
    STATE.boardIndex = 1;
    renderBoard();
    status("Wechsel zu Board 2!");
  }
}

// ===== Status / Mobile-Indikator / Höhen =====
function status(msg){ statusBox.textContent = msg || ""; }

function updateMobileIndicator(){
  if (!turnIndicator) return;
  const current = STATE.players[STATE.currentPlayerIndex];
  const nameEl   = turnIndicator.querySelector(".ti-name");
  const label = (STATE.buzzMode && STATE.currentBuzzPlayer)
    ? STATE.currentBuzzPlayer.name
    : (current ? current.name : "—");
  if (nameEl) nameEl.textContent = label;
  turnIndicator.classList.toggle("buzzing", !!(STATE.buzzMode && STATE.currentBuzzPlayer));
}

function applyMobileHeights(){
  // Höhe der unteren Controls → CSS-Var, damit Drawer & Trigger korrekt sitzen
  const controls = document.querySelector(".answer-actions");
  const h = controls ? controls.offsetHeight : 64;
  document.documentElement.style.setProperty("--controls-h", h + "px");
}

// ===== Test-Helfer für die Konsole (stabil, ohne Scope-Probleme) =====
function setQuizForTest(q){
  STATE.quiz = q;
  STATE.boardIndex = 0;
  STATE.used = new Set();
  STATE.currentCell = null;

  if (gameTitle) gameTitle.textContent = STATE.quiz.title || "Quiz";
  renderBoard();
  showQuestion(null);
  status("✅ Test-Quiz geladen. Wähle ein Punktefeld.");
}
function setPlayersForTest(names = ["Anna","Ben","Clara"]){
  STATE.players = names.map(n => ({ id: crypto.randomUUID(), name: n, score: 0 }));
  STATE.currentPlayerIndex = 0;
  renderPlayers();
  highlightCurrentPlayer();
}
Object.assign(window, { STATE, setQuizForTest, setPlayersForTest });

// ===== Visuelles Feedback (Rand leuchtet auf) =====
function flashFeedback(type = "correct") {
  const cls = type === "correct" ? "flash-correct" : "flash-wrong";
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), 3000);
}
