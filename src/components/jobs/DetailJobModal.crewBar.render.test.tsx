// @vitest-environment jsdom
/**
 * The crew's job window on a phone (punch list #189, PR 4): a helper's plain window at 375 px carries a bar
 * under its scrolling body — Arrived (or Leaving) · Leave report · Note — every button at least 48 px tall;
 * Note opens the composer as a sheet with the note box focused and Save beside it, and Save posts the note to
 * the job's thread as Post note does; the composer's own Arrived / Leaving chips leave the row. On a desktop
 * nothing changes: the chips stay, there is no bar.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { JOB_WINDOW_BAR_MIN_HEIGHT } from '../../lib/jobs/jobWindowBar'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

/** What the window wrote to the job's thread: the press the outbox sent (punch list #163 PR 3), as the RPC read it. */
const notesInserted = vi.hoisted(() => [] as Array<Record<string, unknown>>)
/** The row the RPC made, which the thread's table answers when the hook reads it back by id. */
const noteWritten = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  // A note goes through the outbox to land_field_press (punch list #163 PR 3), which answers the id of the
  // row it wrote; the hook then reads that row back, so the thread's table answers the select by id with
  // the row, as the live table does, and a saved note lands in the activity list; every other read of the
  // table comes back empty like every other table's.
  const notesTable = () => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) builder[m] = () => builder
    builder.single = () =>
      Promise.resolve({
        data: noteWritten.current
          ? { id: `note-${notesInserted.length}`, body: noteWritten.current.body, created_at: new Date().toISOString(), author: { name: 'Luis Ortega' } }
          : null,
        error: null,
      })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
    return builder
  }
  const rpc = (name: string, args: Record<string, unknown>) => {
    if (name === 'land_field_press' && args.p_kind === 'job_note') {
      const payload = args.p_payload as Record<string, unknown>
      noteWritten.current = { job_id: payload.job_id, body: payload.body }
      notesInserted.push({ kind: args.p_kind, job_id: payload.job_id, body: payload.body })
      return Promise.resolve({ data: { note_id: `note-${notesInserted.length}`, late: false }, error: null, status: 200 })
    }
    return (stub.rpc as (n: string, a: Record<string, unknown>) => unknown)(name, args)
  }
  return { supabase: { ...stub, rpc, from: (table: string) => (table === 'jobs_ledger_thread_notes' ? notesTable() : stub.from()) } }
})

// A helper: the plain window, through the limited read (the stub's ledger row is null, so the assigned row carries the job).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers', profileName: 'Luis Ortega' })
})

let narrowMatches = false
/** A width query as a window 375 px wide (a phone) or 1280 px wide (a desk) answers it; anything else is false. */
function widthQueryMatches(query: string): boolean {
  const width = narrowMatches ? 375 : 1280
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (!max && !min) return false
  return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]))
}
beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  window.matchMedia = ((query: string) => ({
    matches: widthQueryMatches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})
afterEach(() => {
  narrowMatches = false
  notesInserted.length = 0
})

const assigned = [
  {
    id: 'job-1',
    hcp_number: '9001',
    job_name: 'Whitfield water heater',
    job_address: '1208 Mesquite Ln, Cedar Bend, TX',
    google_drive_link: null,
    job_pictures_link: null,
    job_plans_link: null,
    revenue: 1850,
    project_id: null,
  },
]

/** The plain window as a helper sees it; `phone` puts the viewport at 375 px before the first paint. */
async function renderPlainWindow(phone: boolean) {
  narrowMatches = phone
  const onClose = vi.fn()
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal open onClose={onClose} jobId="job-1" authRole="helpers" assignedJobsRows={assigned} scheduleContext={null} />
    </UpdateFocusOpenerBridgeProvider>,
  )
  await settle()
  // The job's name is what the limited load paints.
  await screen.findByRole('heading', { name: /Whitfield water heater/ })
  return onClose
}

const minHeightPx = (el: HTMLElement) => parseFloat(el.style.minHeight)

describe('DetailJobModal · the crew bar on a phone', () => {
  it('draws Arrived · Leave report · Note under the body at the bar height, and the composer loses its chips', async () => {
    await renderPlainWindow(true)
    const bar = await screen.findByRole('toolbar', { name: 'Job actions' })
    const arrived = within(bar).getByRole('button', { name: 'Arrived' })
    const report = within(bar).getByRole('button', { name: 'Leave report' })
    const note = within(bar).getByRole('button', { name: 'Note' })
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Arrived', 'Leave report', 'Note'])
    for (const b of [arrived, report, note]) expect(minHeightPx(b)).toBeGreaterThanOrEqual(48)
    expect(JOB_WINDOW_BAR_MIN_HEIGHT).toBe(48)
    // One Arrived on the screen: the bar's. The composer's chips (their accessible names) are gone.
    expect(screen.getAllByRole('button', { name: /^(Arrived|Leaving)$/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Post arrived at job note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Post leaving job note' })).toBeNull()
    // Post note stays in the composer for a long note typed there.
    expect(screen.getByRole('button', { name: 'Post note' })).toBeTruthy()
  })

  it('Note opens the sheet over the keyboard with the note box focused and Save beside it', async () => {
    await renderPlainWindow(true)
    const bar = await screen.findByRole('toolbar', { name: 'Job actions' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Note' }))
    const sheet = await screen.findByRole('dialog', { name: 'Note' })
    // The phone sheet: risen from the bottom, its backdrop as tall as the room the keyboard leaves.
    expect(sheet.closest('[data-phone-sheet]')?.getAttribute('data-phone-sheet')).toBe('sheet')
    const box = within(sheet).getByRole('textbox', { name: 'Add a note' })
    await waitFor(() => expect(document.activeElement).toBe(box))
    const save = within(sheet).getByRole('button', { name: 'Save' })
    expect(minHeightPx(save)).toBeGreaterThanOrEqual(48)
    // Nothing to save yet: Save waits for words.
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'Dana wants the old heater hauled off.' } })
    expect((save as HTMLButtonElement).disabled).toBe(false)
    // The sheet's Close puts it away and leaves the window.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Note' })).toBeNull())
    expect(screen.getByRole('toolbar', { name: 'Job actions' })).toBeTruthy()
  })

  it('Save posts the note to the job’s thread as Post note does, closes the sheet, and the note joins the activity', async () => {
    await renderPlainWindow(true)
    const bar = await screen.findByRole('toolbar', { name: 'Job actions' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Note' }))
    const sheet = await screen.findByRole('dialog', { name: 'Note' })
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Add a note' }), { target: { value: 'Dana wants the old heater hauled off.' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Note' })).toBeNull())
    // One press on this job's thread, with the words as typed, sent through the outbox's RPC (the server sets the author).
    expect(notesInserted).toEqual([{ kind: 'job_note', job_id: 'job-1', body: 'Dana wants the old heater hauled off.' }])
    const posted = await screen.findByText('Dana wants the old heater hauled off.')
    expect(posted.closest('li')).not.toBeNull()
    // The draft the composer and the sheet share is empty again.
    expect((screen.getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement).value).toBe('')
  })

  it('Leave report on the bar opens the per-job report form over the window', async () => {
    await renderPlainWindow(true)
    const bar = await screen.findByRole('toolbar', { name: 'Job actions' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Leave report' }))
    // On a phone the form's Save names what it writes (v2.6083: Save · job 40%), so the form is the dialog that holds the camera input.
    const formOf = () => screen.getAllByRole('dialog').find((d) => within(d).queryByTestId('report-camera-input')) ?? null
    await waitFor(() => expect(formOf()).not.toBeNull())
    expect(within(formOf()!).getByRole('heading', { name: '9001 Whitfield water heater' })).toBeTruthy()
  })

  it('on a desktop the composer keeps its Arrived and Leaving chips and there is no bar', async () => {
    await renderPlainWindow(false)
    expect(screen.queryByRole('toolbar', { name: 'Job actions' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Post arrived at job note' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Post leaving job note' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Note' })).toBeNull()
  })
})
