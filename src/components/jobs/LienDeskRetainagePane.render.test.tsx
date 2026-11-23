// @vitest-environment jsdom
/**
 * The retainage pane's values in place (punch list #399, the Lien desk's second screen). Every day, amount and name
 * is drawn apart from its words, one fact a line. The three facts a person types are changed where they sit: the day
 * our contract ended asks first and says which day the notice is then due, and how it ended, the retainage and the
 * bond are saved on Keep. A job whose contract is still open starts its clock in two steps on one line, the way and
 * then the day, with nothing written until the day is kept. Every name, day and dollar here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { JobRetainage } from '../../hooks/useJobRetainage'
import { buildLienRetainageQueue, retainageGates, type LienRetainageEntry, type LienRetainageRow } from '../../lib/jobs/lienDeskRetainage'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const retainageState: { value: JobRetainage | null; loading: boolean } = { value: null, loading: false }
const reloadRetainage = vi.fn()
vi.mock('../../hooks/useJobRetainage', () => ({ useJobRetainage: () => ({ retainage: retainageState.value, loading: retainageState.loading, error: null, reload: reloadRetainage }) }))
const saveFacts = vi.fn(async (..._args: unknown[]) => {})
vi.mock('../../lib/jobs/lienRetainageFactsIo', () => ({ saveLienContractFacts: (...args: unknown[]) => saveFacts(...args) }))
const mobile = { value: false }
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobile.value }))

import LienDeskRetainagePane from './LienDeskRetainagePane'

const TODAY = '2026-09-24'
const JOB = 'job-1'
const WHO = 'user-1'

const row = (over: Partial<LienRetainageRow> = {}): LienRetainageRow => ({
  job_id: JOB,
  retainage_held: 4200,
  contract_ended_on: '2026-09-03',
  contract_ended_how: 'complete',
  deadline: '2026-10-05',
  noticed: false,
  in_claim: false,
  open_balance: 9100,
  customer_id: 'c1',
  gc_customer_id: 'gc1',
  property_kind: 'commercial',
  has_owner: true,
  payment_bond: 'unknown',
  desk_item_id: null,
  desk_status: null,
  ...over,
})
const entryFor = (r: LienRetainageRow): LienRetainageEntry => buildLienRetainageQueue([r], [], TODAY).entries[0]!

const dataFor = (r: LienRetainageRow): LienDeskData =>
  ({
    jobsById: { [JOB]: { id: JOB, hcp_number: '4410', click_number: null, job_name: 'Made Up Tower', job_address: '12 Nowhere St', gc_customer_id: 'gc1', customer_address_id: null, master_user_id: 'm1', last_work_date: '2026-09-02', lien_retainage_held: r.retainage_held, lien_payment_bond: r.payment_bond, lien_contract_ended_on: r.contract_ended_on, lien_contract_ended_how: r.contract_ended_how, service_type: { name: 'Plumbing' } } },
    gcsById: { gc1: { id: 'gc1', name: 'Pretend Builders', address: '9 Fake Ave', email: 'gc@example.test', policy: 'ask', policyNote: '' } },
    addressesById: {},
    ownerByJob: { [JOB]: { owner_name: 'Olive Owner', company_name: '', mailing_address: '1 Owner Way' } },
    promisesByJob: {},
    gcsWithPriorNotice: new Set<string>(),
    gcsHeldBefore: new Set<string>(),
  }) as unknown as LienDeskData

const onChanged = vi.fn()
const onOpenEditJob = vi.fn()

function draw(r: LienRetainageRow = row(), opts: { role?: string; footer?: HTMLElement | null } = {}) {
  return renderWithProviders(
    <LienDeskRetainagePane
      entry={entryFor(r)}
      data={dataFor(r)}
      todayYmd={TODAY}
      authRole={opts.role ?? 'assistant'}
      authUserId={WHO}
      authName="Pat Office"
      issuer={null}
      signerNameFor={() => 'Sam Signer'}
      leaderNameFor={() => 'Malachi'}
      onChanged={onChanged}
      onOpenEditJob={onOpenEditJob}
      onOpenRun={vi.fn()}
      onShowNotices={vi.fn()}
      footerEl={opts.footer ?? null}
    />,
  )
}

const facts = () => document.querySelector('[data-lien-retainage-facts]') as HTMLElement
const press = (name: string) => screen.getByRole('button', { name })
const DAY = 'Sep 3, the day our contract ended, press to change'
const HOW = 'complete, how our contract ended, press to change'
const HELD = '$4,200, retainage the GC holds, press to change'
const BOND = 'unknown, payment bond on the project, press to change'
const windowUp = () => screen.queryByRole('alertdialog') ?? screen.queryByRole('dialog')

beforeEach(() => {
  retainageState.value = null
  retainageState.loading = false
  mobile.value = false
  saveFacts.mockReset()
  saveFacts.mockImplementation(async () => {})
  reloadRetainage.mockReset()
  onChanged.mockReset()
  onOpenEditJob.mockReset()
})
afterEach(() => cleanup())

describe('the pane’s facts, one a line', () => {
  it('draws each gate’s own words on the left and its value on the right', async () => {
    draw()
    await settle()
    const r = row()
    const labels = Array.from(facts().querySelectorAll('.vipLineLabel')).map((n) => n.textContent)
    expect(labels).toEqual([...retainageGates(r).map((g) => `✓ ${g.label}`), 'The § 53.057 notice is due by', 'Retainage the notice claims', 'Still unpaid on this job', 'Payment bond on the project'])
    const values = Array.from(facts().querySelectorAll('.vipLineValues')).map((n) => n.textContent)
    expect(values).toEqual(['Olive Owner', 'Pretend Builders', 'completeSep 3', '$4,200', 'Oct 5', '$4,200', '$9,100', 'unknown'])
  })

  it('a value the app works out is bold with no press, and a value a person types is a press', async () => {
    draw()
    await settle()
    const worked = Array.from(facts().querySelectorAll('[data-value="worked-out"]')).map((n) => n.textContent)
    expect(worked).toEqual(['Olive Owner', 'Pretend Builders', 'Oct 5', '$4,200', '$9,100'])
    const changeable = Array.from(facts().querySelectorAll('button[data-value="changeable"]')).map((n) => n.getAttribute('aria-label'))
    expect(changeable).toEqual([HOW, DAY, HELD, BOND])
  })

  it('holds no door to Edit Job for a value already on the screen', async () => {
    draw()
    await settle()
    expect(screen.queryByRole('button', { name: /Change ›/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Set on the job ›/ })).toBeNull()
  })

  it('the chip and the window line draw their days and counts as values, in the kernels’ own words', async () => {
    draw()
    await settle()
    const chip = document.querySelector('[data-lien-retainage-deadline]') as HTMLElement
    expect(chip.textContent).toBe('§ 53.057 · mail in 11d')
    expect(Array.from(chip.querySelectorAll('[data-value="worked-out"]')).map((n) => n.textContent)).toEqual(['11d'])
    const line = document.querySelector('[data-lien-retainage-window]') as HTMLElement
    expect(line.textContent).toBe('§ 53.057 · 30 days from the day our contract on the job ended · complete Sep 3')
    expect(Array.from(line.querySelectorAll('[data-value="worked-out"]')).map((n) => n.textContent)).toEqual(['30 days', 'Sep 3'])
  })

  it('a missing owner keeps its door to the property record', async () => {
    draw(row({ has_owner: false }))
    await settle()
    fireEvent.click(press('Property record ›'))
    expect(onOpenEditJob).toHaveBeenCalledWith(JOB, 'property-record')
  })
})

describe('the day our contract ended: changed in place, and it asks first', () => {
  it('press, type, Keep: the window says which day the notice is then due, and its press is the one write', async () => {
    draw()
    await settle()
    fireEvent.click(press(DAY))
    const box = screen.getByLabelText('the day our contract ended') as HTMLInputElement
    expect(box.value).toBe('2026-09-03')
    fireEvent.change(box, { target: { value: '2026-09-10' } })
    expect(facts().querySelector('.vipPreview')?.textContent).toBe('The § 53.057 notice would be due by Oct 12.')
    fireEvent.click(press('Keep'))
    const ask = await screen.findByText('Move the day our contract ended?')
    expect(ask).toBeTruthy()
    expect(document.body.textContent).toContain('The day moves from Sep 3 to Sep 10. The § 53.057 retainage notice is then due by Oct 12. It was due by Oct 5.')
    expect(saveFacts).not.toHaveBeenCalled()
    fireEvent.click(press('Move the day'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    const [jobId, patch] = saveFacts.mock.calls[0] as [string, Record<string, unknown>]
    expect(jobId).toBe(JOB)
    expect(patch).toMatchObject({ lien_contract_ended_on: '2026-09-10', lien_contract_ended_how: 'complete', lien_contract_ended_set_by: WHO })
    expect(typeof patch.lien_contract_ended_set_at).toBe('string')
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(reloadRetainage).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByLabelText('the day our contract ended')).toBeNull())
    // Until the desk reads the job again, the line shows what was kept and the day the window named, never the old day.
    expect(press('Sep 10, the day our contract ended, press to change')).toBeTruthy()
    expect(document.querySelector('[data-lien-retainage-due]')?.textContent).toBe('Oct 12')
  })

  it('the desk’s next read of the job wins over what the pane was showing as kept', async () => {
    const view = draw()
    await settle()
    fireEvent.click(press(HELD))
    fireEvent.change(screen.getByLabelText('retainage the GC holds'), { target: { value: '5000' } })
    fireEvent.click(press('Keep'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(press('$5,000, retainage the GC holds, press to change')).toBeTruthy())
    expect(document.querySelector('[data-lien-retainage-claim]')?.textContent).toBe('$5,000')
    const next = row({ retainage_held: 5200 })
    view.rerender(
      <LienDeskRetainagePane entry={entryFor(next)} data={dataFor(next)} todayYmd={TODAY} authRole="assistant" authUserId={WHO} authName="Pat Office" issuer={null} signerNameFor={() => 'Sam Signer'} leaderNameFor={() => 'Malachi'} onChanged={onChanged} onOpenEditJob={onOpenEditJob} onOpenRun={vi.fn()} onShowNotices={vi.fn()} footerEl={null} />,
    )
    await settle()
    expect(press('$5,200, retainage the GC holds, press to change')).toBeTruthy()
  })

  it('Cancel in the window writes nothing', async () => {
    draw()
    await settle()
    fireEvent.click(press(DAY))
    fireEvent.change(screen.getByLabelText('the day our contract ended'), { target: { value: '2026-09-10' } })
    fireEvent.click(press('Keep'))
    await screen.findByText('Move the day our contract ended?')
    const dialog = windowUp() as HTMLElement
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(saveFacts).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('Escape on the open field saves nothing and opens no window', async () => {
    draw()
    await settle()
    fireEvent.click(press(DAY))
    const box = screen.getByLabelText('the day our contract ended')
    fireEvent.change(box, { target: { value: '2026-09-10' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    await settle()
    expect(screen.queryByLabelText('the day our contract ended')).toBeNull()
    expect(screen.queryByText('Move the day our contract ended?')).toBeNull()
    expect(saveFacts).not.toHaveBeenCalled()
  })

  it('a write the database refuses keeps the field open with what was typed, and says the reason', async () => {
    saveFacts.mockImplementation(async () => {
      throw { message: 'new row violates row-level security policy', code: '42501' }
    })
    draw()
    await settle()
    fireEvent.click(press(DAY))
    fireEvent.change(screen.getByLabelText('the day our contract ended'), { target: { value: '2026-09-10' } })
    fireEvent.click(press('Keep'))
    await screen.findByText('Move the day our contract ended?')
    fireEvent.click(press('Move the day'))
    const why = await screen.findByRole('alert')
    expect(why.textContent).toBe("You don't have access to this record.")
    expect((screen.getByLabelText('the day our contract ended') as HTMLInputElement).value).toBe('2026-09-10')
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('how it ended, the retainage and the bond: saved on Keep', () => {
  it('another way of ending is saved at once with the same day, and no window asks', async () => {
    draw()
    await settle()
    fireEvent.click(press(HOW))
    fireEvent.change(screen.getByLabelText('how our contract ended'), { target: { value: 'terminated' } })
    fireEvent.click(press('Keep'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    expect(saveFacts.mock.calls[0]?.[1]).toMatchObject({ lien_contract_ended_on: '2026-09-03', lien_contract_ended_how: 'terminated', lien_contract_ended_set_by: WHO })
    expect(screen.queryByText(/\?$/)).toBeNull()
  })

  it('Still open on an ended contract asks first, then empties the four ended columns', async () => {
    draw()
    await settle()
    fireEvent.click(press(HOW))
    fireEvent.change(screen.getByLabelText('how our contract ended'), { target: { value: 'open' } })
    fireEvent.click(press('Keep'))
    await screen.findByText('Mark our contract still open?')
    expect(document.body.textContent).toContain('The day our contract ended comes off the job, and the 30-day clock stops. The § 53.057 retainage notice was due by Oct 5.')
    expect(saveFacts).not.toHaveBeenCalled()
    fireEvent.click(press('Mark it still open'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    expect(saveFacts.mock.calls[0]?.[1]).toEqual({ lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_by: null, lien_contract_ended_set_at: null })
  })

  it('the retainage: Escape saves nothing; then press, type, Keep saves the figure once', async () => {
    draw()
    await settle()
    fireEvent.click(press(HELD))
    const first = screen.getByLabelText('retainage the GC holds') as HTMLInputElement
    expect(first.value).toBe('4200')
    fireEvent.change(first, { target: { value: '5000' } })
    fireEvent.keyDown(first, { key: 'Escape' })
    await settle()
    expect(saveFacts).not.toHaveBeenCalled()
    fireEvent.click(press(HELD))
    const box = screen.getByLabelText('retainage the GC holds')
    fireEvent.change(box, { target: { value: '5000' } })
    expect(facts().querySelector('.vipPreview')?.textContent).toBe('The notice would claim $5,000.')
    fireEvent.click(press('Keep'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    expect(saveFacts.mock.calls[0]).toEqual([JOB, { lien_retainage_held: 5000 }])
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  it('an emptied or a negative figure is held with its reason', async () => {
    draw()
    await settle()
    fireEvent.click(press(HELD))
    const box = screen.getByLabelText('retainage the GC holds')
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.click(press('Keep'))
    expect(screen.getByRole('alert').textContent).toBe('Type a number first.')
    fireEvent.change(box, { target: { value: '-5' } })
    fireEvent.click(press('Keep'))
    expect(screen.getByRole('alert').textContent).toBe('Type 0 or more.')
    expect(saveFacts).not.toHaveBeenCalled()
  })

  it('a figure read from a pay application is locked, with where it is changed', async () => {
    retainageState.value = { line: null, figure: { source: 'pay_application', amount: 4200, applicationNumber: 3 }, facts: null, jobStatus: null, releaseBillLabel: null }
    draw()
    await settle()
    expect(screen.queryByRole('button', { name: HELD })).toBeNull()
    const locked = facts().querySelector('[data-value="locked"]') as HTMLElement
    expect(locked.textContent).toBe('$4,200')
    expect(locked.parentElement?.getAttribute('title')).toBe('The latest saved pay application is the source. Change it in the AIA window.')
    expect(facts().querySelector('.vipTag')?.textContent).toBe('pay application')
  })

  it('the bond is picked from its list and saved', async () => {
    draw()
    await settle()
    fireEvent.click(press(BOND))
    fireEvent.change(screen.getByLabelText('payment bond on the project'), { target: { value: 'yes' } })
    fireEvent.click(press('Keep'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    expect(saveFacts.mock.calls[0]).toEqual([JOB, { lien_payment_bond: 'yes' }])
  })
})

describe('a contract still open: the clock starts on the line', () => {
  const open = () => row({ contract_ended_on: null, contract_ended_how: null, deadline: null })

  it('reads still open, with no day and no deadline line', async () => {
    draw(open())
    await settle()
    expect(press('still open, how our contract ended, press to change')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /the day our contract ended/ })).toBeNull()
    expect(document.querySelector('[data-lien-retainage-due]')).toBeNull()
  })

  it('pick the way, then the day: nothing is written until the window’s press', async () => {
    draw(open())
    await settle()
    fireEvent.click(press('still open, how our contract ended, press to change'))
    fireEvent.change(screen.getByLabelText('how our contract ended'), { target: { value: 'complete' } })
    fireEvent.click(press('Keep'))
    await settle()
    expect(saveFacts).not.toHaveBeenCalled()
    // The day's box is open beside the pick, with the cursor in it, and the line says nothing is saved yet.
    const box = screen.getByLabelText('the day our contract ended') as HTMLInputElement
    expect(box.value).toBe('')
    expect(document.activeElement).toBe(box)
    expect(document.querySelector('[data-lien-retainage-not-saved]')?.textContent).toBe('Not saved yet. Set the day.')
    expect(facts().querySelector('.vipNote')?.textContent).toBe('The day our contract was complete. The last approved clock day is Sep 2.')
    fireEvent.change(box, { target: { value: '2026-09-03' } })
    fireEvent.click(press('Keep'))
    await screen.findByText('Start the 30-day clock?')
    expect(document.body.textContent).toContain('Our contract on this job was complete on Sep 3. The § 53.057 retainage notice is then due by Oct 5.')
    expect(saveFacts).not.toHaveBeenCalled()
    fireEvent.click(press('Start the clock'))
    await waitFor(() => expect(saveFacts).toHaveBeenCalledTimes(1))
    expect(saveFacts.mock.calls[0]?.[1]).toMatchObject({ lien_contract_ended_on: '2026-09-03', lien_contract_ended_how: 'complete', lien_contract_ended_set_by: WHO })
    // The line reads what was just saved while the desk reads the job again: never *still open*.
    await waitFor(() => expect(press(DAY)).toBeTruthy())
    expect(press(HOW)).toBeTruthy()
    expect(document.querySelector('[data-lien-retainage-not-saved]')).toBeNull()
    expect(document.querySelector('[data-lien-retainage-due]')?.textContent).toBe('Oct 5')
  })

  it('a day’s box closed with Cancel leaves the pick unsaved and says so; Still open takes the pick back', async () => {
    draw(open())
    await settle()
    fireEvent.click(press('still open, how our contract ended, press to change'))
    fireEvent.change(screen.getByLabelText('how our contract ended'), { target: { value: 'abandoned' } })
    fireEvent.click(press('Keep'))
    await settle()
    fireEvent.click(press('Cancel'))
    await settle()
    expect(press('abandoned, how our contract ended, press to change')).toBeTruthy()
    expect(press('no day yet, the day our contract ended, press to change')).toBeTruthy()
    expect(document.querySelector('[data-lien-retainage-not-saved]')).toBeTruthy()
    fireEvent.click(press('abandoned, how our contract ended, press to change'))
    fireEvent.change(screen.getByLabelText('how our contract ended'), { target: { value: 'open' } })
    fireEvent.click(press('Keep'))
    await settle()
    expect(press('still open, how our contract ended, press to change')).toBeTruthy()
    expect(document.querySelector('[data-lien-retainage-not-saved]')).toBeNull()
    expect(saveFacts).not.toHaveBeenCalled()
  })

  it('the footer’s press opens the fact’s own field on its line, and no Edit Job', async () => {
    const footer = document.createElement('div')
    document.body.appendChild(footer)
    try {
      draw(open(), { footer })
      await settle()
      expect(screen.queryByLabelText('how our contract ended')).toBeNull()
      fireEvent.click(within(footer).getByRole('button', { name: 'Set the day our contract ended' }))
      await settle()
      expect(screen.getByLabelText('how our contract ended')).toBeTruthy()
      expect(onOpenEditJob).not.toHaveBeenCalled()
    } finally {
      footer.remove()
    }
  })
})

describe('a role that cannot change the job’s lien facts', () => {
  it('reads every value with no press', async () => {
    draw(row(), { role: 'estimator' })
    await settle()
    expect(facts().querySelector('button')).toBeNull()
    expect(Array.from(facts().querySelectorAll('.vipLineValues')).map((n) => n.textContent)).toEqual(['Olive Owner', 'Pretend Builders', 'completeSep 3', '$4,200', 'Oct 5', '$4,200', '$9,100', 'unknown'])
  })
})
