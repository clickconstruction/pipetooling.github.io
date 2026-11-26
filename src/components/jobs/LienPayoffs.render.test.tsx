// @vitest-environment jsdom
/**
 * Payoffs on the Lien desk (punch list #435, piece 1): the strip's one line and press, the window's places, each
 * lien's sentence and its one press, the released fold, a failed read with its reason, and a second read when the
 * desk reads again. The facts are handed in; the rule is held by `lienPayoff.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BankCheck } from '../../lib/jobs/checkCleared'
import type { LienPayoffFacts } from '../../lib/jobs/lienPayoff'
import LienPayoffs from './LienPayoffs'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Every name, address, job, instrument and amount here is made up.
const CLEARED: BankCheck = { id: 'b1', amount: 7420, status: 'sent', depositedYmd: '2026-11-14', postedYmd: '2026-11-15', bankDayYmd: '2026-11-21', checkNumber: '1184', failureReason: null }
const AT_BANK: BankCheck = { ...CLEARED, status: 'pending', depositedYmd: '2026-11-24', postedYmd: null, bankDayYmd: '2026-12-02' }
const facts = (over: Partial<LienPayoffFacts> = {}): LienPayoffFacts => ({
  affidavits: [
    { id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09' },
    { id: 'a2', job_id: 'j2', amount: 5160.5, county: 'Travis', recording_number: '2026-0412208', filed_at: '2026-11-09' },
    { id: 'a3', job_id: 'j3', amount: 900, county: 'Bastrop', recording_number: '2026-0500001', filed_at: '2026-10-02' },
  ],
  releases: [{ id: 'r3', job_id: 'j3', created_at: '2026-11-01T15:00:00Z', filed_at: '2026-11-05', recording_number: '2026-0500001', fields: { releasesFilingId: 'a3', releaseInstrument: '2026-0500990' } }],
  jobs: [
    { id: 'j1', hcp_number: null, click_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
    { id: 'j2', hcp_number: null, click_number: '2058', job_name: 'Okafor service visit', job_address: '212 Larkspur Ct Austin TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
    { id: 'j3', hcp_number: null, click_number: '1987', job_name: 'Calloway gate', job_address: '40 Calloway Road, Bastrop', customer_id: 'c2', customer_name: 'Calloway Homes' },
  ],
  openByJob: { j1: 0, j2: 5160.5, j3: 0 },
  paymentsByJob: { j1: [{ amount: 7420, paid_on: '2026-11-24', payment_type: 'Check', reference_number: '1184' }] },
  // The bank cleared check 1184: deposited Nov 14, posted Nov 15, the bank's own day Nov 21.
  bank: [CLEARED],
  todayYmd: '2026-11-24',
  ...over,
})

const draw = (over: { read?: () => Promise<LienPayoffFacts>; refreshKey?: unknown; initiallyOpen?: boolean; stripHome?: HTMLElement | null } = {}) => {
  const onOpenBill = vi.fn()
  const onOpenRelease = vi.fn()
  const read = vi.fn(over.read ?? (() => Promise.resolve(facts())))
  const ui = (key: unknown) => <LienPayoffs todayYmd="2026-11-24" refreshKey={key} onOpenBill={onOpenBill} onOpenRelease={onOpenRelease} read={read} initiallyOpen={over.initiallyOpen} {...('stripHome' in over ? { stripHome: over.stripHome } : {})} />
  const view = renderWithProviders(ui(over.refreshKey ?? 1))
  return { onOpenBill, onOpenRelease, read, rerender: (key: unknown) => view.rerender(ui(key)) }
}
const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-lien-payoff-row="${id}"]`)!
/** Wait for a node: `waitFor` only waits on a throw, and a null it is handed back is not one. */
const found = (selector: string) =>
  waitFor(() => {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) throw new Error(`${selector} is not drawn yet`)
    return el
  })

afterEach(cleanup)

describe('LienPayoffs', () => {
  it('draws one line and one press over the desk, and always its own wrapper', async () => {
    draw()
    expect(document.querySelector('[data-lien-payoffs]')).not.toBeNull()
    const strip = await found('[data-lien-payoffs-strip]')
    await waitFor(() => expect(strip.textContent).toContain('1 lien is paid and still on record.'))
    expect(strip.dataset.tone).toBe('amber')
    expect(screen.getByRole('button', { name: 'Someone paid ›' })).toBeTruthy()
    expect(document.querySelector('[data-lien-payoffs-window]')).toBeNull()
  })

  it('opens the window: the three steps, each place, each lien’s sentence and its one press', async () => {
    const { onOpenBill, onOpenRelease } = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Someone paid ›' }))
    const win = await found('[data-lien-payoffs-window]')
    expect(win.querySelector('[data-lien-payoff-legend]')!.textContent).toBe('Record the payment.Make the release and sign it before a notary.Record it at the county and save the stamp.')
    const place = win.querySelector<HTMLElement>('[data-lien-payoff-place]')!
    expect(place.textContent).toContain('212 Larkspur Court, Austin, TX')
    expect(place.textContent).toContain('Marisol Okafor')
    expect(place.querySelector('[data-lien-payoff-headline]')!.textContent).toBe('1 lien on record here. $5,160.50 pays it off. 1 more is paid.')

    const paid = rowOf('a1')
    expect(paid.dataset.step).toBe('release')
    expect(paid.querySelector('[data-lien-payoff-say]')!.textContent).toBe('Paid Nov 24 by check 1184. The release is owed.')
    expect(paid.querySelector('[data-lien-payoff-warn]')).toBeNull()
    expect([...paid.querySelectorAll<HTMLElement>('[data-lien-payoff-steps] [data-step]')].map((s) => s.dataset.state)).toEqual(['done', 'now', 'later'])
    fireEvent.click(paid.querySelector<HTMLElement>('[data-lien-payoff-press="release"]')!)
    expect(onOpenRelease).toHaveBeenCalledWith('j1')

    const owes = rowOf('a2')
    expect(owes.querySelector('[data-lien-payoff-say]')!.textContent).toBe('$5,160.50 is still open on this job’s bills.')
    expect(owes.querySelector('[data-cents]')!.textContent).toBe('.50')
    fireEvent.click(owes.querySelector<HTMLElement>('[data-lien-payoff-press="bill"]')!)
    expect(onOpenBill).toHaveBeenCalledWith('j2')
    // The window stays open under the door it sent the office through.
    expect(document.querySelector('[data-lien-payoffs-window]')).not.toBeNull()
  })

  it('offers no release while the bank has not cleared the check', async () => {
    const { onOpenRelease } = draw({ read: () => Promise.resolve(facts({ bank: [AT_BANK] })), initiallyOpen: true })
    const strip = await found('[data-lien-payoffs-strip]')
    await waitFor(() => expect(strip.textContent).toContain('1 paid lien waits for the bank to clear a check.'))
    expect(strip.dataset.tone).toBe('plain')
    const paid = rowOf('a1')
    expect(paid.dataset.step).toBe('bank')
    expect(paid.querySelector('[data-lien-payoff-say]')!.textContent).toBe('Paid Nov 24 by check 1184.')
    expect(paid.querySelector<HTMLElement>('[data-lien-payoff-warn]')!.textContent).toBe('Check 1184 is at the bank. The bank says it clears Dec 2. The release waits until then.')
    expect(paid.querySelector<HTMLElement>('[data-lien-payoff-warn]')!.dataset.lienPayoffWarn).toBe('amber')
    // The payment is recorded and no release is next: the first round is ticked and none is lit.
    expect([...paid.querySelectorAll<HTMLElement>('[data-lien-payoff-steps] [data-step]')].map((s) => s.dataset.state)).toEqual(['done', 'later', 'later'])
    expect(paid.querySelector('[data-lien-payoff-press]')).toBeNull()
    expect(paid.querySelector('[data-lien-payoff-released]')).toBeNull()
    expect(paid.querySelector('[data-lien-payoff-waiting]')!.textContent).toBe('Waits for the bank')
    expect(onOpenRelease).not.toHaveBeenCalled()
  })

  it('says on the place when a check for exactly what pays its liens off is at the bank, and when it clears', async () => {
    const forPlace: BankCheck = { ...AT_BANK, id: 'b2', amount: 5160.5, checkNumber: '2290' }
    let today = '2026-11-24'
    let rows = [CLEARED, forPlace]
    const { rerender } = draw({ read: () => Promise.resolve(facts({ bank: rows, todayYmd: today })), initiallyOpen: true })
    const line = await found('[data-lien-payoff-bank]')
    expect(line.dataset.lienPayoffBank).toBe('at_bank')
    expect(line.textContent).toBe('Check 2290 for $5,160.50 is at the bank. The bank says it clears Dec 2. Nothing is recorded until then.')
    today = '2026-12-02'
    rows = [CLEARED, { ...forPlace, status: 'sent', postedYmd: '2026-11-25' }]
    rerender(2)
    await waitFor(() => expect(document.querySelector<HTMLElement>('[data-lien-payoff-bank]')!.dataset.lienPayoffBank).toBe('cleared'))
    expect(document.querySelector('[data-lien-payoff-bank]')!.textContent).toBe('The bank cleared check 2290 for $5,160.50 on Dec 2. It is ready to record.')
  })

  it('keeps a released lien behind a fold, with no press', async () => {
    draw({ initiallyOpen: true })
    const fold = await found('[data-lien-payoffs-released-fold]')
    expect(fold.textContent).toContain('Released, 1')
    expect(document.querySelector('[data-lien-payoff-row="a3"]')).toBeNull()
    fireEvent.click(fold)
    const done = rowOf('a3')
    expect(done.querySelector('[data-lien-payoff-say]')!.textContent).toBe('Released. The county recorded it Nov 5 as 2026-0500990.')
    expect(done.querySelector('[data-lien-payoff-press]')).toBeNull()
    expect(done.querySelector('[data-lien-payoff-released]')!.textContent).toBe('Released')
  })

  it('reads again when the desk does, and closes on its ✕', async () => {
    const { read, rerender } = draw({ initiallyOpen: true })
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    rerender(2)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    fireEvent.click(document.querySelector<HTMLElement>('[data-lien-payoffs-close]')!)
    expect(document.querySelector('[data-lien-payoffs-window]')).toBeNull()
  })

  it('names the reason a read failed and offers to try again', async () => {
    let fail = true
    const { read } = draw({ read: () => (fail ? Promise.reject({ message: 'permission denied for table job_lien_filings', code: '42501' }) : Promise.resolve(facts())) })
    const strip = await found('[data-lien-payoffs-strip]')
    expect(strip.textContent).toContain('The filed liens could not be read. You don’t have access'.replace('’', "'"))
    fireEvent.click(screen.getByRole('button', { name: 'Someone paid ›' }))
    expect(document.querySelector('[data-lien-payoffs-failure]')!.textContent).toContain('The filed liens could not be read. You don’t have access'.replace('’', "'"))
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.querySelector('[data-lien-payoffs-failure]')).toBeNull())
    expect(rowOf('a1')).not.toBeNull()
  })

  it('on a phone draws its strip into the list’s own slot, so it scrolls away with the list (punch list #428)', async () => {
    const home = document.createElement('div')
    document.body.appendChild(home)
    try {
      draw({ stripHome: home })
      const strip = await found('[data-lien-payoffs-strip]')
      await waitFor(() => expect(strip.textContent).toContain('1 lien is paid and still on record.'))
      // One strip, in the slot and not in the row over the desk, which stays as an empty wrapper.
      expect(document.querySelectorAll('[data-lien-payoffs-strip]')).toHaveLength(1)
      expect(home.contains(strip)).toBe(true)
      const wrapper = document.querySelector<HTMLElement>('[data-lien-payoffs]')!
      expect(wrapper.contains(strip)).toBe(false)
      expect(wrapper.childElementCount).toBe(0)
      // The press opens the window, which is the wrapper's own and not the slot's.
      fireEvent.click(screen.getByRole('button', { name: 'Someone paid ›' }))
      const win = await found('[data-lien-payoffs-window]')
      expect(wrapper.contains(win)).toBe(true)
    } finally {
      home.remove()
    }
  })

  it('on a phone with no list up draws no strip, and a window opened from the address still stands', async () => {
    const { read } = draw({ stripHome: null, initiallyOpen: true })
    await waitFor(() => expect(read).toHaveBeenCalled())
    await found('[data-lien-payoff-row="a1"]')
    expect(document.querySelector('[data-lien-payoffs-strip]')).toBeNull()
    expect(document.querySelector('[data-lien-payoffs-window]')).not.toBeNull()
  })

  it('draws no strip when no lien is filed, and says so in the window', async () => {
    const { read } = draw({ read: () => Promise.resolve(facts({ affidavits: [], releases: [] })), initiallyOpen: true })
    await waitFor(() => expect(read).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('[data-lien-payoffs-window]')!.textContent).toContain('Nothing waiting on a release.'))
    expect(document.querySelector('[data-lien-payoffs-strip]')).toBeNull()
  })
})

describe('the payoff card (punch list #435, piece 4)', () => {
  type Keep = NonNullable<Parameters<typeof LienPayoffs>[0]['keep']>
  const okKeep: Keep = async (rows) => rows.map((r) => ({ affidavitId: r.affidavitId, ok: true, why: null }))
  const drawCard = (over: { facts?: Partial<LienPayoffFacts>; role?: 'dev' | 'assistant' | 'controller'; keep?: Keep } = {}) => {
    const onChanged = vi.fn()
    const read = vi.fn(() => Promise.resolve(facts(over.facts)))
    const keep = vi.fn<Keep>(over.keep ?? okKeep)
    renderWithProviders(<LienPayoffs todayYmd={over.facts?.todayYmd ?? '2026-11-24'} refreshKey={1} onOpenBill={() => {}} onOpenRelease={() => {}} onChanged={onChanged} read={read} keep={keep} role={over.role ?? 'dev'} who={{ id: 'u1', name: 'Alex Rivera' }} initiallyOpen />)
    return { onChanged, read, keep }
  }
  const stopStates = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('[data-lien-payoff-stop]')].map((s) => s.dataset.state)

  it('draws five stops on an open place with the line for today and the two days, and none on a released place', async () => {
    drawCard()
    const card = await found('[data-lien-payoff-card]')
    expect(document.querySelectorAll('[data-lien-payoff-card]')).toHaveLength(1)
    expect(stopStates(card)).toEqual(['now', 'done', 'now', 'later', 'later'])
    expect([...card.querySelectorAll('[data-lien-payoff-stop-say]')].map((s) => s.textContent)).toEqual(['$5,160.50 is still open on 1 of 2 liens’ bills.', 'Cleared Nov 21.', '1 to make.', 'After the notary.', 'After recording.'])
    expect(card.querySelector('[data-lien-payoff-line]')!.textContent).toBe('$5,160.50 is still open here. Record it on each bill, or type one check.')
    expect(card.dataset.tone).toBe('plain')
    expect(card.querySelector('[data-lien-payoff-clears]')!.textContent).toBe('Nov 21')
    expect(card.querySelector('[data-lien-payoff-due]')).toBeNull()
    expect(screen.getByRole('button', { name: 'not yet, the day a release was asked for in writing, press to change' })).toBeTruthy()
    expect(document.querySelector('[data-lien-payoff-funds-open]')).toBeNull()
    // The released place behind the fold draws no card.
    fireEvent.click(await found('[data-lien-payoffs-released-fold]'))
    await waitFor(() => expect(document.querySelectorAll('[data-lien-payoff-place]').length).toBe(2))
    expect(document.querySelectorAll('[data-lien-payoff-card]')).toHaveLength(1)
  })

  it('keeps the day a release was asked for on every lien not yet released, shows the due day, and reads again', async () => {
    const { keep, read, onChanged } = drawCard()
    await found('[data-lien-payoff-card]')
    fireEvent.click(screen.getByRole('button', { name: 'not yet, the day a release was asked for in writing, press to change' }))
    fireEvent.change(screen.getByLabelText(/the day a release was asked for in writing/), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0].map((r) => r.affidavitId)).toEqual(['a1', 'a2'])
    expect(keep.mock.calls[0]![1]).toEqual({ askedYmd: '2026-11-20' })
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('names the lien that did not take the day under the field', async () => {
    const { keep } = drawCard({ keep: async (rows) => rows.map((r, i) => ({ affidavitId: r.affidavitId, ok: i === 0, why: i === 0 ? null : 'The row is locked.' })) })
    await found('[data-lien-payoff-card]')
    fireEvent.click(screen.getByRole('button', { name: 'not yet, the day a release was asked for in writing, press to change' }))
    fireEvent.change(screen.getByLabelText(/the day a release was asked for in writing/), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('[data-lien-payoff-card]')!.textContent).toContain('The row is locked.'))
  })

  it('offers The bank confirmed the funds to a dev while the check is at the bank, writes it with the note, and tells the desk', async () => {
    const { keep, read, onChanged } = drawCard({ facts: { bank: [AT_BANK] } })
    const card = await found('[data-lien-payoff-card]')
    expect(stopStates(card)).toEqual(['now', 'now', 'later', 'later', 'later'])
    expect(card.querySelector('[data-lien-payoff-stop="bank"] [data-lien-payoff-stop-say]')!.textContent).toBe('The bank says Dec 2.')
    expect(card.querySelector('[data-lien-payoff-clears]')!.textContent).toBe('Dec 2')
    fireEvent.click(screen.getByRole('button', { name: 'The bank confirmed the funds ›' }))
    const confirm = await found('[data-lien-payoff-funds-confirm]')
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(document.querySelector('[data-lien-payoff-funds-note]')!, { target: { value: 'called the bank, the funds are good' } })
    expect((confirm as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0]).toEqual([{ affidavitId: 'a1', fields: null }])
    const change = keep.mock.calls[0]![1]
    expect(change.funds).toMatchObject({ by: 'u1', name: 'Alex Rivera', note: 'called the bank, the funds are good' })
    expect(typeof change.funds?.at).toBe('string')
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(onChanged).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.querySelector('[data-lien-payoff-funds-box]')).toBeNull())
  })

  it('shows the funds press to a controller and not to an assistant', async () => {
    drawCard({ facts: { bank: [AT_BANK] }, role: 'assistant' })
    await found('[data-lien-payoff-card]')
    expect(document.querySelector('[data-lien-payoff-funds-open]')).toBeNull()
    cleanup()
    drawCard({ facts: { bank: [AT_BANK] }, role: 'controller' })
    await found('[data-lien-payoff-funds-open]')
  })

  it('reads a confirmed check as cleared, with whose word, and offers the release', async () => {
    const funds = { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T15:04:00Z', note: 'the funds are good' }
    const confirmed = facts({ bank: [AT_BANK] })
    drawCard({ facts: { ...confirmed, affidavits: confirmed.affidavits.map((a) => (a.id === 'a1' ? { ...a, fields: { fundsConfirmed: funds } } : a)) } })
    const card = await found('[data-lien-payoff-card]')
    expect(card.querySelector('[data-lien-payoff-stop="bank"]')!.getAttribute('data-state')).toBe('done')
    expect(card.querySelector('[data-lien-payoff-stop="bank"] [data-lien-payoff-stop-say]')!.textContent).toBe('Alex Rivera confirmed the funds Nov 26.')
    expect(document.querySelector('[data-lien-payoff-funds-open]')).toBeNull()
    expect(rowOf('a1').dataset.step).toBe('release')
    expect(rowOf('a1').querySelector('[data-lien-payoff-say]')!.textContent).toBe('Paid Nov 24 by check 1184. Alex Rivera confirmed the funds Nov 26. The release is owed.')
  })
})
