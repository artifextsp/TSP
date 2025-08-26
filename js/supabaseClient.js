// Rellena estas constantes con tu proyecto



// js/supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* Usa tus credenciales reales */
export const SUPABASE_URL = "https://kryqjsncqsopjuwymhqd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export default supabase;

