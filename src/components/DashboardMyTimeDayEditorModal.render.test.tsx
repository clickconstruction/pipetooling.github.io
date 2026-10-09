// @vitest-environment jsdom
/**
 * The My Time day editor's money paths and ways out, on the real modal over a recording supabase
 * stub (the map's risk flags, `docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md` → Test coverage):
 * Reject session sends one `reject_clock_session` call (the reject and the `people_hours` resync in
 * one transaction, v2.4964; the only path since v2.4973); Save sends
 * the dirty clusters in one `save_my_time_day` call, asking first over approved time; Cancel, the
 * backdrop and Escape close the topmost thing first, ask before dropping edits, and hold while a save
 * is in flight. The clock is pinned (Date only) to a Thursday so the day sits in the current week.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import type { DayEditorSession } from '../lib/myTimeDayTimeline'
import { DashboardMyTimeDayEditorModal } from './DashboardMyTimeDayEditorModal'

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

type Result = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  /** Every write and read in order, for the reject → re-read pairing. */
  log: [] as string[],
  updates: [] as Array<{ table: string; values: Record<string, unknown>; id: unknown }>,
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  daySessions: [] as unknown[],
  /** `reject_clock_session`: on the database, or refusing. */
  rejectRpc: 'present' as 'present' | { message: string; code: string },
  /** When set, `save_my_time_day` answers through it: a refusal, or a save held in flight. */
  save: null as null | (() => Promise<Result>),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-lead' } }, error: null }) },
    from: (table: string) => {
      let values: Record<string, unknown> | null = null
      const filters: Record<string, unknown> = {}
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'in', 'or', 'order', 'limit', 'gte', 'lte', 'maybeSingle', 'single']) b[m] = () => b
      b.update = (v: Record<string, unknown>) => {
        values = v
        return b
      }
      b.eq = (col: string, val: unknown) => {
        filters[col] = val
        return b
      }
      b.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) => {
        if (values) {
          h.log.push(`update ${table} ${String(filters.id)}`)
          h.updates.push({ table, values, id: filters.id })
          return Promise.resolve({ data: null, error: null }).then(res, rej)
        }
        if (table === 'clock_sessions' && filters.work_date) {
          h.log.push('read day')
          return Promise.resolve({ data: h.daySessions, error: null }).then(res, rej)
        }
        return Promise.resolve({ data: [], error: null }).then(res, rej)
      }
      return b
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args })
      h.log.push(`rpc ${fn}`)
      if (fn === 'reject_clock_session') {
        return Promise.resolve({ data: null, error: h.rejectRpc === 'present' ? null : h.rejectRpc })
      }
      if (fn === 'save_my_time_day') return h.save ? h.save() : Promise.resolve({ data: null, error: null })
      return Promise.resolve({ data: [], error: null })
    },
  },
}))

/** A Tuesday inside the pinned week (Sunday 10-04 to Saturday 10-10, America/Chicago). */
const DAY = '2026-10-06'
const NOW = '2026-10-08T18:00:00.000Z'

function row(id: string, inHms: string, outHms: string, extra: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: `${DAY}T${inHms}Z`,
    clocked_out_at: `${DAY}T${outHms}Z`,
    work_date: DAY,
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    quick_add_minutes: null,
    ...extra,
  }
}

const MORNING = row('a', '14:00:00', '16:00:00', { notes: 'Rough-in' })
const AFTERNOON = row('b', '18:00:00', '19:00:00', { notes: 'Walkthrough' })

type Props = ComponentProps<typeof DashboardMyTimeDayEditorModal>

function mount(over: Partial<Props> = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const onLinkedSessionsUpdated = vi.fn()
  const utils = renderWithProviders(
    <DashboardMyTimeDayEditorModal
      dateStr={DAY}
      sessions={[]}
      subjectUserId="u-crew"
      subjectDisplayName="Dana Ruiz"
      onClose={onClose}
      onSaved={onSaved}
      onLinkedSessionsUpdated={onLinkedSessionsUpdated}
      {...over}
    />,
  )
  return { ...utils, onClose, onSaved, onLinkedSessionsUpdated }
}

const saves = () => h.rpcs.filter((r) => r.fn === 'save_my_time_day')
const escape = () => fireEvent.keyDown(window, { key: 'Escape' })
const dialogTitled = (title: RegExp) =>
  screen.getAllByRole('alertdialog').find((d) => title.test(d.textContent ?? ''))!

async function loaded() {
  await waitFor(() => expect(screen.getAllByRole('slider')).toHaveLength(2))
}

/** Form → Split on the first segment: a real edit that leaves every note filled in. */
async function splitTheMorning() {
  fireEvent.click(screen.getByRole('button', { name: 'Form' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Split' })[0]!)
  await screen.findByRole('button', { name: 'Save' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  h.log = []
  h.updates = []
  h.rpcs = []
  h.daySessions = [MORNING, AFTERNOON]
  h.rejectRpc = 'present'
  h.save = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const openRejectAndConfirm = async (index = 0) => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Reject session' })[index]!)
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reject session' }))
  return dialog
}

describe('Reject session — one request: the reject and its people_hours resync together', () => {
  it('sends one reject_clock_session call, then re-reads the day', async () => {
    const m = mount()
    await loaded()
    await openRejectAndConfirm()

    await waitFor(() => expect(m.onLinkedSessionsUpdated).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(h.log).toEqual(['read day', 'rpc reject_clock_session', 'read day']))
    expect(h.rpcs.filter((r) => r.fn === 'reject_clock_session')).toEqual([{ fn: 'reject_clock_session', args: { p_session_id: 'a' } }])
    expect(h.updates).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // The editor read the day itself, so nothing is handed to a parent to refresh.
    expect(m.onSaved).not.toHaveBeenCalled()
  })

  it('on a parent’s sessions the parent is told to refresh instead of the day being re-read', async () => {
    const m = mount({ sessions: [MORNING, AFTERNOON] })
    await loaded()
    await openRejectAndConfirm(1)
    await waitFor(() => expect(m.onSaved).toHaveBeenCalledTimes(1))
    expect(h.log).toEqual(['rpc reject_clock_session'])
    expect(h.rpcs[0]!.args).toEqual({ p_session_id: 'b' })
    expect(m.onLinkedSessionsUpdated).toHaveBeenCalledTimes(1)
  })

  it('a refusal changes nothing: the dialog says why and stays open', async () => {
    h.rejectRpc = { message: 'reject_clock_session: no clock session a that you can change', code: 'P0001' }
    const m = mount()
    await loaded()
    const dialog = await openRejectAndConfirm()

    expect((await within(dialog).findByRole('alert')).textContent).toContain('that you can change')
    expect(h.log).toEqual(['read day', 'rpc reject_clock_session'])
    expect(m.onLinkedSessionsUpdated).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBe(dialog)
  })
})

describe('Save — requestSave', () => {
  it('sends the dirty clusters in one save_my_time_day call as a leader, then saves and closes', async () => {
    const m = mount()
    await loaded()
    await splitTheMorning()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(m.onClose).toHaveBeenCalledTimes(1))
    expect(m.onSaved).toHaveBeenCalledTimes(1)
    expect(saves()).toHaveLength(1)
    expect(saves()[0]!.args).toMatchObject({ p_subject_user_id: 'u-crew', p_work_date: DAY, p_leader: true })
    expect((saves()[0]!.args.p_writes as unknown[]).length).toBeGreaterThan(0)
  })

  it('a refused save keeps the editor open with the database’s words', async () => {
    h.save = () => Promise.resolve({ data: null, error: { message: 'This week is closed for edits.', code: 'P0001' } })
    const m = mount()
    await loaded()
    await splitTheMorning()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/This week is closed for edits/)).toBeTruthy()
    expect(m.onSaved).not.toHaveBeenCalled()
    expect(m.onClose).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('over approved time it asks first: Cancel sends nothing, Continue saves', async () => {
    h.daySessions = [{ ...MORNING, approved_at: `${DAY}T20:00:00Z` }, AFTERNOON]
    const m = mount()
    await loaded()
    await splitTheMorning()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const ask = await screen.findByRole('alertdialog')
    expect(ask.textContent).toContain('already approved')
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(saves()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(m.onClose).toHaveBeenCalledTimes(1))
    expect(saves()).toHaveLength(1)
  })

  it('Save stays disabled while a segment has no notes', async () => {
    mount()
    await loaded()
    await splitTheMorning()
    const note = screen.getAllByRole('textbox').find((t) => (t as HTMLTextAreaElement).value === 'Rough-in')!
    fireEvent.change(note, { target: { value: '' } })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true))
    expect(saves()).toHaveLength(0)
  })
})

describe('the ways out — Cancel, the backdrop and Escape', () => {
  it('a clean day closes at once, from Close, the backdrop or Escape; a click inside does not', async () => {
    const m = mount()
    await loaded()
    fireEvent.click(screen.getByText('Dana Ruiz', { exact: false }))
    expect(m.onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getAllByRole('presentation')[0]!)
    expect(m.onClose).toHaveBeenCalledTimes(2)
    // One press, read at once: the listener calls the handler of the render on screen (v2.4980).
    escape()
    expect(m.onClose).toHaveBeenCalledTimes(3)
    expect(saves()).toHaveLength(0)
  })

  it('Escape has one window listener, bound once, so a press acts on the day on screen (v2.4980)', async () => {
    // Re-bound in an effect after each render, the listener lagged a render the day's load caused
    // and held the one before: a clean day asked "Discard unsaved changes?" on a busy CI box.
    const keyListeners = () => add.mock.calls.filter(([type]) => String(type) === 'keydown').length
    const add = vi.spyOn(window, 'addEventListener')
    const m = mount()
    await loaded()
    const bound = keyListeners()
    await splitTheMorning()
    escape()
    expect(screen.getByRole('alertdialog').textContent).toMatch(/Discard unsaved changes/)
    escape()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(keyListeners()).toBe(bound)
    expect(m.onClose).not.toHaveBeenCalled()
    add.mockRestore()
  })

  it('with an edit, Cancel asks: Keep editing keeps it, Discard changes closes without saving', async () => {
    const m = mount()
    await loaded()
    await splitTheMorning()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(dialogTitled(/Discard unsaved changes/)).getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(m.onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('presentation')[0]!)
    fireEvent.click(within(dialogTitled(/Discard unsaved changes/)).getByRole('button', { name: 'Discard changes' }))
    expect(m.onClose).toHaveBeenCalledTimes(1)
    expect(saves()).toHaveLength(0)
  })

  it('Escape closes the topmost thing first: an open sub-dialog, then the discard question, never the edit', async () => {
    const m = mount()
    await loaded()
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject session' })[0]!)
    await screen.findByRole('alertdialog')
    escape()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(m.onClose).not.toHaveBeenCalled()

    await splitTheMorning()
    escape()
    expect(dialogTitled(/Discard unsaved changes/)).toBeTruthy()
    escape()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('while a save is in flight nothing closes; it closes once the save lands', async () => {
    let land!: (r: Result) => void
    h.save = () => new Promise<Result>((r) => (land = r))
    const m = mount()
    await loaded()
    await splitTheMorning()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saves()).toHaveLength(1))

    escape()
    fireEvent.click(screen.getAllByRole('presentation')[0]!)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(m.onClose).not.toHaveBeenCalled()

    land({ data: null, error: null })
    await waitFor(() => expect(m.onClose).toHaveBeenCalledTimes(1))
    expect(m.onSaved).toHaveBeenCalledTimes(1)
  })
})
