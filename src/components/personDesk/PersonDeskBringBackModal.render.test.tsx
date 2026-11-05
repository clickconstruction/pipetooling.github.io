// @vitest-environment jsdom
/**
 * Bring back (punch list #256 PR 3, v2.6523): the window on an archived desk whose employment ended. The
 * loader is mocked with the mock-up's facts; the smoke proves the wiring — the rows the kernel builds are
 * drawn, the wage row's Keep press counts down the button, a day back before the day they left blocks the
 * press, and the finish runs the kernel's plan in order (the login first, then the roster row in ONE update).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PersonDeskBringBackModal } from './PersonDeskBringBackModal'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { PersonDeskViewer } from '../../lib/people/personDeskGates'
import type { PersonKey } from '../../lib/people/personKey'
import type { BringBackLoad } from '../../lib/people/bringBackFacts'

const writes: Array<{ what: string; args: unknown }> = []
const invoke = vi.fn(async (name: string, opts: unknown) => {
  writes.push({ what: `fn:${name}`, args: opts })
  return { data: { success: true }, error: null }
})

vi.mock('../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'is', 'in', 'limit', 'order', 'not']) {
      b[op] = () => b
    }
    for (const op of ['update', 'upsert', 'insert']) {
      b[op] = (patch: unknown) => {
        writes.push({ what: `${table}.${op}`, args: patch })
        return b
      }
    }
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'u-corinne' }], error: null, count: 0 }).then(ok)
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      functions: { invoke: (...args: unknown[]) => invoke(...(args as [string, unknown])) },
    },
  }
})

vi.mock('../../contexts/ConfirmDialogContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/ConfirmDialogContext')>()
  return { ...actual, useConfirmDialog: () => async () => true }
})
vi.mock('../../lib/salaryScheduleSync', () => ({ denverWorkDateToday: () => '2029-11-05' }))

const load: BringBackLoad = {
  facts: {
    backYmd: '2029-11-05',
    leftYmd: '2026-11-03',
    hasLogin: true,
    hasRosterRow: true,
    signInEmail: 'corinne.vela@example.com',
    lastSignInYmd: '2026-11-03',
    pay: { hourlyWage: 24, isSalary: false, setYmd: null },
    needsTeam: true,
    team: { id: 't-1', name: 'Crew A' },
    licenses: [{ name: 'Journeyman plumber', date_of_expiry: '2028-06-30' }],
    paperworkSignedEarlier: { count: 5, lastYmd: '2024-03-04' },
    paperworkAssignedSinceBack: false,
    vehiclesHeld: 0,
    housing: 0,
  },
  leftYmd: '2026-11-03',
  loginArchived: true,
  personArchived: true,
  stints: [{ id: 's-1', start_date: '2024-03-04', end_date: '2026-11-03' }],
  parkedTasks: 2,
  trainingOn: false,
}
const loadFacts = vi.fn(async () => load)
vi.mock('../../lib/people/bringBackFacts', () => ({ loadBringBackFacts: (...args: unknown[]) => loadFacts(...(args as [])) }))

const KEY: PersonKey = {
  userId: 'u-corinne',
  personId: 'p-corinne',
  payName: 'Corinne Vela',
  displayName: 'Corinne Vela',
  email: 'corinne.vela@example.com',
  role: 'helpers',
  personKind: 'helper',
  archived: true,
  isSub: false,
  gaps: [],
  emailMatchedPersonId: null,
  emailMatchedPersonName: null,
  rosterName: 'Corinne Vela',
}
const DEV: PersonDeskViewer = { role: 'dev', isDev: true, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false }

function leaveOpen(reason: string) {
  const first = screen.getAllByRole('button', { name: 'Leave open…' })[0]
  if (!first) throw new Error('no Leave open… press')
  fireEvent.click(first)
  fireEvent.change(screen.getByLabelText('Reason to leave open'), { target: { value: reason } })
  fireEvent.click(screen.getByRole('button', { name: 'Leave open' }))
}

async function open() {
  const onClose = vi.fn()
  const onChanged = vi.fn()
  renderWithProviders(<PersonDeskBringBackModal personKey={KEY} viewer={DEV} viewerUserId="u-dev" onClose={onClose} onChanged={onChanged} />)
  await settle()
  await screen.findByText(/Away 3 years · first stint Mar 4, 2024 to Nov 3, 2026/)
  return { onClose, onChanged }
}

describe('PersonDeskBringBackModal', () => {
  beforeEach(() => {
    writes.length = 0
    invoke.mockClear()
    loadFacts.mockClear()
  })

  it("draws the mock-up's rows, the roadmap box unticked after three years, and training mode off", async () => {
    await open()
    expect(screen.getByRole('dialog', { name: 'Bring back Corinne Vela' })).toBeTruthy()
    expect(screen.getByText('Sign-in email')).toBeTruthy()
    expect(screen.getByText(/corinne.vela@example.com, last used Nov 2026/)).toBeTruthy()
    expect(screen.getByText('Wage')).toBeTruthy()
    expect(screen.getByText(/On Crew A/)).toBeTruthy()
    expect(screen.getByText(/Journeyman plumber expired Jun 2028/)).toBeTruthy()
    expect(screen.getByText(/5 signed in 2024\. None signed for this stint\./)).toBeTruthy()
    const roadmap = screen.getByLabelText(/Give back 2 open roadmap tasks they had in 2026/) as HTMLInputElement
    expect(roadmap.checked).toBe(false)
    const training = screen.getByLabelText(/Start in training mode/) as HTMLInputElement
    expect(training.checked).toBe(false)
    const finish = screen.getByRole('button', { name: /^Bring back · \d open$/ }) as HTMLButtonElement
    expect(finish.textContent).toBe('Bring back · 4 open')
    expect(finish.disabled).toBe(true)
  })

  it('a day back before the day they left blocks the press and points at Undo', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Back on'), { target: { value: '2026-10-01' } })
    await screen.findByText(/The day back is before Nov 3, 2026, the day they left/)
    expect(screen.getByRole('button', { name: 'Undo the end instead' })).toBeTruthy()
  })

  it('Keep, Still theirs and Leave open… bring the button to Bring back, and the finish runs the plan in order', async () => {
    const { onClose, onChanged } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Still theirs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep $24.00' }))
    // Licenses and paperwork: left open with a reason, each.
    leaveOpen('renewal in the mail')
    leaveOpen('sending Monday')
    const finish = (await screen.findByRole('button', { name: 'Bring back' })) as HTMLButtonElement
    expect(finish.disabled).toBe(false)
    fireEvent.click(finish)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onChanged).toHaveBeenCalled()
    expect(writes).toEqual([
      { what: 'fn:restore-user', args: { body: { user_id: 'u-corinne', restore_roadmap: false } } },
      { what: 'people.update', args: { archived_at: null, start_date: '2029-11-05', end_date: null } },
      {
        what: 'person_file_entries.insert',
        args: expect.objectContaining({ person_id: 'p-corinne', entry_date: '2029-11-05', source: 'milestone', content: 'Back on 2029-11-05 for Corinne Vela, after 3 years away. Left open on purpose: licenses (renewal in the mail), paperwork (sending Monday).' }),
      },
    ])
  })

  it('Change… writes the new wage after the roster row', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Still theirs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change…' }))
    fireEvent.change(screen.getByLabelText('New hourly wage'), { target: { value: '26' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save wage' }))
    await screen.findByText(/\$26\.00 \/ h, set Nov 2029/)
    leaveOpen('renewal in the mail')
    leaveOpen('sending Monday')
    fireEvent.click(screen.getByLabelText(/Give back 2 open roadmap tasks/))
    fireEvent.click(await screen.findByRole('button', { name: 'Bring back' }))
    await waitFor(() => expect(writes.some((w) => w.what === 'people_pay_config.upsert')).toBe(true))
    expect(writes.map((w) => w.what)).toEqual(['fn:restore-user', 'people.update', 'people_pay_config.upsert', 'person_file_entries.insert'])
    expect(writes).toContainEqual({ what: 'fn:restore-user', args: { body: { user_id: 'u-corinne', restore_roadmap: true } } })
    expect(writes).toContainEqual({ what: 'people_pay_config.upsert', args: { person_name: 'Corinne Vela', person_id: 'p-corinne', hourly_wage: 26 } })
  })

  it('Undo the end instead keeps the old start so the old stint reopens', async () => {
    const { onClose } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Undo the end instead' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(writes).toEqual([
      { what: 'fn:restore-user', args: { body: { user_id: 'u-corinne', restore_roadmap: true } } },
      { what: 'people.update', args: { archived_at: null, end_date: null } },
      { what: 'person_file_entries.insert', args: expect.objectContaining({ content: 'Employment end of 2026-11-03 undone for Corinne Vela on 2029-11-05: ended by mistake.' }) },
    ])
  })
})
