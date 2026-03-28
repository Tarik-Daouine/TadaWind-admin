import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Gère la session Supabase Auth.
 *
 * session === undefined  → chargement initial (Supabase lit le localStorage)
 * session === null       → non authentifié
 * session === { user }   → authentifié
 */
export function useAuth() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // 1. Récupère la session existante dès le démarrage
    //    (Supabase la persiste automatiquement dans localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    // 2. Écoute tous les changements d'état :
    //    login, logout, expiration du token, refresh automatique
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Connexion email / mot de passe
   * @returns {{ error: AuthError | null }}
   */
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  /**
   * Déconnexion — onAuthStateChange mettra session à null automatiquement
   */
  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    session,
    user: session?.user ?? null,
    signIn,
    signOut,
    loading: session === undefined, // true uniquement pendant la lecture initiale du localStorage
  }
}
