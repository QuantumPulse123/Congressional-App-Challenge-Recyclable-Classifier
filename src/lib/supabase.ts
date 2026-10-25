import { createClient } from "@supabase/supabase-js"

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey)

// Keep previews usable when deployment secrets have not been configured.
// The Supabase client validates its URL eagerly, which previously crashed the
// app before React could render its first frame.
const supabaseUrl = configuredUrl || "https://demo.supabase.co"
const supabaseAnonKey = configuredAnonKey || "demo-anon-key"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const REPORT_FIELDS = "id,title,description,category,ai_classification,ai_severity,latitude,longitude,address,status,image_url,created_at"

// Anonymous Auth gives each browser an identity without requiring a sign-up UI.
let sessionRequest: Promise<string> | null = null
export async function ensureReportSession(): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Configure Supabase to submit reports.")
  if (!sessionRequest) {
    sessionRequest = (async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      if (session) return session.user.id
      const { data, error: signInError } = await supabase.auth.signInAnonymously()
      if (signInError) {
        window.dispatchEvent(new Event("ecoreport:sign-in"))
        throw new Error("Please sign in or create an account, then submit your report again.")
      }
      if (!data.user) throw new Error("Unable to start a reporting session.")
      return data.user.id
    })().finally(() => { sessionRequest = null })
  }
  return sessionRequest
}

export type TrashReport = {
  id: string
  title: string
  description: string
  category: string
  ai_classification: string | null
  ai_severity?: "low" | "medium" | "high" | null
  latitude: number
  longitude: number
  address: string | null
  status: "open" | "in_progress" | "resolved"
  image_url: string | null
  created_at: string
}

export const CATEGORIES = [
  { value: "illegal_dumping", label: "Illegal Dumping", color: "#ef4444" },
  { value: "litter", label: "Litter", color: "#f97316" },
  { value: "pollution", label: "Pollution", color: "#8b5cf6" },
  { value: "hazardous_waste", label: "Hazardous Waste", color: "#dc2626" },
  { value: "graffiti", label: "Graffiti", color: "#3b82f6" },
  { value: "other", label: "Other", color: "#6b7280" },
] as const

export function getCategoryColor(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.color ?? "#6b7280"
}

export function getCategoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? "Other"
}
