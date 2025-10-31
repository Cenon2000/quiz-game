/* ========= Grundsetup ========= */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const stepper = document.getElementById("stepper")?.children || [];
const steps = [...document.querySelectorAll(".step")];
const prevBtn = document.getElementById("prevStep");
const nextBtn = document.getElementById("nextStep");
const saveBtn = document.getElementById("saveQuiz");
const saveDraftBtn = document.getElementById("saveDraft");

const titleInput = document.getElementById("quizTitle");
const b1CatsInp = document.getElementById("b1Cats");
const b2CatsInp = document.getElementById("b2Cats");
const buildBtn  = document.getElementById("buildBoards");
const board1El  = document.getElementById("board-1");
const board2El  = document.getElementById("board-2");
const reviewEl  = document.getElementById("review");

const b1Collapse = document.getElementById("b1-collapse");
const b1Expand   = document.getElementById("b1-expand");
const b2Collapse = document.getElementById("b2-collapse");
const b2Expand   = document.getElementById("b2-expand");

let currentStep = 1;

/* ========= Punkte-Regel ========= */
function getPoints(boardIndex, questionIndex){
  if (questionIndex === 1) return 100;
  if (questionIndex === 2) return 200;
  if (questionIndex === 3) return 300;
  if (questionIndex === 4) return 500;
  return questionIndex * 100; // falls >4
}

/* ========= UI-Helfer ========= */
function gotoStep(n){
  currentStep = Math.max(1, Math.min(4, n));
  steps.forEach(s => s.classList.remove("active"));
  steps[currentStep-1]?.classList.add("active");
  [...stepper].forEach((li, i)=> li.classList.toggle("active", i === currentStep-1));
  if (prevBtn) prevBtn.disabled = currentStep === 1;
  if (nextBtn) nextBtn.classList.toggle("hide", currentStep === 4);
  if (saveBtn) saveBtn.classList.toggle("hide", currentStep !== 4);
  window.scrollTo({ top: 0, behavior: "instant" });
}

prevBtn?.addEventListener("click", ()=> gotoStep(currentStep - 1));
nextBtn?.addEventListener("click", ()=>{
  if (currentStep === 1) {
    // beim Wechsel zu Schritt 2 sicherstellen, dass Felder gebaut sind
    if (!board1El?.dataset.ready || !board2El?.dataset.ready) buildInputs();
  }
  if (currentStep === 3) buildReview(); // vor Review aktualisieren
  gotoStep(currentStep + 1);
});

/* ========= Eingabefelder erzeugen ========= */
buildBtn?.addEventListener("click", buildInputs);

function buildInputs(){
  const b1c = clamp(+b1CatsInp?.value, 1, 10);
  const b2c = clamp(+b2CatsInp?.value, 1, 10);
  const qPerCat = 4; // immer 4

  if (board1El) {
    board1El.innerHTML = buildBoard(1, b1c, qPerCat);
    board1El.dataset.ready = "1";
  }
  if (board2El) {
    board2El.innerHTML = buildBoard(2, b2c, qPerCat);
    board2El.dataset.ready = "1";
  }
}
function clamp(v, min, max){ return Math.max(min, Math.min(max, Math.floor(v||0))); }

function buildBoard(boardNo, catCount, qCount){
  const grid = document.createElement("div");
  grid.className = "cat-grid";
  for(let c=1; c<=catCount; c++){
    grid.appendChild(catCard(boardNo, c, qCount));
  }
  const wrap = document.createElement("div");
  wrap.appendChild(grid);
  return wrap.innerHTML;
}
function catCard(boardNo, catIndex, qCount){
  const details = document.createElement("details");
  details.className = "cat-card";
  details.open = catIndex <= 2; // nur die ersten offen → weniger Scroll
  details.dataset.board = boardNo;
  details.dataset.cat = catIndex;

  const summary = document.createElement("summary");
  const title = document.createElement("input");
  title.type = "text";
  title.placeholder = `Kategoriename #${catIndex}`;
  title.className = "cat-title";
  title.setAttribute("data-role","category-name");
  title.setAttribute("data-board", boardNo);
  title.setAttribute("data-cat", catIndex);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `#${catIndex}`;

  summary.append(title, badge);
  details.appendChild(summary);

  const qaGrid = document.createElement("div");
  qaGrid.className = "qa-grid";
  for(let qi=1; qi<=qCount; qi++){
    const row = document.createElement("div");
    row.className = "qa-row";
    row.dataset.qi = qi;

    const q = document.createElement("input");
    q.type = "text";
    q.placeholder = `Frage ${qi}`;
    q.setAttribute("data-role","question");
    q.setAttribute("data-board", boardNo);
    q.setAttribute("data-cat", catIndex);
    q.setAttribute("data-q", qi);

    const a = document.createElement("input");
    a.type = "text";
    a.placeholder = `Richtige Antwort ${qi}`;
    a.setAttribute("data-role","answer");
    a.setAttribute("data-board", boardNo);
    a.setAttribute("data-cat", catIndex);
    a.setAttribute("data-q", qi);

    const pts = document.createElement("div");
    pts.className = "points";
    pts.textContent = `${getPoints(boardNo, qi)} Punkte`;

    row.append(q, a, pts);
    qaGrid.appendChild(row);
  }
  details.appendChild(qaGrid);
  return details;
}

/* ========= Collapse/Expand Schnellsteuerung ========= */
function setAllDetails(el, open){
  el?.querySelectorAll("details.cat-card").forEach(d => d.open = open);
}
b1Collapse?.addEventListener("click", ()=> setAllDetails(board1El, false));
b1Expand  ?.addEventListener("click", ()=> setAllDetails(board1El, true));
b2Collapse?.addEventListener("click", ()=> setAllDetails(board2El, false));
b2Expand  ?.addEventListener("click", ()=> setAllDetails(board2El, true));

/* ========= Daten aus DOM sammeln ========= */
function collectBoard(boardNo){
  const boardEl = document.getElementById(`board-${boardNo}`);
  if (!boardEl) return { board: boardNo, categories: [] };
  const catEls = [...boardEl.querySelectorAll(".cat-card")];
  const categories = catEls.map(catEl => {
    const name = (catEl.querySelector('[data-role="category-name"]').value || "").trim();
    const qaRows = [...catEl.querySelectorAll(".qa-row")];
    const questions = qaRows.map(row => {
      const qi = +row.dataset.qi;
      const q = (row.querySelector('[data-role="question"]').value || "").trim();
      const a = (row.querySelector('[data-role="answer"]').value || "").trim();
      return { index: qi, text: q, answer: a, points: getPoints(boardNo, qi) };
    });
    return { index: +catEl.dataset.cat, name, questions };
  });
  return { board: boardNo, categories };
}

/* ========= Validierung & Review ========= */
function validateBoard(b){
  let ok = true;
  const issues = [];
  if (!b.categories.length) { ok = false; issues.push("Keine Kategorien."); }
  b.categories.forEach(c => {
    if (!c.name) { ok = false; issues.push(`Board ${b.board}, Kategorie #${c.index}: Name fehlt.`); }
    if (!c.questions.length) { ok = false; issues.push(`Board ${b.board}, Kategorie "${c.name||'#'+c.index}": Keine Fragen.`); }
    c.questions.forEach(q => {
      if (!q.text || !q.answer) {
        ok = false; issues.push(`Board ${b.board}, Kategorie "${c.name||'#'+c.index}", Frage ${q.index}: Text/Antwort fehlt.`);
      }
    });
  });
  return { ok, issues };
}

function buildReview(){
  const board1 = collectBoard(1);
  const board2 = collectBoard(2);

  const v1 = validateBoard(board1);
  const v2 = validateBoard(board2);

  const totalCats = board1.categories.length + board2.categories.length;
  const totalQs = board1.categories.reduce((s,c)=>s+c.questions.length,0) +
                  board2.categories.reduce((s,c)=>s+c.questions.length,0);

  reviewEl.innerHTML = `
    <h3>Zusammenfassung</h3>
    <ul>
      <li><strong>Titel:</strong> ${escapeHtml(titleInput?.value.trim() || "—")}</li>
      <li><strong>Kategorien gesamt:</strong> ${totalCats}</li>
      <li><strong>Fragen gesamt:</strong> ${totalQs}</li>
    </ul>

    <h3>Prüfung</h3>
    ${renderIssues([...v1.issues, ...v2.issues])}
    <p class="small">Hinweis: Du kannst jederzeit zu Schritt 2/3 zurückspringen und Anpassungen vornehmen.</p>
  `;
  // Wenn alles ok, „Weiter“ → „Speichern“
  const allOk = v1.ok && v2.ok && (titleInput?.value.trim());
  nextBtn?.classList.add("hide");
  saveBtn?.classList.toggle("hide", !allOk);
}
function renderIssues(list){
  if (!list.length) return `<p style="color:#059669;font-weight:700;">Keine Probleme gefunden ✓</p>`;
  return `<ul>${list.map(i=>`<li style="color:#b91c1c">${escapeHtml(i)}</li>`).join("")}</ul>`;
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

/* ========= Autosave (Entwurf lokal) ========= */
const DRAFT_KEY = "quiz:draft:create";

function saveDraft(){
  const draft = {
    title: titleInput?.value || "",
    b1Cats: b1CatsInp?.value || 4,
    b2Cats: b2CatsInp?.value || 4,
    board1HtmlReady: !!board1El?.dataset.ready,
    board2HtmlReady: !!board2El?.dataset.ready,
    board1: board1El?.innerHTML || "",
    board2: board2El?.innerHTML || "",
    ts: Date.now()
  };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function restoreDraft(){
  let raw = null;
  try { raw = localStorage.getItem(DRAFT_KEY); } catch {}
  if (!raw) return;
  try{
    const d = JSON.parse(raw);
    if (titleInput) titleInput.value = d.title || "";
    if (b1CatsInp) b1CatsInp.value = d.b1Cats || 4;
    if (b2CatsInp) b2CatsInp.value = d.b2Cats || 4;

    if (d.board1HtmlReady && d.board1 && board1El) { board1El.innerHTML = d.board1; board1El.dataset.ready = "1"; }
    if (d.board2HtmlReady && d.board2 && board2El) { board2El.innerHTML = d.board2; board2El.dataset.ready = "1"; }
  }catch{}
}

// Autosave events
["input","change"].forEach(evt=>{
  document.addEventListener(evt, throttle(saveDraft, 500));
});
saveDraftBtn?.addEventListener("click", ()=>{ saveDraft(); alert("Entwurf lokal gespeichert."); });

function throttle(fn, wait){
  let t=0; return (...args)=>{ const now=Date.now(); if(now-t>wait){ t=now; fn(...args); } };
}

/* ========= Cloud speichern ========= */
async function saveToCloud(quiz){
  const headers = { "Content-Type": "application/json" };
  // Falls du ADMIN_SECRET nutzt:
  // headers["X-Admin-Secret"] = "DEIN_GEHEIMNIS";
  const res = await fetch("/api/quizzes", { method: "POST", headers, body: JSON.stringify(quiz) });
  if (!res.ok) throw new Error("Speichern fehlgeschlagen");
  const data = await res.json();
  return data.id;
}

saveBtn?.addEventListener("click", async ()=>{
  const quiz = buildQuizPayload();
  try{
    const id = await saveToCloud(quiz);
    alert("Quiz gespeichert! ID: " + id);
    // optional: Entwurf leeren
    // localStorage.removeItem(DRAFT_KEY);
  }catch(e){
    alert(e.message);
  }
});

function buildQuizPayload(){
  const board1 = collectBoard(1);
  const board2 = collectBoard(2);
  return {
    id: crypto.randomUUID(),
    title: titleInput?.value.trim(),
    boards: [board1, board2],
    createdAt: Date.now(),
    scoring: {
      board1: "1→100, 2→200, 3→300, 4→500, sonst +100",
      board2: "1→100, 2→200, 3→300, 4→500, sonst +100"
    }
  };
}

/* ========= Start ========= */
restoreDraft();
gotoStep(1);
/* beim ersten Wechsel nach Schritt 1 automatisch Felder bauen, falls noch nicht passiert */
