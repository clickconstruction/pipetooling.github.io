// @vitest-environment jsdom
/**
 * The Documents tab's Lien paper section, and what it hands the Lien window it opens (punch list #335, Also seen).
 * The window is a stand-in that says what it was handed; what the header then reads is held by
 * `LienInstrumentsModal.render.test.tsx`. The section held no desk, so the window read *Draft the notice* at
 * every step: here a made-up job has a notice sent for approval and an affidavit to draft on the desk.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { lienDeskFromSearch } from '../../lib/lien/lienDeskRoute'
import JobDocumentsLienPaper from './JobDocumentsLienPaper'

const auth = vi.hoisted(() => ({ role: 'assistant' as string | null }))
const desk = vi.hoisted(() => ({ asked: [] as boolean[], light: [] as unknown[], refetch: vi.fn(), data: null as unknown }))
const leader = vi.hoisted(() => ({ asked: [] as unknown[], name: 'Rosa' }))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: auth.role }),
    useOptionalAuth: () => makeUseAuthValue({ role: auth.role }),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({ loadJobLienPaper: () => Promise.resolve({ filings: [], letters: [], releases: [] }) }))
// The desk's read, stood in for: it says whether it was asked to read, and answers with the made-up desk only then.
vi.mock('../../hooks/useLienDeskData', () => ({
  useLienDeskData: (enabled: boolean, _today: string, opts?: unknown) => {
    desk.asked.push(enabled)
    desk.light.push(opts)
    return { data: enabled ? desk.data : null, loading: false, refetch: desk.refetch }
  },
}))
vi.mock('../../lib/jobs/lienLeaderNameIo', () => ({
  readLienLeaderName: (id: unknown) => {
    leader.asked.push(id)
    return Promise.resolve(leader.name)
  },
}))
vi.mock('./LienInstrumentsModal', () => ({
  default: (p: { open: boolean; deskNotice?: { state: string } | null; deskAffidavit?: { state: string } | null; deskLeader?: string | null; onOpenLienDesk?: (jobId: string, kind: string) => void; onRecorded?: () => void; job: { id: string } | null }) =>
    p.open ? (
      <div data-testid="lien-window">
        <output data-testid="handed">{`notice=${p.deskNotice?.state ?? 'none'} affidavit=${p.deskAffidavit?.state ?? 'none'} leader=${p.deskLeader || 'none'} door=${p.onOpenLienDesk ? 'yes' : 'no'}`}</output>
        <button type="button" onClick={() => p.job && p.onOpenLienDesk?.(p.job.id, 'notice')}>Open it on the Lien desk</button>
        <button type="button" onClick={() => p.onRecorded?.()}>record something</button>
      </div>
    ) : null,
}))

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}{l.search}</output>
}

const job = makeJob({ id: 'job-a', hcp_number: '1312', master_user_id: 'leader-1' })
const overlay = vi.fn()
const leave = vi.fn()

function Harness() {
  return (
    <>
      <Routes>
        <Route path="/" element={<JobDocumentsLienPaper job={job} onOverlayOpenChange={overlay} onLeave={leave} />} />
        <Route path="/lien-desk" element={<p>the Lien desk</p>} />
      </Routes>
      <Where />
    </>
  )
}

async function openWindow() {
  renderWithProviders(<Harness />)
  await settle()
  fireEvent.click(screen.getAllByRole('button', { name: 'Lien window' })[0]!)
  await settle()
  return screen.getByTestId('handed')
}

beforeEach(() => {
  auth.role = 'assistant'
  desk.asked.length = 0
  desk.light.length = 0
  desk.refetch.mockClear()
  leader.asked.length = 0
  overlay.mockClear()
  leave.mockClear()
  // A made-up desk: this job's notice waits on approval and its affidavit is to draft; another job sits beside it.
  desk.data = {
    queue: { entries: [{ jobId: 'job-other', pile: 'to_draft', item: null }, { jobId: 'job-a', pile: 'awaiting', item: { hold_until: null } }] },
    affidavits: { entries: [{ jobId: 'job-a', pile: 'to_draft', gates: [], item: null }] },
  }
})
afterEach(cleanup)

describe('JobDocumentsLienPaper, the Lien window it opens (punch list #335)', () => {
  it('hands the window the job’s place on the desk and its leader, so the header names the desk’s step', async () => {
    const handed = await openWindow()
    await waitFor(() => expect(handed.textContent).toBe('notice=awaiting affidavit=to_draft leader=Rosa door=yes'))
    expect(leader.asked).toContain('leader-1')
  })

  it('reads the desk only while the window is open, and in the light form', async () => {
    renderWithProviders(<Harness />)
    await settle()
    expect(desk.asked.length).toBeGreaterThan(0)
    expect(desk.asked.every((asked) => asked === false)).toBe(true)
    expect(leader.asked).toEqual([])
    fireEvent.click(screen.getAllByRole('button', { name: 'Lien window' })[0]!)
    await settle()
    expect(desk.asked[desk.asked.length - 1]).toBe(true)
    expect(desk.light[desk.light.length - 1]).toEqual({ light: true })
  })

  it('a job on neither list, and a role that may not read the desk, read as before', async () => {
    desk.data = { queue: { entries: [] }, affidavits: { entries: [] } }
    const onNeither = await openWindow()
    await waitFor(() => expect(onNeither.textContent).toBe('notice=none affidavit=none leader=Rosa door=yes'))
    cleanup()
    auth.role = 'subcontractor'
    desk.asked.length = 0
    leader.asked.length = 0
    expect((await openWindow()).textContent).toBe('notice=none affidavit=none leader=none door=yes')
    expect(desk.asked.every((asked) => asked === false)).toBe(true)
    expect(leader.asked).toEqual([])
  })

  it('the window’s door to the Lien desk closes the window, leaves the job window and opens the desk on the job', async () => {
    await openWindow()
    fireEvent.click(screen.getByRole('button', { name: 'Open it on the Lien desk' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent?.startsWith('/lien-desk')).toBe(true))
    const address = screen.getByTestId('where').textContent ?? ''
    const { kind, job: named } = lienDeskFromSearch(new URLSearchParams(address.split('?')[1] ?? ''))
    expect({ kind, named }).toEqual({ kind: 'notice', named: 'job-a' })
    expect(leave).toHaveBeenCalledTimes(1)
    expect(overlay).toHaveBeenLastCalledWith(false)
  })

  it('a record made in the window reads the desk again', async () => {
    await openWindow()
    fireEvent.click(screen.getByRole('button', { name: 'record something' }))
    expect(desk.refetch).toHaveBeenCalledTimes(1)
  })
})
