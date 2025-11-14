// JS/join.js

// Jahr im Footer
document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("join-form");
const codeInput = document.getElementById("code");
const pinWrap = document.getElementById("pin-wrap");
const pinInput = document.getElementById("join-pin");
const nickInput = document.getElementById("nick");

// evtl. Code aus URL vorbefüllen (?code=ABCD)
const params = new URLSearchParams(location.search);
const prefill = params.get("code");
if (prefill) {
  codeInput.value = prefill.toUpperCase();
  codeInput.readOnly = true;
  pinWrap.style.display = "block";
}

// PIN-Feld anzeigen/verstecken
codeInput.addEventListener("input", () => {
  if (codeInput.value.trim().length > 0) {
    pinWrap.style.display = "block";
  } else {
    pinWrap.style.display = "none";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const code = codeInput.value.trim().toUpperCase();
  const nick = nickInput.value.trim();
  const pin  = (pinInput?.value || "").trim() || null;

  if (!code) {
    alert("Bitte einen Raumcode eingeben.");
    return;
  }
  if (!nick) {
    alert("Bitte einen Nicknamen eingeben.");
    return;
  }

  if (!window.Cloud || typeof Cloud.joinRoom !== "function") {
    alert("Online-Funktion nicht verfügbar (Cloud.joinRoom fehlt).");
    return;
  }

  try {
    // EINMAL joinRoom aufrufen
    const room = await Cloud.joinRoom({ code, playerName: nick, pin });

    // Den tatsächlich verwendeten Namen + Player-ID finden
    const normalize = (s) => (s || "").trim().toLowerCase();
    let effectiveName = nick;
    let myPlayerId = null;

    if (Array.isArray(room.players) && room.players.length) {
      // Entweder exakter Match (falls kein "(2)" angehängt wurde)
      const exact = room.players.find(p => normalize(p.name) === normalize(nick));
      // Oder der zuletzt hinzugefügte Spieler (unser Join)
      const chosen = exact || room.players[room.players.length - 1];

      effectiveName = chosen?.name || nick;
      myPlayerId = chosen?.id || null;
    }

    // Session-Infos für game.js speichern
    sessionStorage.setItem("quiz:roomCode", code);
    sessionStorage.setItem("quiz:playerName", effectiveName);
    if (myPlayerId) {
      sessionStorage.setItem("quiz:playerId", myPlayerId);
    }
    sessionStorage.removeItem("quiz:isHost"); // Joiner ist nie Host

    // Ab ins Spielfeld
    window.location.href = `game.html?code=${encodeURIComponent(code)}`;
  } catch (err) {
    console.error("Join error:", err);
    alert(err.message || "Beitritt zum Raum fehlgeschlagen.");
  }
});
