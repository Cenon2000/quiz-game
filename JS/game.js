// ===== Helpers =====
const $   = id  => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];
const params   = new URLSearchParams(location.search);
const roomCode = params.get("code")?.toUpperCase() || null;
const param = (name) => params.get(name);

function triggerBodyFlash(kind /* 'correct' | 'wrong' */){
  const html = document.documentElement; // <html>
  html.classList.remove('flash-correct','flash-wrong');
  void html.offsetWidth;
  html.classList.add(kind === 'correct' ? 'flash-correct' : 'flash-wrong');
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
  el.className = '';
  void el.offsetWidth;
  el.classList.add(type === 'correct' ? 'flash-correct' : 'flash-wrong');
  setTimeout(() => { el.className = ''; }, 2100);
}

$("year") && ($("year").textContent = new Date().getFullYear());

// ===== Role visibility =====
const isHost =
  (param("role") || "").toLowerCase() === "host" ||
  param("host") === "1" ||
  sessionStorage.getItem("quiz:isHost") === "1";

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
  hostName: sessionStorage.getItem("quiz:playerName") || "Host",
  buzzMode: false,
  currentBuzzPlayer: null,
  buzzQueue: [],           // Array von Player-IDs in Buzz-Reihenfolge
  flashSeq: 0,             // Zähler für visuelle Effekte (Rand-Flash)
  buzzDeadline: null,
});

// === Realtime (Broadcast) ===
let roomRT = null;
let lastFlashSeqSeen = 0;

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

const buzzOverlay   = $("buzzOverlay");
const buzzOverlayBtn = $("buzzOverlayBtn");
const buzzTimerBar  = $("buzzTimerBar");
// Button für Spieler-Buzz wird dynamisch erzeugt:
let viewerBuzzBtn = $("viewerBuzzBtn");
let buzzTimerInterval = null;
let lastBuzzMode = false; // für Übergänge in onState


// ===== Init =====
(async function init(){
  let quizId = param("quizId"); // Fallback für alte Links

  // 1) Room + State + Players aus Supabase laden
  if (roomCode && window.Cloud && typeof Cloud.getRoom === "function") {
    try {
      const room = await Cloud.getRoom(roomCode);

      if (room.host_name) {
        STATE.hostName = room.host_name;
      }

      quizId = room.state?.quizId || room.quiz_id || quizId;

      if (room.state) {
        STATE.boardIndex  = room.state.boardIndex ?? 0;
        STATE.used        = new Set(room.state.used || []);
        STATE.currentCell = room.state.currentCell || null;
        STATE.buzzMode    = !!room.state.buzzMode;
        STATE.buzzQueue   = Array.isArray(room.state.buzzQueue) ? room.state.buzzQueue : [];
      }

      if (Array.isArray(room.players)) {
        STATE.players = room.players;
      }
    } catch (err) {
      console.error("Room laden fehlgeschlagen:", err);
    }
  }

  // 2) Quiz laden (Supabase)
  try {
    if (quizId && window.Cloud && typeof Cloud.loadQuizById === "function") {
      STATE.quiz = await Cloud.loadQuizById(quizId);
    }
  } catch (err) {
    console.error("Quiz Laden von Supabase fehlgeschlagen:", err);
  }

  // 3) Fallback: localStorage
  if (!STATE.quiz && quizId) {
    try {
      const list = JSON.parse(localStorage.getItem("quiz:quizzes") || "[]");
      STATE.quiz = list.find(q => q.id === quizId) || null;
    } catch (err) {
      console.error("Fallback localStorage fehlgeschlagen:", err);
    }
  }

  // 4) Titel / Status
  if (STATE.quiz) {
    gameTitle.textContent = STATE.quiz.title || "Quiz";
  } else {
    status("Kein Quiz gefunden. Nutze setQuizForTest(...) in der Konsole.");
    gameTitle.textContent = "Quiz";
  }

  // 5) UI & Controls verdrahten
  hostNameBox.textContent = STATE.hostName;
  renderPlayers();
  highlightCurrentPlayer();
  wireControls();
  wireMobileDrawer();
  applyMobileHeights();
  updateMobileIndicator();

  // BUZZ!-Button für Viewer dynamisch hinzufügen
  if (!isHost && buzzerBar) {
    const hint = buzzerBar.querySelector(".buzzer-hint");
    if (hint && !viewerBuzzBtn) {
      const btn = document.createElement("button");
      btn.id = "viewerBuzzBtn";
      btn.className = "btn";
      btn.textContent = "BUZZ!";
      hint.insertBefore(btn, hint.firstChild);
      viewerBuzzBtn = btn;
    }
  }

  // Vollbild-Overlay-BUZZ-Button
if (buzzOverlayBtn) {
  buzzOverlayBtn.addEventListener("click", async () => {
    await onLocalBuzz();
    hideBuzzOverlay();
  });
}


  if (viewerBuzzBtn) {
    viewerBuzzBtn.addEventListener("click", onLocalBuzz);
    viewerBuzzBtn.disabled = true;
  }

  if (STATE.quiz) renderBoard();

  window.addEventListener("resize", applyMobileHeights);
  window.addEventListener("orientationchange", applyMobileHeights);

  // 6) Realtime-Kanal öffnen
  if (roomCode && window.Cloud && typeof Cloud.openRoomChannel === "function") {
    roomRT = Cloud.openRoomChannel(roomCode, {
      onState: (state) => {
  if (!state) return;

  // vorherigen Zustand merken
  const prevBuzzMode = lastBuzzMode;

  STATE.boardIndex  = state.boardIndex ?? 0;
  STATE.used        = new Set(state.used || []);
  STATE.currentCell = state.currentCell || null;
  STATE.buzzMode    = !!state.buzzMode;
  STATE.buzzQueue   = Array.isArray(state.buzzQueue) ? state.buzzQueue : [];

  lastBuzzMode = STATE.buzzMode;

  // ... Spieler ermitteln, Board rendern etc. (alles lassen wie es ist) ...

  // 🔥 Buzzer nur anhand von STATE.buzzMode steuern
  if (STATE.buzzMode) {
    openBuzzer();

    // Spieler sehen das große Overlay nur beim Übergang von false -> true
    if (!isHost && !prevBuzzMode && localCanBuzz()) {
      showBuzzOverlay();
    }
  } else {
    closeBuzzer();

    // Overlay schließen, wenn die Buzzer-Phase endet
    if (!isHost && prevBuzzMode) {
      hideBuzzOverlay();
    }
  }

  // BUZZ!-Button für alte Buzzer-Leiste (falls sichtbar) ✓/✗
  if (viewerBuzzBtn) {
    viewerBuzzBtn.disabled = !localCanBuzz();
  }

  // Rand-Flash synchronisieren
  if (typeof state.flashSeq === "number" &&
      state.flashSeq > lastFlashSeqSeen &&
      state.flashType) {
    lastFlashSeqSeen = state.flashSeq;
    flashScreen(state.flashType === "correct" ? "correct" : "wrong");
  }
},



      onPlayers: (arr) => {
        if (!Array.isArray(arr)) return;
        STATE.players = arr;
        renderPlayers();
        highlightCurrentPlayer();
      }
    });
  }

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
function onCellClick(catIdx, qIdx) {
  if (!isHost || !STATE.quiz) return;

  const b   = STATE.quiz.boards[STATE.boardIndex];
  const cat = b.categories[catIdx - 1];
  const q   = cat?.questions.find(x => x.index === qIdx);
  if (!q) return;

  const key = usedKey(STATE.boardIndex, catIdx, qIdx);
  if (STATE.used.has(key)) return; // schon benutzt

  STATE.used.add(key);
  const btn = boardGrid.querySelector(`.cell.q[data-cat="${catIdx}"][data-q="${qIdx}"]`);
  if (btn) btn.classList.add("used");

  STATE.currentCell = { catIdx, qIdx, points: q.points, text: q.text, answer: q.answer };
  showQuestion(STATE.currentCell);

  // Wenn neue Frage gewählt wird: Buzz-Modus resetten
  STATE.buzzMode = false;
  STATE.buzzQueue = [];
  STATE.currentBuzzPlayer = null;
  broadcastState();
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
  if (isHost){
    qAnswer.textContent = cell.answer;
    qAnswerWrap.classList.remove("hidden");
  } else {
    qAnswerWrap.classList.add("hidden");
  }
  btnCorrect.disabled = false;
  btnWrong.disabled = false;
  closeBuzzer();
}

// ===== State-Broadcast & Buzz-Helpers =====
function broadcastState(flashType) {
  if (!isHost || !roomRT) return;

  if (flashType) {
    STATE.flashSeq = (STATE.flashSeq || 0) + 1;
  }

  const currentPlayer = STATE.players[STATE.currentPlayerIndex] || null;

  const state = {
    boardIndex: STATE.boardIndex,
    used: Array.from(STATE.used),
    currentCell: STATE.currentCell,   // null, wenn Frage beendet
    buzzMode: STATE.buzzMode,
    buzzQueue: Array.isArray(STATE.buzzQueue) ? STATE.buzzQueue : [],
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    currentBuzzPlayerId: STATE.currentBuzzPlayer ? STATE.currentBuzzPlayer.id : null,
    flashSeq: STATE.flashSeq || 0,
    flashType: flashType || null,
  };

  roomRT.sendState(state);
  roomRT.sendPlayers(STATE.players);
}

function getLocalPlayerId(){
  // 1) Direkt aus sessionStorage lesen, falls schon gesetzt
  let id = sessionStorage.getItem("quiz:playerId");
  if (id) return id;

  // 2) Fallback: über den gespeicherten Spielernamen den Spieler im STATE suchen
  const storedName = sessionStorage.getItem("quiz:playerName");
  if (!storedName || !Array.isArray(STATE.players) || !STATE.players.length) {
    return null;
  }

  const normalize = (s) => (s || "").trim().toLowerCase();
  const target = normalize(storedName);

  const match = STATE.players.find(p => normalize(p.name) === target);
  if (match && match.id) {
    // Einmal gefunden → in sessionStorage merken, damit es ab dann schnell geht
    sessionStorage.setItem("quiz:playerId", match.id);
    return match.id;
  }

  return null;
}


function localCanBuzz(){
  const pid = getLocalPlayerId();
  if (!pid) return false;
  if (!STATE.buzzMode) return false;
  const active = getActivePlayer();
  if (active && active.id === pid) return false; // der aktive Spieler darf nicht buzzern
  const q = Array.isArray(STATE.buzzQueue) ? STATE.buzzQueue : [];
  return !q.includes(pid); // noch nicht in der Warteschlange
}

// Spieler-BUZZ-Klick
async function onLocalBuzz(){
  const pid = getLocalPlayerId();
  if (!pid || !roomCode) return;
  if (!localCanBuzz()) return;
  if (!window.Cloud || typeof Cloud.buzzIn !== "function") return;

  try {
    if (viewerBuzzBtn) viewerBuzzBtn.disabled = true;
    await Cloud.buzzIn(roomCode, pid);
  } catch (e) {
    console.error("Buzz senden fehlgeschlagen:", e);
  }
}

// ===== Controls =====
function wireControls(){
  btnCorrect.addEventListener("click", ()=>{
    if (!STATE.currentCell) return;
    flashScreen("correct");

    // --- BUZZ-MODUS: richtiger Versuch eines Buzzers ---
    if (STATE.buzzMode && STATE.currentBuzzPlayer){
      const half = Math.floor(STATE.currentCell.points/2);
      STATE.currentBuzzPlayer.score += half;
      updateScore(STATE.currentBuzzPlayer);

      // Frage beenden, Buzz-Modus aus
      STATE.buzzMode = false;
      STATE.buzzQueue = [];
      STATE.currentBuzzPlayer = null;

      endQuestionAndAdvance();
      broadcastState("correct");
      return;
    }

    // --- normaler aktiver Spieler ---
    const active = getActivePlayer();
    if (active){
      active.score += STATE.currentCell.points;
      updateScore(active);
    }

    STATE.buzzMode = false;
    STATE.buzzQueue = [];
    STATE.currentBuzzPlayer = null;

    endQuestionAndAdvance();
    broadcastState("correct");
  });

  btnWrong.addEventListener("click", ()=>{
    if (!STATE.currentCell) return;
    flashScreen("wrong");

    // --- BUZZ-MODUS: falscher Versuch des buzzenden Spielers ---
    if (STATE.buzzMode && STATE.currentBuzzPlayer){
      const half = Math.floor(STATE.currentCell.points/2);
      STATE.currentBuzzPlayer.score -= half;
      updateScore(STATE.currentBuzzPlayer);

      const pid = STATE.currentBuzzPlayer.id;
      const q = Array.isArray(STATE.buzzQueue) ? STATE.buzzQueue : [];
      STATE.buzzQueue = q.filter(id => id !== pid);

      if (STATE.buzzQueue.length > 0){
        const next = STATE.players.find(p => p.id === STATE.buzzQueue[0]);
        STATE.currentBuzzPlayer = next || null;
        status("Nächster Buzz-Versuch …");
        broadcastState("wrong");
      } else {
        // keiner mehr übrig → Frage beenden
        STATE.currentBuzzPlayer = null;
        STATE.buzzMode = false;
        endQuestionAndAdvance();
        broadcastState("wrong");
      }
      return;
    }

    // --- normaler aktiver Spieler falsch → Buzz öffnen ---
    const active = getActivePlayer();
  const half = Math.floor(STATE.currentCell.points/2);
  if (active){
    active.score -= half;
    updateScore(active);
    if (isHost && roomRT) roomRT.sendPlayers(STATE.players);
  }

  // 🔥 HIER: Buzzer-Phase global einschalten
  STATE.buzzMode = true;
  STATE.buzzQueue = [];
  STATE.currentBuzzPlayer = null;

  // Host öffnet den Buzzer lokal…
  openBuzzer();
  // …und synchronisiert den Zustand (inkl. buzzMode & Flash) an alle
  broadcastState("wrong");
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

  turnIndicator.addEventListener("click", toggleDrawer);
  drawerScrim.addEventListener("click", closeDrawer);
  window.addEventListener("resize", applyVisibility);

  applyVisibility();
}

// ===== Buzzer =====
function openBuzzer(){
  if (!buzzerBar) return;

  // Nur UI: Buzzer-Leiste anzeigen
  buzzerBar.classList.remove("hidden");
  buzzerBar.style.display = "flex";

  // Hinweistext anpassen
  if (isHost) {
    if (STATE.currentBuzzPlayer) {
      status(`Buzz: ${STATE.currentBuzzPlayer.name} ist dran.`);
    } else {
      status("Buzzer offen – andere Spieler können buzzern.");
    }
  } else {
    status("Buzzer offen – drücke BUZZ!, wenn du die Antwort weißt.");
  }

  // Fragetext evtl. um Buzz-Hinweis ergänzen
  showBuzzHint(STATE.currentBuzzPlayer);

  // BUZZ!-Button für Viewer aktivieren/deaktivieren
  if (viewerBuzzBtn) {
    viewerBuzzBtn.disabled = !localCanBuzz();
  }

  updateMobileIndicator();
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

function closeBuzzer(){
  if (buzzerBar) {
    buzzerBar.classList.add("hidden");
    buzzerBar.style.display = "none";
  }
  if (buzzerBtns) {
    buzzerBtns.innerHTML = "";
  }
  setCurrentBuzzPlayer(null);
  STATE.buzzMode = false;      // lokal konsistent halten
  STATE.buzzQueue = [];
  if (viewerBuzzBtn) viewerBuzzBtn.disabled = true;
  updateMobileIndicator();
}

function showBuzzOverlay(){
  if (isHost) return;                // Host sieht das Overlay nicht
  if (!buzzOverlay || !buzzOverlayBtn || !buzzTimerBar) return;
  if (!localCanBuzz()) return;

  buzzOverlay.classList.remove("hidden");
  buzzOverlay.setAttribute("aria-hidden", "false");

  const duration = 10000;            // 10 Sekunden
  const start = Date.now();
  STATE.buzzDeadline = start + duration;

  if (buzzTimerInterval) {
    clearInterval(buzzTimerInterval);
  }
  buzzTimerBar.style.width = "100%";

  buzzTimerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, STATE.buzzDeadline - now);
    const pct = (remaining / duration) * 100;
    buzzTimerBar.style.width = pct + "%";

    if (remaining <= 0) {
      clearInterval(buzzTimerInterval);
      buzzTimerInterval = null;
      hideBuzzOverlay();
    }
  }, 100);
}

function hideBuzzOverlay(){
  if (buzzOverlay) {
    buzzOverlay.classList.add("hidden");
    buzzOverlay.setAttribute("aria-hidden", "true");
  }
  if (buzzTimerInterval) {
    clearInterval(buzzTimerInterval);
    buzzTimerInterval = null;
  }
  STATE.buzzDeadline = null;
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

  if (STATE.players.length) advanceTurn();
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
  const controls = document.querySelector(".answer-actions");
  const h = controls ? controls.offsetHeight : 64;
  document.documentElement.style.setProperty("--controls-h", h + "px");
}

// ===== Test-Helfer =====
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
