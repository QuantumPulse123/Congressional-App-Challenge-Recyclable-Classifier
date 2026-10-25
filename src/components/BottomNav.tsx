import { NavLink } from "react-router-dom"
import { BookOpen, ListFilter, Map, Recycle } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/", icon: Map, label: "Map" },
  { to: "/feed", icon: ListFilter, label: "Feed" },
  { to: "/recycle", icon: Recycle, label: "Recycle" },
  { to: "/learn", icon: BookOpen, label: "Learn" },
]

export function BottomNav() {
  return (
    <nav className="flex border-t bg-background" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
