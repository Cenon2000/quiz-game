// JS/cloud.js
import { supabase } from "./supabaseClient.js";

/* ========= QUIZZES ========= */

async function saveQuizToCloud(quiz) {
  const payload = {
    title: quiz.title || "Ohne Titel",
    data: quiz,
    author: quiz.author || null,
  };

  const { data, error } = await supabase
    .from("quizzes")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("saveQuizToCloud error:", error);
    throw new Error("Quiz konnte nicht gespeichert werden.");
  }

  return data.id;
}

async function listQuizzes() {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, author, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listQuizzes error:", error);
    throw new Error("Quizzes konnten nicht geladen werden.");
  }

  return data || [];
}

async function loadQuizById(id) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, data, author, created_at")
    .eq("id", id)
    .single();

  if (error) {
    console.error("loadQuizById error:", error);
    throw new Error("Quiz konnte nicht geladen werden.");
  }

  return data.data || data;
}

/* ========= ROOMS (Kurzfassung) ========= */

function generateRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function createRoom({ gameName, hostName, maxPlayers, pin, quizId, quizTitle, initialState }) {
  const code = generateRoomCode(4);

  const payload = {
    code,
    game_name: gameName || "Quiz",
    host_name: hostName || "Host",
    max_players: maxPlayers || 4,
    pin: pin || null,
    quiz_id: quizId || null,          // <---
    quiz_title: quizTitle || null,    // <--- optional
    state: initialState || {},
    players: [],
    status: "open",
  };

  const { data, error } = await supabase
    .from("rooms")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("createRoom error:", error);
    throw new Error("Raum konnte nicht erstellt werden.");
  }

  return data;
}



async function getRoom(code) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .single();

  if (error) {
    console.error("getRoom error:", error);
    throw new Error("Raum nicht gefunden.");
  }

  return data;
}

async function joinRoom({ code, playerName, pin }) {
  // 1) Raum laden
  const room = await getRoom(code);

  // 2) PIN prüfen (falls gesetzt)
  if (room.pin && room.pin !== pin) {
    throw new Error("Falsche PIN.");
  }

  // 3) Bisherige Spieler kopieren
  const players = Array.isArray(room.players) ? room.players.slice() : [];

  // 4) Namen normalisieren + leere Namen abfangen
  const normalize = (s) => (s || "").trim().toLowerCase();
  let name = (playerName || "").trim();
  if (!name) {
    name = "Spieler";
  }

  // 5) Wenn Name schon existiert → automatisch durchnummerieren
  if (players.some(p => normalize(p.name) === normalize(name))) {
    const base = name;
    let n = 2;
    let candidate = `${base} (${n})`;
    while (players.some(p => normalize(p.name) === normalize(candidate))) {
      n++;
      candidate = `${base} (${n})`;
    }
    name = candidate;
  }

  // 6) Neuen Spieler eintragen
  players.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    score: 0,
    joined_at: new Date().toISOString(),
  });

  // 7) Room aktualisieren
  const { data, error } = await supabase
    .from("rooms")
    .update({ players })
    .eq("code", code)
    .select("*")
    .single();

  if (error) {
    console.error("joinRoom error:", error);
    throw new Error("Konnte dem Raum nicht beitreten.");
  }

  return data;
}


async function updateRoomState(code, patch) {
  const { data, error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("code", code)
    .select("*")
    .single();

  if (error) {
    console.error("updateRoomState error:", error);
    throw new Error("Raum konnte nicht aktualisiert werden.");
  }

  return data;
}

/* ========= Realtime (optional, minimal) ========= */

// Realtime für einen Raum-Code
function openRoomChannel(code, { onState, onPlayers } = {}) {
  console.log("[Cloud] openRoomChannel für Room", code);

  // 1) Realtime-Channel abonnieren: hört auf Änderungen an der Tabelle 'rooms'
  const channel = supabase
    .channel(`room:${code}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rooms",
        filter: `code=eq.${code}`,
      },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        console.log("[Cloud] Realtime-Update für Room", code, row);

        if (onState && row.state) {
          onState(row.state);
        }
        if (onPlayers && row.players) {
          onPlayers(row.players);
        }
      }
    )
    .subscribe((status) => {
      console.log("[Cloud] Realtime-Status für Room", code, status);
    });

  // 2) Objekt zurückgeben, das game.js zum Senden benutzt
  return {
    async sendState(state) {
      console.log("[Cloud] sendState", state);
      await updateRoomState(code, { state });
    },
    async sendPlayers(players) {
      console.log("[Cloud] sendPlayers", players);
      await updateRoomState(code, { players });
    },
    stop() {
      console.log("[Cloud] Channel schließen für Room", code);
      supabase.removeChannel(channel);
    },
  };
}


/* ========= Export ========= */

const Cloud = {
  saveQuizToCloud,
  listQuizzes,
  loadQuizById,
  createRoom,
  getRoom,
  joinRoom,
  updateRoomState,
  openRoomChannel,
};

console.log("[Cloud] initialisiert", Cloud);

export default Cloud;
export {
  saveQuizToCloud,
  listQuizzes,
  loadQuizById,
  createRoom,
  getRoom,
  joinRoom,
  updateRoomState,
  openRoomChannel,
};
