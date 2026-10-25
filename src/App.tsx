import { HashRouter, Routes, Route } from "react-router-dom"
import { Suspense, lazy } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { BottomNav } from "@/components/BottomNav"
import { ModeToggle } from "@/components/mode-toggle"

const MapPage = lazy(() => import("@/pages/MapPage"))
const FeedPage = lazy(() => import("@/pages/FeedPage"))
const RecyclePage = lazy(() => import("@/pages/RecyclePage"))
const ReportPage = lazy(() => import("@/pages/ReportPage"))
const LearnPage = lazy(() => import("@/pages/LearnPage"))

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading page">
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

/** Main mobile app shell */
function AppShell() {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-background shadow-2xl">
      {/* App header */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary">
            <span className="text-xs font-bold text-primary-foreground">EC</span>
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">EcoReport</span>
        </div>
        <ModeToggle />
      </header>

      {/* Page content */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/recycle" element={<RecyclePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Bottom navigation is hidden on the standalone report form. */}
      <Routes>
        <Route path="/report" element={null} />
        <Route path="*" element={<BottomNav />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
