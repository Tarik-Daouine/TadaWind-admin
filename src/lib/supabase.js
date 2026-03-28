import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Variables manquantes dans .env\n' +
    'Requis : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY'
  )
}

// Singleton — instancié une seule fois pour toute l'app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
