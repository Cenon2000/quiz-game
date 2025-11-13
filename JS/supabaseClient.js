// JS/supabaseClient.js
import { createClient } from "https://@supabase/supabase-js";

const SUPABASE_URL = "https://iytlubroxcrllidxmeql.supabase.co"; // <-- anpassen
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dGx1YnJveGNybGxpZHhtZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjgzMDAsImV4cCI6MjA3NzMwNDMwMH0.phtEz5l3BXF6BQjwuryPBDvBRg2_pU01aQD2OvWnXxc";                            // <-- anpassen

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabase = supabase;