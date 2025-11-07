// login.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// === CONFIGURACIÓN SUPABASE (100% TU PROYECTO) ===
const SUPABASE_URL = 'https://rxqiimwqlisnurgmtmtw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cWlpbXdxbGlzbnVyZ210bXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MjcyNzcsImV4cCI6MjA3NzAwMzI3N30.meJx3YvbvwQJHvfLs52DZ9LppSJIVbBvyAVPqJfi9wg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === HASH SHA-256 (mejor que texto plano) ===
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// === LOGIN ===
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  errorEl.textContent = '';
  errorEl.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Ingresando...';

  try {
    // 1. Buscar estudiante por email
    const { data: estudiante, error } = await supabase
      .from('estudiantes')
      .select('codigo_estudiante, nombre, apellidos, email, password, activo')
      .eq('email', email)
      .single();

    if (error || !estudiante) {
      throw new Error('Email no registrado');
    }

    // 2. Verificar cuenta activa
    if (estudiante.activo === false) {
      throw new Error('Cuenta desactivada. Contacta al administrador.');
    }

    // 3. Verificar contraseña
    const hashedInput = await hashPassword(password);

    // Si tus contraseñas están en texto plano (como 'TSP2025'), usa esto temporalmente:
    // if (estudiante.password !== password) throw new Error('Contraseña incorrecta');

    // Con hash SHA-256 (recomendado):
    if (estudiante.password !== hashedInput) {
      throw new Error('Contraseña incorrecta');
    }

    // 4. Guardar sesión
    const userSession = {
      codigo_estudiante: estudiante.codigo_estudiante,
      nombre: estudiante.nombre,
      apellidos: estudiante.apellidos,
      email: estudiante.email,
      loggedIn: true,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('thinkingSkillsUser', JSON.stringify(userSession));

    // 5. Redirigir
    alert(`¡Bienvenido, ${estudiante.nombre}!`);
    window.location.href = 'dashboard.html';

  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ingresar';
  }
});