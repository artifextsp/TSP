// Rellena estas constantes con tu proyecto


// js/supabaseClient.js
// --- Cliente ESM de Supabase, exportado en forma "named" y "default" ---

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ⬇️ Pega aquí TUS valores reales (los que ya usabas antes)
const SUPABASE_URL = "https://kryqjsncqsopjuwymhqd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y";

/* Si prefieres leerlos desde otro lado, puedes:
   - window.TSP_SUPABASE_URL  / window.TSP_SUPABASE_KEY
   - localStorage.getItem('tsp_supabase') con {url,key}
   pero con ponerlos en las constantes de arriba basta.
*/

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Compatibilidad: también lo exporto por defecto
export default supabase;

