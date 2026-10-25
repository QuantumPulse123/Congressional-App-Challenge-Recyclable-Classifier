import * as React from "react"
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet"
import { useNavigate } from "react-router-dom"
import { MapPin, Plus, RefreshCw, Filter, Layers } from "lucide-react"
import "leaflet/dist/leaflet.css"

import {
  supabase,
  REPORT_FIELDS,
  type TrashReport,
  getCategoryColor,
  getCategoryLabel,
  CATEGORIES,
  isSupabaseConfigured,
} from "@/lib/supabase"
import {
  lookupWatershedAtPoint,
  type WatershedInfo,
} from "@/lib/watershed"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ReportActions } from "@/components/ReportActions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

/** Recenter the map when the browser successfully provides the user's location. */
function LocationRecenter({ coords }: { coords: [number, number] }) {
  const map = useMap()

  React.useEffect(() => {
    map.setView(coords, 13)
  }, [coords, map])

  return null
}

type WatershedLookupState =
  | { reportId: string; status: "loading" }
  | { reportId: string; status: "loaded"; data: WatershedInfo }
  | { reportId: string; status: "not-found" }
  | { reportId: string; status: "error" }

const STATUS_COLORS: Record<string, string> = {
  open: "bg-destructive text-white",
  in_progress: "bg-yellow-500 text-white",
  resolved: "bg-green-600 text-white",
}

const WATERSHED_WMS_URL =
  "https://hydro.nationalmap.gov/arcgis/services/wbd/MapServer/WMSServer"

// Temporary sample reports for testing Watershed Lens.
// These are fictional and are not real environmental incidents.
const MOCK_REPORTS: TrashReport[] = [
  {
    id: "demo-ellicott-litter",
    title: "DEMO ONLY: Litter near Ellicott City",
    description: "Synthetic report for testing watershed lookups.",
    category: "litter",
    ai_classification: "DEMO DATA — not a real incident.",
    latitude: 39.2673,
    longitude: -76.7983,
    address: "Ellicott City, Maryland",
    status: "open",
    image_url: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-columbia-pollution",
    title: "DEMO ONLY: Possible runoff near Columbia",
    description: "Synthetic report for testing watershed lookups.",
    category: "pollution",
    ai_classification: "DEMO DATA — not a real incident.",
    latitude: 39.2037,
    longitude: -76.8610,
    address: "Columbia, Maryland",
    status: "in_progress",
    image_url: null,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-annapolis-dumping",
    title: "DEMO ONLY: Dumping report near Annapolis",
    description: "Synthetic report for testing watershed lookups.",
    category: "illegal_dumping",
    ai_classification: "DEMO DATA — not a real incident.",
    latitude: 38.9784,
    longitude: -76.4922,
    address: "Annapolis, Maryland",
    status: "open",
    image_url: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-baltimore-hazard",
    title: "DEMO ONLY: Sample waste report in Baltimore",
    description: "Synthetic report for testing map filters and statuses.",
    category: "hazardous_waste",
    ai_classification: "DEMO DATA — not a real incident.",
    latitude: 39.2904,
    longitude: -76.6122,
    address: "Baltimore, Maryland",
    status: "resolved",
    image_url: null,
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
]

export default function MapPage() {
  const navigate = useNavigate()
  const [reports, setReports] = React.useState<TrashReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const [userLocation, setUserLocation] = React.useState<[number, number] | null>(null)
  const [activeFilters, setActiveFilters] = React.useState<Set<string>>(new Set())
  const [selectedReport, setSelectedReport] = React.useState<TrashReport | null>(null)
  const [watershedLens, setWatershedLens] = React.useState(false)
  const [watershedLookup, setWatershedLookup] =
    React.useState<WatershedLookupState | null>(null)

  // Default to central Maryland if location permission is unavailable.
  const defaultCenter: [number, number] = [39.15, -76.75]

  async function fetchReports() {
    setLoading(true)
    setLoadError("")

    try {
      if (!isSupabaseConfigured) {
        setReports(MOCK_REPORTS)
        setSelectedReport(null)
        return
      }

      const { data, error } = await supabase
        .from("trash_reports")
        .select(REPORT_FIELDS)
        .order("created_at", { ascending: false })
        .limit(500)

      if (error) {
        throw error
      }

      if (data) {
        const nextReports = data as TrashReport[]
        setReports(nextReports)

        // Avoid keeping a selected card open for a report that no longer exists
        // in the refreshed result set.
        setSelectedReport((current) => {
          if (!current) return null
          return nextReports.find((report) => report.id === current.id) ?? null
        })
      }
    } catch {
      setLoadError("Unable to load reports. Check your connection and Supabase setup, then refresh.")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void fetchReports()

    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => undefined,
      { timeout: 5000 }
    )
    // Fetch once on mount. The refresh button calls fetchReports directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!watershedLens || !selectedReport) {
      setWatershedLookup(null)
      return
    }

    const controller = new AbortController()
    const report = selectedReport

    setWatershedLookup({
      reportId: report.id,
      status: "loading",
    })

    lookupWatershedAtPoint(
      report.latitude,
      report.longitude,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) return

        setWatershedLookup(
          data
            ? {
                reportId: report.id,
                status: "loaded",
                data,
              }
            : {
                reportId: report.id,
                status: "not-found",
              }
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error("Unable to look up watershed:", error)
        setWatershedLookup({
          reportId: report.id,
          status: "error",
        })
      })

    return () => controller.abort()
  }, [watershedLens, selectedReport])

  const filteredReports =
    activeFilters.size === 0
      ? reports
      : reports.filter((report) => activeFilters.has(report.category))

  function toggleFilter(value: string) {
    setActiveFilters((previous) => {
      const next = new Set(previous)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const center = userLocation ?? defaultCenter
  const currentWatershedLookup: WatershedLookupState | null =
    selectedReport && watershedLookup?.reportId === selectedReport.id
      ? watershedLookup
      : null

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <div className="z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-5 shrink-0 text-primary" />
          <span className="font-semibold text-foreground">Community Map</span>
          {!loading && (
            <Badge variant="secondary" className="text-xs">
              {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative size-8"
                aria-label="Filter reports by category"
              >
                <Filter className="size-4" />
                {activeFilters.size > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {activeFilters.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CATEGORIES.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.value}
                  checked={activeFilters.has(category.value)}
                  onCheckedChange={() => toggleFilter(category.value)}
                >
                  <span
                    className="mr-2 inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.label}
                </DropdownMenuCheckboxItem>
              ))}
              {activeFilters.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setActiveFilters(new Set())}
                    className="text-muted-foreground"
                  >
                    Clear filters
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant={watershedLens ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 px-2"
            aria-pressed={watershedLens}
            title="Toggle Watershed Lens"
            onClick={() => setWatershedLens((enabled) => !enabled)}
          >
            <Layers className="size-4" />
            <span>Lens</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => void fetchReports()}
            disabled={loading}
            aria-label="Refresh reports"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Map */}
      {loadError && <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">{loadError}</p>}
      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={userLocation ? 13 : 10}
          className="h-full w-full"
          style={{ zIndex: 0 }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {watershedLens && (
            <WMSTileLayer
              url={WATERSHED_WMS_URL}
              layers="0"
              styles=""
              format="image/png"
              transparent
              version="1.1.1"
              opacity={0.65}
              zIndex={350}
              attribution='Watershed boundaries: <a href="https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer" target="_blank" rel="noreferrer">USGS Watershed Boundary Dataset</a>'
            />
          )}

          {userLocation && <LocationRecenter coords={userLocation} />}

          {/* User location marker */}
          {userLocation && (
            <CircleMarker
              center={userLocation}
              radius={8}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#3b82f6",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
          )}

          {/* Report markers */}
          {filteredReports.map((report) => (
            <CircleMarker
              key={report.id}
              center={[Number(report.latitude), Number(report.longitude)]}
              radius={10}
              pathOptions={{
                color: getCategoryColor(report.category),
                fillColor: getCategoryColor(report.category),
                fillOpacity: 0.85,
                weight: 2,
              }}
              eventHandlers={{
                click: () => setSelectedReport(report),
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="text-sm font-semibold">{report.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {getCategoryLabel(report.category)}
                  </p>
                  {report.ai_classification && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {report.ai_classification}
                    </p>
                  )}
                  <span
                    className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[report.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {report.status.replace("_", " ")}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Lens legend */}
        {watershedLens && (
          <div
            className="pointer-events-none absolute left-3 top-3 z-10 max-w-[245px] rounded-lg border bg-background/95 px-3 py-2.5 shadow-sm"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 text-primary" />
              Watershed Lens
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Showing nationwide watershed boundaries from the USGS.
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Nearby waterways do not prove that a report affects that waterway.
            </p>
          </div>
        )}

        {/* Report details */}
        {selectedReport && (
          <div className="absolute bottom-4 left-4 right-4 z-10 max-h-[58%] overflow-y-auto">
            <Card className="border shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getCategoryColor(selectedReport.category) }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {getCategoryLabel(selectedReport.category)}
                      </span>
                      <Badge
                        variant={
                          selectedReport.status === "resolved"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {selectedReport.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm font-semibold leading-tight">
                      {selectedReport.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedReport.description}</p>
                    {selectedReport.ai_classification && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {selectedReport.ai_classification}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(selectedReport.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => setSelectedReport(null)}
                    aria-label="Close report details"
                  >
                    ×
                  </Button>
                </div>

                {/* Environmental context for the selected report. */}
                {selectedReport.image_url && <img src={selectedReport.image_url} alt={`Photo for ${selectedReport.title}`} loading="lazy" className="mt-3 h-36 w-full rounded-md object-cover" />}
                {isSupabaseConfigured && <ReportActions key={selectedReport.id} report={selectedReport} onUpdated={(updated) => {
                  setReports((current) => current.map((report) => report.id === updated.id ? updated : report))
                  setSelectedReport((current) => current?.id === updated.id ? updated : current)
                }} onDeleted={(id) => {
                  setReports((current) => current.filter((report) => report.id !== id))
                  setSelectedReport((current) => current?.id === id ? null : current)
                }} />}
                {watershedLens && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <p className="text-sm font-semibold">Watershed Lens</p>
                    </div>

                    {!currentWatershedLookup ||
                    currentWatershedLookup.status === "loading" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Looking up the watershed for this report...
                      </p>
                    ) : currentWatershedLookup.status === "not-found" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No matching national watershed polygon was found for these
                        coordinates. The location may be outside the service's coverage,
                        or its coordinates may need checking.
                      </p>
                    ) : currentWatershedLookup.status === "error" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Watershed details could not be loaded right now. Check your
                        connection and try again in a moment.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Local subwatershed (HUC-12)
                          </p>
                          <p className="text-sm font-medium">
                            {currentWatershedLookup.data.localName ??
                              "Mapped watershed found"}
                          </p>
                        </div>

                        {currentWatershedLookup.data.localCode && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              HUC-12 subwatershed ID
                            </p>
                            <p className="text-xs">
                              {currentWatershedLookup.data.localCode}
                            </p>
                          </div>
                        )}

                        {currentWatershedLookup.data.broaderName && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Watershed (HUC-10)
                            </p>
                            <p className="text-sm">
                              {currentWatershedLookup.data.broaderName}
                              {currentWatershedLookup.data.broaderCode
                                ? ` (${currentWatershedLookup.data.broaderCode})`
                                : ""}
                            </p>
                          </div>
                        )}

                        {currentWatershedLookup.data.tributaryBasin && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Basin (HUC-6)
                            </p>
                            <p className="text-sm">
                              {currentWatershedLookup.data.tributaryBasin}
                            </p>
                          </div>
                        )}

                        {currentWatershedLookup.data.hydrologicUnitCode && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Subbasin ID (HUC-8)
                            </p>
                            <p className="text-xs">
                              {currentWatershedLookup.data.hydrologicUnitCode}
                            </p>
                          </div>
                        )}

                        <div className="border-t pt-2">
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            A watershed is an area of land that drains toward a shared
                            waterway. This report's location identifies its mapped
                            watershed, but does not prove that the reported issue has
                            reached a stream or affected water quality.
                          </p>
                        </div>
                      </div>
                    )}

                    <a
                      href="https://hydro.nationalmap.gov/arcgis/rest/services/wbd/FeatureServer/6"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-primary underline underline-offset-2"
                    >
                      View official USGS watershed data
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create-report button */}
      <Button
        size="lg"
        className="absolute bottom-6 right-4 z-10 size-14 rounded-full shadow-lg"
        style={{ bottom: selectedReport ? "120px" : undefined }}
        onClick={() => navigate("/report")}
        aria-label="Report a problem"
      >
        <Plus className="size-6" />
        <span className="sr-only">Report a problem</span>
      </Button>
    </div>
  )
}
