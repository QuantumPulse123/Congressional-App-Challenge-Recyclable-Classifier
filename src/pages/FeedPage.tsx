import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

import { supabase, REPORT_FIELDS, type TrashReport, getCategoryColor, getCategoryLabel, isSupabaseConfigured } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty"

const STATUS_ICONS = {
  open: <AlertCircle className="size-3" />,
  in_progress: <Loader2 className="size-3 animate-spin" />,
  resolved: <CheckCircle className="size-3" />,
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  resolved: "secondary",
}

function ReportCard({ report }: { report: TrashReport }) {
  const timeAgo = React.useMemo(() => {
    const diff = Date.now() - new Date(report.created_at).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }, [report.created_at])

  return (
    <div className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0">
      {/* Category dot */}
      <div
        className="mt-1 size-3 shrink-0 rounded-full"
        style={{ backgroundColor: getCategoryColor(report.category) }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-foreground leading-tight line-clamp-1">{report.title}</p>
          <Badge variant={STATUS_VARIANTS[report.status] ?? "outline"} className="flex items-center gap-1 shrink-0 text-[10px]">
            {STATUS_ICONS[report.status as keyof typeof STATUS_ICONS]}
            {report.status.replace("_", " ")}
          </Badge>
        </div>

        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{report.description}</p>
        {report.image_url && <img src={report.image_url} alt={`Photo for ${report.title}`} loading="lazy" className="mt-2 h-36 w-full rounded-md object-cover" />}

        {report.ai_classification && (
          <p className="mt-1.5 text-xs text-primary/80 line-clamp-1 italic">
            AI: {report.ai_classification}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white text-[10px] font-medium"
            style={{ backgroundColor: getCategoryColor(report.category) }}
          >
            {getCategoryLabel(report.category)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {timeAgo}
          </span>
        </div>
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-4">
      <Skeleton className="mt-1 size-3 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export default function FeedPage() {
  const navigate = useNavigate()
  const [reports, setReports] = React.useState<TrashReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    async function fetchReports() {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }

      try {
        const { data, error: loadError } = await supabase
          .from("trash_reports")
          .select(REPORT_FIELDS)
          .order("created_at", { ascending: false })
          .limit(50)
        if (loadError) throw loadError
        if (data) setReports(data as TrashReport[])
      } catch {
        setError("Unable to load reports. Check your connection and Supabase setup, then reload.")
      } finally { setLoading(false) }
    }
    fetchReports()
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div>
          <h1 className="font-semibold text-foreground">Community Reports</h1>
          {!loading && (
            <p className="text-xs text-muted-foreground">{reports.length} total reports</p>
          )}
        </div>
        <Button size="sm" onClick={() => navigate("/report")} className="gap-1.5">
          <Plus className="size-3.5" />
          Report
        </Button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {error ? <p role="alert" className="p-4 text-sm text-destructive">{error}</p> : loading ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => <ReportSkeleton key={i} />)}
          </>
        ) : reports.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircle />
                </EmptyMedia>
                <EmptyTitle>No reports yet</EmptyTitle>
                <EmptyDescription>
                  Be the first to report an environmental issue in your community.
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => navigate("/report")}>
                <Plus className="size-4" />
                Make a Report
              </Button>
            </Empty>
          </div>
        ) : (
          reports.map((report) => <ReportCard key={report.id} report={report} />)
        )}
      </div>
    </div>
  )
}
