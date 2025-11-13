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

async function createRoom({ gameName, hostName, maxPlayers, pin, initialState }) {
  const code = generateRoomCode(4);

  const payload = {
    code,
    game_name: gameName || "Quiz",
    host_name: hostName || "Host",
    max_players: maxPlayers || 4,
    pin: pin || null,
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
  const room = await getRoom(code);

  if (room.pin && room.pin !== pin) {
    throw new Error("Falsche PIN.");
  }

  const players = Array.isArray(room.players) ? room.players.slice() : [];

  if (players.some(p => p.name === playerName)) {
    throw new Error("Name bereits im Raum.");
  }

  if (players.length >= room.max_players) {
    throw new Error("Raum ist voll.");
  }

  players.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: playerName,
    score: 0,
    joined_at: new Date().toISOString(),
  });

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

function openRoomChannel(code, { onState, onPlayers } = {}) {
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
        const newRow = payload.new;
        if (!newRow) return;
        if (onState && newRow.state) onState(newRow.state);
        if (onPlayers && newRow.players) onPlayers(newRow.players);
      }
    )
    .subscribe();

  return {
    async sendState(state) {
      await updateRoomState(code, { state });
    },
    async sendPlayers(players) {
      await updateRoomState(code, { players });
    },
    stop() {
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
