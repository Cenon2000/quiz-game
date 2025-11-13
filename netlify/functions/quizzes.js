// /netlify/functions/quizzes.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Optional: sehr einfache CORS
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // GET: Liste der Quizzes
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...cors }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: { "Content-Type": "application/json", ...cors }
    });
  }

  // POST: neues Quiz speichern
  if (req.method === "POST") {
    try {
      const payload = await req.json(); // { title, boards, created_by? }
      if (!payload?.title || !payload?.boards) {
        return new Response(JSON.stringify({ error: "title & boards erforderlich" }), {
          status: 400, headers: { "Content-Type": "application/json", ...cors }
        });
      }

      const { data, error } = await supabase
        .from("quizzes")
        .insert({
          title: payload.title,
          boards: payload.boards,
          created_by: payload.created_by || null
        })
        .select("id, title, created_at")
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...cors }
        });
      }

      return new Response(JSON.stringify(data), {
        status: 201, headers: { "Content-Type": "application/json", ...cors }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || "invalid JSON" }), {
        status: 400, headers: { "Content-Type": "application/json", ...cors }
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404, headers: { "Content-Type": "application/json", ...cors }
  });
};
