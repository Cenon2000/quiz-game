// JS/host.js

// Jahr im Footer
document.getElementById("year").textContent = new Date().getFullYear();

const form       = document.getElementById("host-form");
const lobbyView  = document.getElementById("lobby-view");
const codeEl     = document.getElementById("lobby-code");
const copyBtn    = document.getElementById("copy-code");
const inviteLink = document.getElementById("invite-link");
const quizSelect = document.getElementById("quizSelect");
const startBtn  = document.getElementById("btn-start-game");


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

  const gameName   = document.getElementById("gameName").value.trim();
  const nickname   = document.getElementById("nickname").value.trim();
  const maxPlayers = parseInt(document.getElementById("maxPlayers").value, 10) || 4;
  const pin        = document.getElementById("pin").value.trim() || null;

  // === Quiz-ID aus dem <select id="quizSelect"> holen ===
  const quizId = quizSelect.value || null;
  const quizTitle = quizSelect.selectedOptions[0]?.textContent?.trim() || "";

  if (!quizId) {
    alert("Bitte zuerst ein Quiz auswählen.");
    return;
  }

  if (!gameName || !nickname || maxPlayers < 2) {
    alert("Bitte alle Pflichtfelder prüfen.");
    return;
  }

  try {
    const room = await Cloud.createRoom({
      gameName,
      hostName: nickname,
      maxPlayers,
      pin,
      quizId,
      quizTitle,
      initialState: {
        phase: "lobby",
        boardIndex: 0,
        used: [],
        currentCell: null,
        quizId,   // optional auch im state merken
      },
    });

    // Host-Daten für game.js merken (du nutzt sessionStorage)
    sessionStorage.setItem("quiz:roomCode", room.code);
    sessionStorage.setItem("quiz:isHost", "1");
    sessionStorage.setItem("quiz:playerName", nickname);

    // Lobby-Ansicht mit Code + Link anzeigen
    codeEl.textContent = room.code;
    const link = new URL(location.origin + location.pathname.replace("host.html","join.html"));
    link.searchParams.set("code", room.code);
    inviteLink.href = link.toString();

    form.style.display = "none";
    lobbyView.style.display = "block";

    if (startBtn) {
    startBtn.onclick = () => {
      const code = room.code;
      window.location.href = `game.html?code=${encodeURIComponent(code)}&host=1`;
    };
  }

  } catch (err) {
    console.error("Fehler beim Erstellen des Raums:", err);
    alert(err.message || "Raum konnte nicht erstellt werden.");
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

async function onHostFormSubmit(evt) {
  evt.preventDefault();

  const gameName   = gameNameInput.value.trim();
  const nickname   = nicknameInput.value.trim();
  const maxPlayers = parseInt(maxPlayersInput.value, 10) || 4;
  const pin        = pinInput.value.trim() || null;

  // === Quiz-ID ermitteln ===
  // Variante A: <select id="quizSelect">...</select>
  const quizSelect = document.getElementById("quizSelect");
  let quizId = null;
  let quizTitle = "";

  if (quizSelect) {
    quizId = quizSelect.value || null;
    quizTitle = quizSelect.selectedOptions[0]?.textContent?.trim() || "";
  } else {
    // Variante B: Radio-Buttons: <input type="radio" name="quizId" value="...">
    const checked = document.querySelector('input[name="quizId"]:checked');
    if (checked) {
      quizId = checked.value;
      // Titel aus einem data-Attribut oder Nachbar-Element holen, falls du sowas hast
      quizTitle = checked.dataset.title || checked.getAttribute("data-title") || "";
    }
  }

  if (!quizId) {
    alert("Bitte zuerst ein Quiz auswählen.");
    return;
  }

  try {
    const room = await Cloud.createRoom({
      gameName,
      hostName: nickname,
      maxPlayers,
      pin,
      quizId,
      quizTitle,
      initialState: {
        phase: "lobby",
        boardIndex: 0,
        used: [],
        currentCell: null,
        quizId,   // optional auch im state merken
      },
    });

    // Host-Metadaten merken (du nutzt sessionStorage)
    sessionStorage.setItem("quiz:roomCode", room.code);
    sessionStorage.setItem("quiz:isHost", "1");
    sessionStorage.setItem("quiz:playerName", nickname);

    // Direkt ins Spiel
    window.location.href = `game.html?code=${encodeURIComponent(room.code)}&host=1`;
  } catch (err) {
    console.error("Fehler beim Erstellen des Raums:", err);
    alert(err.message || "Raum konnte nicht erstellt werden.");
  }
}


