// @vitest-environment jsdom
/**
 * The Writeups cold deep link (v2.6419): `/people?tab=writeups` opened cold by a dev lands on
 * Writeups. Every flag `usePeopleAccess` returns starts false while the role is read, so a URL
 * gate that reads `canAccessContracts` before `accessResolved` bounced the dev to Users on the
 * first render; the pay tabs' gate waited for the flag (v2.2882), the Writeups gate did not. The
 * `users` read here answers after the first render, as the server does, so the race is real.
 */
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ThemeProvider } from '../contexts/ThemeContext'

const smoke = vi.hoisted(() => ({
  role: 'dev' as string,
  /** How many times the page read the signed-in user's row: the role lands only after the first. */
  roleReads: 0,
}))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub, SMOKE_AUTH_USER_ID } = await import('../test/renderSmokeMocks')
  const generic = makeSupabaseStub()

  /** A chainable builder answering `rows` a tick late (a macrotask), the way the server does. */
  function makeTableBuilder(rows: () => Array<Record<string, unknown>>): Record<string, unknown> {
    const build = (single: boolean): Record<string, unknown> => {
      const result = () =>
        new Promise<{ data: unknown; error: null; count: number }>((resolve) => {
          setTimeout(() => {
            const list = rows()
            resolve({ data: single ? (list[0] ?? null) : list, error: null, count: list.length })
          }, 0)
        })
      const b: Record<string, unknown> = {}
      for (const m of [
        'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
        'is', 'in', 'or', 'not', 'contains', 'filter', 'order', 'range', 'limit', 'abortSignal',
      ]) {
        b[m] = () => b
      }
      b.single = () => build(true)
      b.maybeSingle = () => build(true)
      b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
      b.catch = (r?: (e: unknown) => unknown) => result().catch(r)
      b.finally = (fin?: () => void) => result().finally(fin)
      return b
    }
    return build(false)
  }

  const TABLE_ROWS: Record<string, () => Array<Record<string, unknown>>> = {
    users: () => {
      smoke.roleReads += 1
      return [{ id: SMOKE_AUTH_USER_ID, name: 'Smoke Dev', email: 'smoke@example.com', role: smoke.role, phone: null, notes: null }]
    },
  }

  return {
    supabase: {
      ...generic,
      from: (table: string) => {
        const rows = TABLE_ROWS[table]
        return rows ? makeTableBuilder(rows) : (generic.from as () => unknown)()
      },
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import People from './People'
import { installDomShims } from '../test/renderSmokeMocks'
import { resetRoleGateAnnouncements } from '../hooks/useRoleGate'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderPeopleAt(url: string, role: string) {
  smoke.role = role
  smoke.roleReads = 0
  installDomShims()
  return render((<><People /><LocationProbe /></>) as ReactElement, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      </ThemeProvider>
    ),
  })
}

afterEach(() => {
  cleanup()
  resetRoleGateAnnouncements()
})

const currentTab = () => new URLSearchParams((screen.getByTestId('location').textContent ?? '').split('?')[1] ?? '').get('tab')

describe('People → Writeups, opened cold', () => {
  it('a dev lands on Writeups once the role has been read, never on Users first', async () => {
    renderPeopleAt('/people?tab=writeups', 'dev')
    // first paint: the role is still in flight, and the URL must not have moved.
    expect(currentTab()).toBe('writeups')
    await waitFor(() => expect(smoke.roleReads).toBeGreaterThan(0))
    expect(await screen.findByRole('heading', { name: 'Writeups' })).toBeTruthy()
    expect(currentTab()).toBe('writeups')
    expect(screen.getByRole('tab', { name: 'Writeups' }).getAttribute('aria-selected')).toBe('true')
  })

  it('a role with no Paperwork access still lands on Users, once the role has been read', async () => {
    renderPeopleAt('/people?tab=writeups', 'helpers')
    await waitFor(() => expect(currentTab()).toBe('users'))
    expect(screen.queryByRole('heading', { name: 'Writeups' })).toBeNull()
  })
})
