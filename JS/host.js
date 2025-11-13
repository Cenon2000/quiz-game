// JS/host.js

// Jahr im Footer
document.getElementById("year").textContent = new Date().getFullYear();

const form       = document.getElementById("host-form");
const lobbyView  = document.getElementById("lobby-view");
const codeEl     = document.getElementById("lobby-code");
const copyBtn    = document.getElementById("copy-code");
const inviteLink = document.getElementById("invite-link");
const quizSelect = document.getElementById("quizSelect");

// --- Quizzes aus Supabase laden und Dropdown füllen ---
async function loadQuizzesIntoSelect() {
  if (!window.Cloud || !Cloud.listQuizzes) {
    console.error("Cloud API nicht verfügbar (listQuizzes).");
    return;
  }

  quizSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Bitte ein Quiz auswählen...";
  placeholder.disabled = true;
  placeholder.selected = true;
  quizSelect.appendChild(placeholder);

  try {
    const quizzes = await Cloud.listQuizzes();
    quizzes.forEach(q => {
      const opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent = q.title || "(Ohne Titel)";
      quizSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Quizzes:", err);
    alert("Quizzes konnten nicht geladen werden. Bitte später erneut versuchen.");
  }
}

// direkt beim Laden ausführen
loadQuizzesIntoSelect();

// --- Formular-Submit: Raum in Supabase anlegen ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const gameName   = String(data.get("gameName") || "").trim();
  const hostName   = String(data.get("nickname") || "").trim();
  const maxPlayers = Number(data.get("maxPlayers")) || 2;
  const pin        = String(data.get("pin") || "").trim() || null;

  const selectedQuizId = quizSelect.value;
  if (!selectedQuizId) {
    alert("Bitte ein Quiz auswählen.");
    return;
  }

  if (!gameName || !hostName || maxPlayers < 2) {
    alert("Bitte alle Pflichtfelder prüfen.");
    return;
  }

  if (!window.Cloud || !Cloud.createRoom) {
    alert("Cloud API nicht verfügbar.");
    return;
  }

  try {
    // initialer Spielzustand, inkl. gewähltem Quiz
    const initialState = {
      phase: "lobby",
      boardIndex: 0,
      currentCell: null,
      used: [],
      quizId: selectedQuizId,
    };

    const room = await Cloud.createRoom({
      gameName,
      hostName,
      maxPlayers,
      pin,
      initialState,
    });

    // Host-Infos lokal merken (für game.js, um Host/Spieler zu unterscheiden)
    localStorage.setItem("quiz:roomCode", room.code);
    localStorage.setItem("quiz:playerName", hostName);
    localStorage.setItem("quiz:isHost", "1");

    // Code und Invite-Link anzeigen
    codeEl.textContent = room.code;

    const link = new URL(location.origin + location.pathname.replace("host.html", "join.html"));
    link.searchParams.set("code", room.code);
    inviteLink.href = link.toString();

    form.style.display = "none";
    lobbyView.style.display = "block";
  } catch (err) {
    console.error("Fehler beim Erstellen des Raums:", err);
    alert(err.message || "Raum konnte nicht erstellt werden. Bitte später erneut versuchen.");
  }
});

// --- Kopieren-Button ---
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(codeEl.textContent.trim());
    copyBtn.textContent = "Kopiert!";
    setTimeout(() => (copyBtn.textContent = "Kopieren"), 1200);
  } catch {
    alert("Kopieren fehlgeschlagen – bitte manuell markieren.");
  }
});
