import { useState, type FormEvent } from "react"
import { CheckCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { CATEGORIES, REPORT_FIELDS, supabase, type TrashReport } from "@/lib/supabase"
import { useReportAccess } from "@/hooks/use-report-access"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Props = { report: TrashReport; onUpdated: (report: TrashReport) => void; onDeleted: (id: string) => void }

export function ReportActions({ report, onUpdated, onDeleted }: Props) {
  const navigate = useNavigate()
  const { signedIn, isAdmin, loading } = useReportAccess()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const [draft, setDraft] = useState({ title: report.title, description: report.description, category: report.category, status: report.status, latitude: String(report.latitude), longitude: String(report.longitude), address: report.address ?? "" })

  async function resolve() {
    if (!signedIn) { window.dispatchEvent(new Event("ecoreport:sign-in")); return }
    setBusy(true)
    setError("")
    try {
      const { data, error: dbError } = await supabase.rpc("resolve_report", { report_id: report.id })
      if (dbError) throw dbError
      if (!data?.id || data.status !== "resolved") throw new Error("The report could not be resolved. Refresh and try again.")
      onUpdated(data as TrashReport)
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to resolve report. Check your sign-in and Supabase setup.") }
    finally { setBusy(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isAdmin || busy) return
    const latitude = Number(draft.latitude), longitude = Number(draft.longitude)
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { setError("Enter valid latitude and longitude."); return }
    setBusy(true)
    setError("")
    try {
      const { data, error: dbError } = await supabase.from("trash_reports").update({
        title: draft.title.trim(), description: draft.description.trim(), category: draft.category,
        status: draft.status, latitude, longitude, address: draft.address.trim() || null,
      }).eq("id", report.id).select(REPORT_FIELDS).single()
      if (dbError) throw dbError
      onUpdated(data as TrashReport)
      setDialog(null)
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save report. Check admin access and Supabase setup.") }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!isAdmin || busy) return
    setBusy(true)
    setError("")
    try {
      const { error: dbError } = await supabase.from("trash_reports").delete().eq("id", report.id).select("id").single()
      if (dbError) throw dbError
      setDialog(null)
      onDeleted(report.id)
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete report. Check admin access and Supabase setup.") }
    finally { setBusy(false) }
  }

  return <div className="mt-3 space-y-2 border-t pt-3">
    {isAdmin && <p className="text-xs font-semibold text-primary">Admin controls</p>}
    <div className="flex flex-wrap gap-2">
      {report.status !== "resolved" ? <Button size="sm" disabled={busy || loading} onClick={resolve}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}{signedIn ? "Resolve" : "Sign in to resolve"}
      </Button> : <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle className="size-4" />Resolved</span>}
      {isAdmin && <>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => {
          setDraft({ title: report.title, description: report.description, category: report.category, status: report.status, latitude: String(report.latitude), longitude: String(report.longitude), address: report.address ?? "" })
          setError(""); setDialog("edit")
        }}><Pencil className="size-4" />Edit</Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setError(""); setDialog("delete") }}><Trash2 className="size-4" />Delete</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => navigate("/report")}><Plus className="size-4" />Add report</Button>
      </>}
    </div>
    {error && !dialog && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !busy) setDialog(null) }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialog === "delete" ? "Delete this report?" : "Edit report"}</DialogTitle>
          <DialogDescription>{dialog === "delete" ? `Remove “${report.title}” from the map and feed. This cannot be undone.` : "Update the report details, location, or status."}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {dialog === "delete" ? <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="destructive" disabled={busy || !isAdmin} onClick={remove}>{busy && <Loader2 className="size-4 animate-spin" />}Delete report</Button>
        </div> : <form onSubmit={save} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="edit-title">Title</Label><Input id="edit-title" required maxLength={160} value={draft.title} disabled={busy} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" required maxLength={5000} value={draft.description} disabled={busy} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-category">Category</Label><select id="edit-category" className="w-full rounded-md border bg-background p-2 text-sm" value={draft.category} disabled={busy} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="edit-status">Status</Label><select id="edit-status" className="w-full rounded-md border bg-background p-2 text-sm" value={draft.status} disabled={busy} onChange={(e) => setDraft({ ...draft, status: e.target.value as TrashReport["status"] })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="edit-latitude">Latitude</Label><Input id="edit-latitude" type="number" step="any" min={-90} max={90} required value={draft.latitude} disabled={busy} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="edit-longitude">Longitude</Label><Input id="edit-longitude" type="number" step="any" min={-180} max={180} required value={draft.longitude} disabled={busy} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="edit-address">Address (optional)</Label><Input id="edit-address" value={draft.address} disabled={busy} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={busy || !isAdmin}>{busy && <Loader2 className="size-4 animate-spin" />}Save changes</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </div>
}
