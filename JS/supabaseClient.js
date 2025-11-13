// JS/supabaseClient.js
// Wichtig: In deinen HTML-Seiten muss vorher
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// geladen werden, damit window.supabase existiert.

const SUPABASE_URL = "https://iytlubroxcrllidxmeql.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dGx1YnJveGNybGxpZHhtZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjgzMDAsImV4cCI6MjA3NzMwNDMwMH0.phtEz5l3BXF6BQjwuryPBDvBRg2_pU01aQD2OvWnXxc";

// Sicherheitscheck:
if (!window.supabase) {
  console.error("Supabase JS-Bibliothek (cdn.jsdelivr) wurde nicht geladen.");
  throw new Error("Supabase Library missing");
}

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// optional: damit du in der Konsole testen kannst
window.supabaseClient = supabase;
console.log("[supabaseClient] Supabase-Client initialisiert");
