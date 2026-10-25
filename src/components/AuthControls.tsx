import { useEffect, useState, type FormEvent } from "react"
import type { User } from "@supabase/supabase-js"
import { Loader2, LogIn, LogOut } from "lucide-react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AuthControls() {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const showSignIn = () => { setMode("signin"); setError(""); setMessage(""); setOpen(true) }
    window.addEventListener("ecoreport:sign-in", showSignIn)
    return () => { subscription.unsubscribe(); window.removeEventListener("ecoreport:sign-in", showSignIn) }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isSupabaseConfigured || busy) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: "https://www.google.com/" },
        })
        if (authError) throw authError
        if (data.session) setOpen(false)
        else {
          setMessage("Check your email and click the verification link. It opens Google after verification. Then return here and sign in with your email and password.")
          setMode("signin")
        }
        setPassword("")
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        setOpen(false)
        setPassword("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.")
    } finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    setError("")
    try {
      const { error: authError } = await supabase.auth.signOut({ scope: "local" })
      if (authError) throw authError
      setUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out.")
      setOpen(true)
    } finally { setBusy(false) }
  }

  const signedIn = user && !user.is_anonymous
  return (
    <>
      {signedIn ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={signOut} title={`Signed in as ${user.email ?? "member"}`}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Sign out
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={loading || busy} onClick={() => { setMode("signin"); setError(""); setMessage(""); setOpen(true) }}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Sign in
        </Button>
      )}
      <Dialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); if (!value) setPassword("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{mode === "signin" ? "Sign in to EcoReport" : "Create an account"}</DialogTitle>
            <DialogDescription>{mode === "signin" ? "Sign in with your email and password." : "We'll email you a link to verify your email address."}</DialogDescription>
          </DialogHeader>
          {!isSupabaseConfigured ? <p role="alert" className="text-sm text-destructive">Add your Supabase URL and public key to .env.local to enable sign-in.</p> : (
            <form onSubmit={submit} className="space-y-4">
              {signedIn && <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>}
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input id="auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
                {mode === "signup" && <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>}
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {message && <p role="status" className="text-sm text-primary">{message}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}{mode === "signin" ? "Sign in" : "Create account"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); setPassword("") }}>
                {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
