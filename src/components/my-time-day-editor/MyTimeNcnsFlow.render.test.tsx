// @vitest-environment jsdom
/**
 * The My Time day editor's no-call-no-show flow as a hook and three components. Mounts them
 * together, the way the editor does, over a recording supabase stub: the button's gate and words,
 * the plain and the approved paths, what the record RPC is sent, the pre-close sweep of open
 * sessions, busy holding every way out, and the hook's entry in the editor's sub-flow registry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled, settle } from '../../test/renderSmokeMocks'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import { MyTimeNcnsButton, MyTimeNcnsDialog, MyTimeNcnsPrecloseDialog } from './MyTimeNcnsDialogs'
import { useMyTimeNcnsFlow, type UseMyTimeNcnsFlowInput } from './useMyTimeNcnsFlow'

type RpcResult = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: unknown }>,
  updates: [] as Array<{ table: string; values: Record<string, unknown>; id: unknown }>,
  probes: [] as Array<Record<string, unknown>>,
  scheduleRows: [] as Array<{ id: string }>,
  rpcResult: null as null | (() => Promise<RpcResult>),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let values: Record<string, unknown> | null = null
      const filters: Record<string, unknown> = {}
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.limit = () => b
      b.update = (v: Record<string, unknown>) => {
        values = v
        return b
      }
      b.eq = (col: string, val: unknown) => {
        filters[col] = val
        return b
      }
      b.then = (res: (v: RpcResult) => unknown, rej: (e: unknown) => unknown) => {
        if (values) {
          h.updates.push({ table, values, id: filters.id })
          return Promise.resolve({ data: null, error: null }).then(res, rej)
        }
        h.probes.push({ table, ...filters })
        return Promise.resolve({ data: h.scheduleRows, error: null }).then(res, rej)
      }
      return b
    },
    rpc: (fn: string, args: unknown) => {
      h.rpcCalls.push({ fn, args })
      return h.rpcResult
        ? h.rpcResult()
        : Promise.resolve({
            data: [{ rejected_count: 1, had_approved_sessions: false, error_message: null }],
            error: null,
          })
    },
  },
}))

vi.mock('../../utils/errorHandling', async (orig) => ({
  ...(await orig<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => PromiseLike<RpcResult>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

const IN = '2026-01-05T14:00:00.000Z'
const OUT = '2026-01-05T22:00:00.000Z'

function mk(id: string, over: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: IN,
    clocked_out_at: OUT,
    work_date: '2026-01-05',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...over,
  }
}

function makeInput(over: Partial<UseMyTimeNcnsFlowInput> = {}) {
  const input = {
    allowNcnsFromMyTime: true,
    editingSelf: false,
    allowPunchTimeActions: true,
    effectiveSubjectUserId: 'user-1',
    dateStr: '2026-01-05',
    sortedSessions: [mk('s1')],
    sessionsLoading: false,
    pendingAuthForFetch: false,
    sessionsControlledByParent: false,
    fetchDaySessionsForEditor: vi.fn(async (): Promise<DayEditorSession[]> => []),
    setFetchedSessions: vi.fn(),
    onLinkedSessionsUpdated: vi.fn(),
    onSaved: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  return input
}

/** The editor's mounts of the flow, plus a probe of `closeTopmost` (its sub-flow registry entry). */
function Harness({ input, saving = false }: { input: UseMyTimeNcnsFlowInput; saving?: boolean }) {
  const ncns = useMyTimeNcnsFlow(input)
  return (
    <div>
      <MyTimeNcnsButton flow={ncns} saving={saving} />
      <button type="button" data-testid="close-topmost" onClick={(e) => {
        e.currentTarget.textContent = `closed:${String(ncns.closeTopmost())}`
      }}>
        close topmost
      </button>
      <MyTimeNcnsPrecloseDialog flow={ncns} zIndex={1305} />
      <MyTimeNcnsDialog flow={ncns} personLabel="Dana Ruiz" dateLabel="Monday, January 5, 2026" zIndex={1310} />
    </div>
  )
}

const ncnsButton = () => screen.getByRole('button', { name: 'NCNS' }) as HTMLButtonElement
const mount = (input: UseMyTimeNcnsFlowInput, saving = false) =>
  renderSettled(<Harness input={input} saving={saving} />, { loaded: () => screen.findByRole('button', { name: 'NCNS' }) })

beforeEach(() => {
  h.rpcCalls.length = 0
  h.updates.length = 0
  h.probes.length = 0
  h.scheduleRows = []
  h.rpcResult = null
})

afterEach(() => {
  cleanup()
})

describe('the NCNS button', () => {
  it('on a closed day is live and says what it records', async () => {
    await mount(makeInput())
    expect(ncnsButton().disabled).toBe(false)
    expect(ncnsButton().title).toBe('Record no-call-no-show for this day')
  })

  it('is held while the editor saves', async () => {
    await mount(makeInput(), true)
    expect(ncnsButton().disabled).toBe(true)
  })

  it('on an empty day asks the schedule: held when the person was not scheduled', async () => {
    await mount(makeInput({ sortedSessions: [] }))
    await waitFor(() => expect(ncnsButton().title).toBe('No sessions or schedule for this day'))
    expect(ncnsButton().disabled).toBe(true)
    expect(h.probes).toEqual([{ table: 'job_schedule_blocks', assignee_user_id: 'user-1', work_date: '2026-01-05' }])
  })

  it('on an empty day is live when the person was scheduled', async () => {
    h.scheduleRows = [{ id: 'block-1' }]
    await mount(makeInput({ sortedSessions: [] }))
    await waitFor(() => expect(ncnsButton().title).toBe('Record no-call-no-show (scheduled, no clock time)'))
    expect(ncnsButton().disabled).toBe(false)
  })

  it('does not ask the schedule on your own day', async () => {
    await mount(makeInput({ editingSelf: true }))
    expect(h.probes).toEqual([])
    expect(ncnsButton().disabled).toBe(true)
  })
})

describe('recording on a day with nothing approved', () => {
  it('names the person and the day, sends the trimmed details, then saves and closes the editor', async () => {
    const input = makeInput()
    await mount(input)
    fireEvent.click(ncnsButton())
    const dialog = await screen.findByRole('alertdialog', { name: 'Record no-call, no-show?' })
    expect(dialog.textContent).toContain('no-show for Dana Ruiz on Monday, January 5, 2026.')
    expect(screen.getByRole('presentation').style.zIndex).toBe('1310')

    const details = screen.getByLabelText('Details (optional)') as HTMLTextAreaElement
    expect(details.maxLength).toBe(4000)
    fireEvent.change(details, { target: { value: '  did not answer  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record NCNS' }))

    await waitFor(() => expect(input.onClose).toHaveBeenCalledTimes(1))
    expect(input.onSaved).toHaveBeenCalledTimes(1)
    expect(h.rpcCalls).toEqual([
      {
        fn: 'record_ncns_and_reject_sessions_for_day',
        args: { p_subject_user_id: 'user-1', p_work_date: '2026-01-05', p_details: 'did not answer' },
      },
    ])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('shows the RPC’s own refusal inside the dialog and leaves the editor open', async () => {
    h.rpcResult = () =>
      Promise.resolve({
        data: [{ rejected_count: 0, had_approved_sessions: false, error_message: 'Not allowed for this person.' }],
        error: null,
      })
    const input = makeInput()
    await mount(input)
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Record NCNS' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Not allowed for this person.')
    expect(screen.getByRole('alertdialog', { name: 'Record no-call, no-show?' })).toBeTruthy()
    expect(input.onSaved).not.toHaveBeenCalled()
    expect(input.onClose).not.toHaveBeenCalled()
  })

  it('a database error shows as words inside the dialog; nothing is saved and Record NCNS is free again', async () => {
    h.rpcResult = () =>
      Promise.resolve({
        data: null,
        error: { message: 'permission denied for function record_ncns_and_reject_sessions_for_day', code: '42501' },
      })
    const input = makeInput()
    await mount(input)
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Record NCNS' }))
    expect((await screen.findByRole('alert')).textContent).not.toBe('')
    expect(screen.getByRole('alertdialog', { name: 'Record no-call, no-show?' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Record NCNS' }) as HTMLButtonElement).disabled).toBe(false)
    expect(input.onSaved).not.toHaveBeenCalled()
    expect(input.onClose).not.toHaveBeenCalled()
  })

  it('Cancel and the backdrop close it; a click inside does not', async () => {
    await mount(makeInput())
    fireEvent.click(ncnsButton())
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(dialog)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('presentation'))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(h.rpcCalls).toEqual([])
  })

  it('while the record is in flight every way out is held', async () => {
    let finish: (r: RpcResult) => void = () => {}
    h.rpcResult = () => new Promise<RpcResult>((resolve) => { finish = resolve })
    const input = makeInput()
    await mount(input)
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Record NCNS' }))

    const working = (await screen.findByRole('button', { name: 'Working…' })) as HTMLButtonElement
    expect(working.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Details (optional)') as HTMLTextAreaElement).disabled).toBe(true)
    expect(ncnsButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole('presentation'))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    // The registry still answers "something is open", so Escape does not fall through to the editor.
    fireEvent.click(screen.getByTestId('close-topmost'))
    expect(screen.getByTestId('close-topmost').textContent).toBe('closed:true')
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    finish({ data: [{ rejected_count: 1, had_approved_sessions: false, error_message: null }], error: null })
    await waitFor(() => expect(input.onClose).toHaveBeenCalledTimes(1))
  })
})

describe('recording over approved time', () => {
  const approved = () => makeInput({ sortedSessions: [mk('s1'), mk('s2', { approved_at: '2026-01-06T00:00:00Z' })] })

  it('warns first, then wants the acknowledgement ticked before it records', async () => {
    const input = approved()
    await mount(input)
    fireEvent.click(ncnsButton())
    const warn = await screen.findByRole('alertdialog', { name: 'Approved time on this day' })
    expect(warn.textContent).toContain('remove the approved hours from payroll totals')

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('alertdialog', { name: 'Confirm payroll and trust' })
    const record = screen.getByRole('button', { name: 'Record NCNS' }) as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.click(record)
    expect(h.rpcCalls).toEqual([])

    fireEvent.click(screen.getByRole('checkbox'))
    expect(record.disabled).toBe(false)
    fireEvent.click(record)
    await waitFor(() => expect(input.onClose).toHaveBeenCalledTimes(1))
    expect(h.rpcCalls).toEqual([
      {
        fn: 'record_ncns_and_reject_sessions_for_day',
        args: { p_subject_user_id: 'user-1', p_work_date: '2026-01-05' },
      },
    ])
  })

  it('Back returns to the warning, unticks the acknowledgement and keeps the details', async () => {
    await mount(approved())
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByRole('alertdialog', { name: 'Confirm payroll and trust' })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Details (optional)'), { target: { value: 'called twice' } })

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('alertdialog', { name: 'Approved time on this day' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('alertdialog', { name: 'Confirm payroll and trust' })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Details (optional)') as HTMLTextAreaElement).value).toBe('called twice')
  })
})

describe('a day with an open session', () => {
  const open = (over: Partial<UseMyTimeNcnsFlowInput> = {}) =>
    makeInput({ sortedSessions: [mk('s1'), mk('s2', { clocked_out_at: null })], ...over })

  it('offers to clock it out, sweeps, re-reads the day, then opens the record dialog', async () => {
    const closed = [mk('s1'), mk('s2')]
    const input = open({ fetchDaySessionsForEditor: vi.fn(async () => closed) })
    await mount(input)
    expect(ncnsButton().title).toBe('Click to clock out open sessions at current time, then record NCNS')
    fireEvent.click(ncnsButton())

    const pre = await screen.findByRole('alertdialog', { name: 'Clock out open sessions?' })
    expect(pre.textContent).toContain('Clock out 1 open session at the current time')
    expect(pre.textContent).not.toContain('already approved')
    expect(screen.getByRole('presentation').style.zIndex).toBe('1305')
    expect(ncnsButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('alertdialog', { name: 'Record no-call, no-show?' })
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0]!.table).toBe('clock_sessions')
    expect(h.updates[0]!.id).toBe('s2')
    expect(Object.keys(h.updates[0]!.values)).toEqual(['clocked_out_at'])
    expect(new Date(String(h.updates[0]!.values.clocked_out_at)).getTime()).toBeGreaterThan(new Date(IN).getTime())
    expect(input.onLinkedSessionsUpdated).toHaveBeenCalledTimes(1)
    expect(input.setFetchedSessions).toHaveBeenCalledWith(closed)
    expect(h.rpcCalls).toEqual([])
  })

  it('counts the sessions and warns when an open one was approved', async () => {
    await mount(
      makeInput({
        sortedSessions: [
          mk('s1', { clocked_out_at: null, approved_at: '2026-01-06T00:00:00Z' }),
          mk('s2', { clocked_out_at: null }),
        ],
      })
    )
    fireEvent.click(ncnsButton())
    const pre = await screen.findByRole('alertdialog', { name: 'Clock out open sessions?' })
    expect(pre.textContent).toContain('Clock out 2 open sessions at the current time')
    expect(pre.textContent).toContain('At least one open session was already approved.')
  })

  it('the re-read opens on the approved warning when the closed day has approved time', async () => {
    const input = open({
      fetchDaySessionsForEditor: vi.fn(async () => [mk('s1', { approved_at: '2026-01-06T00:00:00Z' }), mk('s2')]),
    })
    await mount(input)
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByRole('alertdialog', { name: 'Approved time on this day' })
  })

  it('a session still open after the sweep stops it with a toast; nothing is handed to the editor', async () => {
    const input = open({ fetchDaySessionsForEditor: vi.fn(async () => [mk('s1'), mk('s2', { clocked_out_at: null })]) })
    await mount(input)
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Could not close all sessions. Try again.')
    await settle()
    // Continue closed the pre-close dialog before the sweep ran, so its error line has nowhere to show.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(input.setFetchedSessions).not.toHaveBeenCalled()
    expect(ncnsButton().disabled).toBe(false)
  })

  it('Cancel and the backdrop close the pre-close dialog without a write', async () => {
    await mount(open())
    fireEvent.click(ncnsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(ncnsButton())
    await screen.findByRole('alertdialog')
    fireEvent.click(screen.getByRole('presentation'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(h.updates).toEqual([])
  })

  it('when the parent owns the sessions it cannot close them: a toast, no dialog', async () => {
    await mount(open({ sessionsControlledByParent: true }))
    fireEvent.click(ncnsButton())
    await screen.findByText('Close open sessions in this view first, or refresh after clocking out elsewhere.')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('the editor’s sub-flow registry entry', () => {
  it('answers false with nothing open', async () => {
    await mount(makeInput())
    fireEvent.click(screen.getByTestId('close-topmost'))
    expect(screen.getByTestId('close-topmost').textContent).toBe('closed:false')
  })

  it('closes the record dialog, and the pre-close dialog', async () => {
    const { unmount } = await mount(makeInput())
    fireEvent.click(ncnsButton())
    await screen.findByRole('alertdialog', { name: 'Record no-call, no-show?' })
    fireEvent.click(screen.getByTestId('close-topmost'))
    expect(screen.getByTestId('close-topmost').textContent).toBe('closed:true')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    unmount()

    await mount(makeInput({ sortedSessions: [mk('s2', { clocked_out_at: null })] }))
    fireEvent.click(ncnsButton())
    await screen.findByRole('alertdialog', { name: 'Clock out open sessions?' })
    fireEvent.click(screen.getByTestId('close-topmost'))
    expect(screen.getByTestId('close-topmost').textContent).toBe('closed:true')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('changing the day', () => {
  it('closes an open record dialog', async () => {
    const input = makeInput()
    const { rerender } = await mount(input)
    fireEvent.click(ncnsButton())
    await screen.findByRole('alertdialog', { name: 'Record no-call, no-show?' })
    rerender(<Harness input={{ ...input, dateStr: '2026-01-06' }} />)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
