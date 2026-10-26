// @vitest-environment jsdom
/**
 * The guide browser records an open (punch list #187 PR 1, v2.5897): one `ui_nav_clicks` row per
 * open, `guide_opened` with the door the address names, none again on a re-render, and
 * `guide_missing` with the not-found line for a slug no guide answers.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { GuideBrowser } from './GuideBrowser'
import { ToastProvider } from '../contexts/ToastContext'
import { installDomShims } from '../test/renderSmokeMocks'

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ data: null, error: null })
      },
    }),
  },
}))

/** The address as the router holds it, so the test can see the door leave it. */
function Probe() {
  const l = useLocation()
  return <span data-testid="loc">{l.search}</span>
}

function tree(path: string) {
  return (
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GuideBrowser />
        <Probe />
      </MemoryRouter>
    </ToastProvider>
  )
}

const clickRows = () => inserts.filter((i) => i.table === 'ui_nav_clicks').map((i) => i.row)

describe('GuideBrowser records a guide open', () => {
  it('writes one guide_opened row with the door the address names, and none again on a re-render', async () => {
    installDomShims()
    inserts.length = 0
    const r = render(tree('/help?g=quickfill&via=walk'))
    await waitFor(() => expect(clickRows()).toHaveLength(1))
    expect(clickRows()[0]).toMatchObject({ control: 'guide_opened', target: '/help?g=quickfill#via=walk', role: 'assistant' })
    r.rerender(tree('/help?g=quickfill&via=walk'))
    await new Promise((res) => setTimeout(res, 20))
    expect(clickRows()).toHaveLength(1)
    // The door leaves the address once recorded, so a copied address carries the guide alone.
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('?g=quickfill'))
  })

  it('a slug no guide answers records guide_missing as a link and shows the not-found line', async () => {
    installDomShims()
    inserts.length = 0
    render(tree('/help?g=not-a-guide-at-all'))
    await waitFor(() => expect(clickRows()).toHaveLength(1))
    expect(clickRows()[0]).toMatchObject({ control: 'guide_missing', target: '/help?g=not-a-guide-at-all#via=link' })
    expect(screen.getByText(/That guide wasn.t found/)).toBeTruthy()
  })
})
