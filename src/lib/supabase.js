import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client from Vite env vars. Add these to your .env.local:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// In development use a same-origin proxy path (`/supabase`) so the browser
// doesn't hit the Supabase domain directly and trigger CORS preflight
// issues. Vite's dev server will proxy `/supabase` to the real project URL.
// `createClient` requires a valid absolute URL (http/https). Use the
// current origin + `/supabase` in DEV so the value is valid and will be
// proxied by Vite to the real Supabase project URL.
const baseUrl = import.meta.env.DEV ? `${location.origin}/supabase` : import.meta.env.VITE_SUPABASE_URL;

export const supabase = createClient(
  baseUrl,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default supabase;
