import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

/**
 * The medesk components speak in dashboard-relative paths ('/', '/staff', …).
 * Real routes live under /dashboard, so we translate both directions here.
 */
const BASE = '/dashboard'

export function toAppPath(href: string): string {
  return href === '/' ? BASE : `${BASE}${href}`
}

export function toDashPath(pathname: string): string {
  if (pathname === BASE || pathname === `${BASE}/`) return '/'
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname
}

// Kept so existing imports don't break; routing is handled by React Router.
export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useDashboardNavigation() {
  const location = useLocation()
  return { pathname: toDashPath(location.pathname) }
}

export function DashboardLink({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <Link to={toAppPath(href)} {...props} />
}
