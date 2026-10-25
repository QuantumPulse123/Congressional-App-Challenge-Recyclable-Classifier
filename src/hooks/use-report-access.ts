import { useEffect, useState } from "react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export function useReportAccess() {
  const [access, setAccess] = useState({ signedIn: false, isAdmin: false, loading: isSupabaseConfigured })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    let generation = 0
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++generation
      const signedIn = Boolean(session?.user && !session.user.is_anonymous)
      setAccess({ signedIn, isAdmin: false, loading: signedIn })
      if (!signedIn) return
      // Avoid invoking another Supabase method inside its Auth event callback.
      queueMicrotask(async () => {
        try {
          const { data, error } = await supabase.rpc("is_report_admin")
          if (active && current === generation) setAccess({ signedIn, isAdmin: !error && data === true, loading: false })
        } catch {
          if (active && current === generation) setAccess({ signedIn, isAdmin: false, loading: false })
        }
      })
    })
    return () => { active = false; generation++; subscription.unsubscribe() }
  }, [])
  return access
}
