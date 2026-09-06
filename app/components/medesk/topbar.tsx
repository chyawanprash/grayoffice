import { useRouteLoaderData } from 'react-router'
import { useDashboardNavigation } from './navigation'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { ThemeToggle } from '~/components/theme'
import { navigationGroups } from './data'
import { CommandPalette } from './command-palette'

function relativeTime(ts: number | null): string {
  if (!ts) return 'never'
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (secs < 90) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}

export function DashboardTopbar() {
  const { pathname } = useDashboardNavigation()
  const layout = useRouteLoaderData('routes/dashboard-layout') as
    | { lastSync?: number | null }
    | undefined
  const currentPage =
    navigationGroups
      .flatMap((group) => group.items)
      .find((item) => item.href === pathname) ?? navigationGroups[0].items[0]
  const CurrentPageIcon = currentPage.icon

  return (
    <header className="flex h-18 shrink-0 items-center justify-between gap-4 px-5 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger
          size="icon"
          className="shrink-0 md:hidden [&_svg]:size-5!"
        />
        <div className="hidden items-end gap-4 md:flex">
          <div className="flex h-6 items-center gap-3">
            <CurrentPageIcon className="size-4" />
            <span className="text-lg leading-6.5 font-medium">
              {currentPage.name}
            </span>
          </div>
          <div className="flex h-6 items-center gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Knowledge base updated{' '}
              <span className="text-foreground/80">
                {relativeTime(layout?.lastSync ?? null)}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 shrink items-center gap-2">
        <CommandPalette />
        <ThemeToggle bordered={false} className="hover:bg-secondary/70" />
      </div>
    </header>
  )
}
