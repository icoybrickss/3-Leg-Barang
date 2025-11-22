import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client from Vite env vars. Add these to your .env.local:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default supabase;
