// @vitest-environment jsdom
/**
 * The sub's Owed to you as rows under two bands (punch list #217, field-2, a prototype): the head
 * reads as today without a flag; `?shape=1` draws the bands for anyone with the link; `?sbs=1`
 * draws today's head over the bands for a dev; the cards' chips follow the same rule as the head
 * in every mode, naming the run's day or the sheet's own day.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { installDomShims } from '../test/renderSmokeMocks'
import SubPortal from './SubPortal'

const auth = vi.hoisted(() => ({ role: 'subcontractor' as string }))
vi.mock('../hooks/useAuth', () => ({
  useOptionalAuth: () => ({ user: { id: 'u1' }, role: auth.role }),
  useAuth: () => ({ user: { id: 'u1' }, role: auth.role }),
}))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(() => {
  installDomShims()
})

afterEach(() => {
  cleanup()
  auth.role = 'subcontractor'
})

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/sub" element={<SubPortal />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SubPortal — Owed to you as rows under two bands', () => {
  it('reads as today without a flag, and the cards’ chips name their own day', async () => {
    mount('/sub?demo=1')
    const head = await screen.findByText('Owed to you')
    const today = head.closest('[data-sub-owed-today]') as HTMLElement
    expect(today).toBeTruthy()
    expect(within(today).getByText(/queued for the Friday pay run/)).toBeTruthy()
    expect(screen.queryByTestId('sub-owed-bands')).toBeNull()
    // The demo's two sheets: J-1482 payable Sep 4 (the next run), J-1477 payable Sep 9 (later).
    expect(screen.getByText('Queued for Fri Sep 4')).toBeTruthy()
    expect(screen.getByText('Queued for Sep 9')).toBeTruthy()
  })

  it('?shape=1 draws the bands for anyone with the link', async () => {
    mount('/sub?demo=1&shape=1')
    const bands = await screen.findByTestId('sub-owed-bands')
    expect(document.querySelector('[data-sub-owed-today]')).toBeNull()
    expect(within(bands).getByText('Owed to you')).toBeTruthy()
    const next = within(bands.querySelector('[data-sub-owed-band="next_run"]') as HTMLElement)
    expect(next.getByText('This Friday · Sep 4')).toBeTruthy()
    expect(next.getByText('J-1482 1208 Brazos St')).toBeTruthy()
    expect(next.getByText('in the Friday run')).toBeTruthy()
    expect(next.getAllByText(/\$1,620/)).toHaveLength(2)
    const later = within(bands.querySelector('[data-sub-owed-band="later"]') as HTMLElement)
    expect(later.getByText('Later')).toBeTruthy()
    expect(later.getByText('J-1477 894 Lamar Blvd · payable after Sep 9')).toBeTruthy()
    expect(later.getByText(/\$2,560/)).toBeTruthy()
  })

  it('?sbs=1 draws today over the bands for a dev', async () => {
    auth.role = 'dev'
    mount('/sub?demo=1&sbs=1')
    const both = await screen.findByTestId('sub-owed-side-by-side')
    expect(within(both).getByText('Today')).toBeTruthy()
    expect(within(both).getByText('With the bands')).toBeTruthy()
    expect(both.querySelector('[data-sub-owed-today]')).toBeTruthy()
    expect(within(both).getByTestId('sub-owed-bands')).toBeTruthy()
  })

  it('?sbs=1 does nothing for a sub', async () => {
    mount('/sub?demo=1&sbs=1')
    await screen.findByText('Owed to you')
    expect(screen.queryByTestId('sub-owed-side-by-side')).toBeNull()
    expect(screen.queryByTestId('sub-owed-bands')).toBeNull()
  })
})
