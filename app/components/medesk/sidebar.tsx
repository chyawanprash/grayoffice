import {
  BookOpenIcon,
  ChevronRight,
  LogOutIcon,
  MoonIcon,
  SunIcon,
} from 'lucide-react'
import { useFetcher } from 'react-router'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { MedeskLogo } from './logo'
import { SidebarCollapseIcon } from './icons'
import { DashboardLink, useDashboardNavigation } from './navigation'
import { useTheme } from './theme-provider'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '~/components/ui/sidebar'
import { navigationGroups, type NavigationItem } from './data'
import { cn } from '~/lib/utils'

type SidebarUser = { name: string | null; email: string }

const menuButtonClassName = cn(
  'h-12.5 gap-2.5 rounded-lg bg-transparent py-2.5 pl-3 pr-2 text-base font-normal text-muted-foreground transition-colors',
  'hover:!bg-transparent hover:text-foreground active:!bg-transparent',
  'aria-[current=page]:!bg-transparent aria-[current=page]:font-medium aria-[current=page]:text-foreground',
  'data-open:!bg-transparent data-open:hover:!bg-transparent data-open:text-foreground data-active:!bg-transparent',
  '[&_svg]:size-5! [&_svg]:shrink-0',
  'group-data-[collapsible=icon]:size-12.5! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden',
)

const sidebarGroupLabelClassName =
  'h-auto px-0 py-1 text-[1.0625rem] font-normal text-foreground/70 transition-colors'

function NavItem({ item }: { item: NavigationItem }) {
  const { pathname } = useDashboardNavigation()
  const { isMobile, setOpenMobile } = useSidebar()
  const isActive =
    item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <SidebarMenuButton
      tooltip={item.name}
      className={menuButtonClassName}
      render={
        <DashboardLink
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
        />
      }
    >
      <item.icon />
      <span>{item.name}</span>
      {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
    </SidebarMenuButton>
  )
}

export function DashboardSidebar({ user }: { user: SidebarUser }) {
  const { resolvedTheme, setTheme } = useTheme()
  const { state, toggleSidebar } = useSidebar()
  const isDark = resolvedTheme === 'dark'
  const logout = useFetcher()
  const displayName = user.name ?? user.email

  return (
    <Sidebar collapsible="icon" className="border-r-0!">
      <SidebarHeader className="relative h-20 flex-row items-center justify-between gap-3 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="flex min-w-0 items-center gap-3 transition-opacity group-data-[collapsible=icon]:hidden">
          <MedeskLogo className="size-7 shrink-0" />
          <span className="truncate text-xl font-medium tracking-tight">
            Gray Office
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={toggleSidebar}
          aria-label={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
          className="size-10"
        >
          <SidebarCollapseIcon className="size-5 transition-transform group-data-[collapsible=icon]:rotate-180" />
        </Button>
      </SidebarHeader>

      <SidebarContent className="gap-3 px-4 py-3 group-data-[collapsible=icon]:overflow-auto!">
        {navigationGroups.map((group) => {
          const items = (
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <NavItem item={item} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )

          if (group.collapsible ?? false) {
            return (
              <Collapsible key={group.label} defaultOpen className="group/collapsible">
                <SidebarGroup className="gap-1 p-0">
                  <SidebarGroupLabel
                    className={sidebarGroupLabelClassName}
                    render={
                      <CollapsibleTrigger className="flex w-full items-center justify-between transition-colors hover:text-foreground" />
                    }
                  >
                    <span>{group.label}</span>
                    <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarGroupLabel>
                  <CollapsibleContent>{items}</CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )
          }

          return (
            <SidebarGroup key={group.label} className="gap-1 p-0">
              <SidebarGroupLabel className={sidebarGroupLabelClassName}>
                {group.label}
              </SidebarGroupLabel>
              {items}
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="px-4 py-2">
        <SidebarGroup className="gap-0 p-0">
          <SidebarGroupLabel
            className={cn(
              sidebarGroupLabelClassName,
              'group-data-[collapsible=icon]:hidden',
            )}
          >
            Account
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      tooltip={displayName}
                      className={cn(menuButtonClassName, 'justify-start px-0!')}
                    />
                  }
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar size="sm" className="border border-border/50">
                      <AvatarFallback>
                        {displayName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {displayName}
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="leading-tight">
                        <p className="truncate text-sm font-medium">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    >
                      {isDark ? <SunIcon /> : <MoonIcon />}
                      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <a
                          href="https://developers.cloudflare.com"
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <BookOpenIcon className="size-4" />
                      <span>Documentation</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      logout.submit(null, { method: 'post', action: '/logout' })
                    }
                  >
                    <LogOutIcon className="size-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
