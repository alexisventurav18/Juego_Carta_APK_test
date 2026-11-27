import { createClient } from '@supabase/supabase-js';

// Si faltan las variables en el build (por ejemplo un APK compilado sin .env),
// createClient lanzaría un error al importar y la app quedaría en blanco.
// Con valores de relleno la app abre y solo falla el modo online, con un mensaje de error.
// Fuera de Vite (p. ej. pruebas con tsx) import.meta.env no existe: se usa el relleno.
const url = import.meta.env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export const supabase = createClient(url, anonKey, {
  auth: {
    // PKCE: el inicio con Google/Facebook devuelve un `code` que se canjea
    // con un verificador guardado en local; el token nunca viaja en la URL.
    // Sin esto el cliente usaría el flujo implícito (token en el fragmento).
    flowType: 'pkce',
  },
});
