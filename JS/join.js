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
  // falls du das PIN-Feld nur bei vorgefülltem Code zeigen willst:
  pinWrap.style.display = "block";
}

// Wenn der User anfängt zu tippen, einfach das PIN-Feld anzeigen
// (wir fragen die Info nicht mehr lokal ab, darum: immer zeigen)
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
    // Genau EINMAL joinRoom aufrufen
    const room = await Cloud.joinRoom({ code, playerName: nick, pin });

    // Den tatsächlich verwendeten Namen ermitteln (falls (2), (3) angehängt wurden)
    const normalize = s => (s || "").trim().toLowerCase();
    let effectiveName = nick;
    if (Array.isArray(room.players) && room.players.length) {
      const exact = room.players.find(p => normalize(p.name) === normalize(nick));
      effectiveName = exact?.name || room.players[room.players.length - 1].name || nick;
    }

    // Session-Daten für game.js speichern
    sessionStorage.setItem("quiz:roomCode", code);
    sessionStorage.setItem("quiz:playerName", effectiveName);
    sessionStorage.removeItem("quiz:isHost"); // Sicherheit: Joiner ist nie Host

    // Ab ins Spielfeld
    window.location.href = `game.html?code=${encodeURIComponent(code)}`;
  } catch (err) {
    console.error("Join error:", err);
    alert(err.message || "Beitritt zum Raum fehlgeschlagen.");
  }
});

