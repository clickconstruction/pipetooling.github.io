// @vitest-environment jsdom
/**
 * Job Mode's On my way (v2.5573, punch list #112), at a phone's 375 px: the sheet picks the suggested job, fills the
 * office's line for Dana with the minutes guessed from the phone, says the two acts, and the press clocks the tech in
 * as on the way and sends the line; the minutes step by five and can be typed; a hold says why no text goes and the
 * press promises only the clock; the phone at the job turns the press into I'm here; a guessed arrival past the
 * window gets its line. Made-up people: Luis on the job, Dana Whitfield and Priya Natarajan.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { phoneLinesFromRows, type PhoneLineRow } from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer } from '../../lib/jobModeMessageCustomerIo'
import type { OnMyWayIo } from '../../lib/jobModeOnMyWayIo'
import type { BioLine } from '../../lib/bio/bio'
import { OnMyWaySheet, type OnMyWayDestination } from './OnMyWaySheet'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

const row = (id: string, text: string, extra: Partial<PhoneLineRow>): PhoneLineRow => ({
  id, text, for_kind: 'customer', step_key: null, scope: 'team', added_by: 'rosa', added_at: '2026-10-12T14:00:00Z', removed_at: null,
  phone_order: null, phone_name: null, text_es: null, ...extra,
})
const LINES = phoneLinesFromRows([
  row('q1', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', { phone_order: 1, phone_name: 'On my way', phone_press: 'on_my_way' }),
  row('q2', '{first}, this is {me} with Click Plumbing. I am here at {address}.', { phone_order: 2, phone_name: 'I’m here', phone_press: 'im_here' }),
  row('q3', '{first}, I am running late. The new window is {window}.', { phone_order: 3 }),
]).map((l, i) => ({ ...l, phonePress: (['on_my_way', 'im_here', null] as const)[i] ?? null }))

const DANA: JobModeCustomer = { customerId: 'cust-dana', customerName: 'Dana Whitfield', contactId: 'contact-dana', tail: [] }
const PRIYA: JobModeCustomer = { customerId: 'cust-priya', customerName: 'Priya Natarajan', contactId: null, tail: [] }
const NOBODY: JobModeCustomer = { customerId: null, customerName: null, contactId: null, tail: [] }

const WHITFIELD: OnMyWayDestination = { jobId: 'job-512', label: 'PLUM 512 · Whitfield water heater', sublabel: '10:30 AM · 1208 Mesquite Ln', suggested: true, jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', timeEnd: '13:00:00' }
const RIVERBEND: OnMyWayDestination = { jobId: 'job-77', label: 'GAS 77 · Riverbend gas test', sublabel: '1:00 PM · 44 Riverbend Rd', suggested: false, jobName: 'Riverbend gas test', jobAddress: '44 Riverbend Rd', timeEnd: '15:00:00' }

const ME = { lat: 29.653, lng: -97.797 }
/** About seven straight miles east: sixteen minutes at 35 mph, which the guess rounds up to twenty. */
const FAR = { lat: 29.653, lng: -97.68 }

// 12:15 PM in Chicago, so twenty minutes lands inside Whitfield's 1:00 window and 170 past Riverbend's 3:00.
const NOON_15 = Date.parse('2026-10-16T17:15:00Z')

type Fake = OnMyWayIo & { send: ReturnType<typeof vi.fn>; arrive: ReturnType<typeof vi.fn> }
function fakeIo(set: Partial<OnMyWayIo> = {}): Fake {
  return {
    loadCustomer: vi.fn((jobId: string) => Promise.resolve(jobId === 'job-77' ? PRIYA : DANA)),
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadBlocks: vi.fn(() => Promise.resolve([])),
    send: vi.fn(() => Promise.resolve()),
    noteToOffice: vi.fn(() => Promise.resolve()),
    loadTextsOn: vi.fn(() => Promise.resolve(true)),
    loadPressLines: vi.fn(() => Promise.resolve(LINES)),
    loadJobPoint: vi.fn(() => Promise.resolve(FAR)),
    loadMyPoint: vi.fn(() => Promise.resolve(ME)),
    loadTravelFacts: vi.fn(() => Promise.resolve(null)),
    arrive: vi.fn(() => Promise.resolve(true)),
    loadMyBio: vi.fn(() => Promise.resolve(null)),
    loadIntroduced: vi.fn(() => Promise.resolve(null)),
    ...set,
  } as Fake
}

function mount(io: OnMyWayIo, over: Partial<Parameters<typeof OnMyWaySheet>[0]> = {}) {
  const apply = vi.fn(() => Promise.resolve({ ok: true, error: null }))
  const onDone = vi.fn()
  const onClose = vi.fn()
  const onFinishDay = vi.fn()
  renderWithProviders(
    <OnMyWaySheet
      userId="luis"
      me="Luis Ortega"
      role="primary"
      destinations={[WHITFIELD]}
      initialJobId={null}
      leaving={null}
      canFinishDay={false}
      apply={apply}
      onFinishDay={onFinishDay}
      onDone={onDone}
      onClose={onClose}
      io={io}
      today="2026-10-16"
      now={() => NOON_15}
      {...over}
    />,
  )
  return { apply, onDone, onClose, onFinishDay }
}

/**
 * The preview paints as soon as the customer and the lines are read, while the two points (the phone's and the job's)
 * are still on their way, so for a tick it holds the bare {minutes}; a loaded runner (the merge group, 2026-10-16) read
 * it there. Wait for the guess to fill the box before reading the preview or stepping the minutes.
 */
async function guessed(minutes = '20'): Promise<void> {
  await waitFor(() => expect((screen.getByTestId('on-my-way-minutes') as HTMLInputElement).value).toBe(minutes))
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  window.matchMedia = ((q: string) => ({ matches: /max-width:\s*640px/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
})
afterEach(cleanup)

/**
 * The primary press, once the sheet can take it: it is disabled until the reads behind canGo settle, and on a loaded
 * runner a click that lands before then does nothing (the queue run of 03:49, the deploys of 06:33 and 11:59, 2026-10-17).
 */
async function pressPrimary() {
  const primary = screen.getByTestId('on-my-way-primary') as HTMLButtonElement
  await waitFor(() => expect(primary.disabled).toBe(false), { timeout: 4000 })
  fireEvent.click(primary)
}

describe('OnMyWaySheet at 375 px', { timeout: 15_000 }, () => {
  it('fills the office’s line for Dana with the guessed minutes, says both acts, and the press clocks in as on the way then sends', async () => {
    const io = fakeIo()
    const { apply, onDone, onClose } = mount(io)
    expect(screen.getByRole('dialog', { name: 'On my way' })).toBeTruthy()
    const dest = screen.getByTestId('on-my-way-destination')
    expect(dest.getAttribute('aria-pressed')).toBe('true')
    expect(dest.textContent).toContain('Suggested')
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    expect(screen.getByTestId('on-my-way-preview').textContent).toBe('Dana, this is Luis with Click Plumbing. I am on my way, about 20 minutes out.')
    expect(screen.getByTestId('on-my-way-guess').textContent).toMatch(/^Guessed from your phone to the job, 9\.\d mi\./)
    expect(screen.getAllByTestId('on-my-way-act').map((p) => p.textContent)).toEqual([
      '⏱Clocks you in on PLUM 512 · Whitfield water heater as on the way.',
      '💬Texts Dana from the company number. Their answer comes back to you.',
    ])
    expect(screen.queryByTestId('on-my-way-window')).toBeNull()
    const primary = screen.getByTestId('on-my-way-primary') as HTMLButtonElement
    expect(primary.textContent).toBe('On my way, text Dana')
    expect(primary.disabled).toBe(false)
    expect(screen.getByTestId('on-my-way-secondary').textContent).toBe('Clock in, no text')
    fireEvent.click(primary)
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 })
    expect(apply).toHaveBeenCalledWith({ jobLedgerId: 'job-512', bidId: null, notes: 'On my way to PLUM 512 · Whitfield water heater, about 20 min', travel: 'on-the-way' })
    expect(io.send).toHaveBeenCalledWith({ from: 'job_mode', customerId: 'cust-dana', contactId: 'contact-dana', jobId: 'job-512', quickReplyId: 'q1', fills: { minutes: '20' } })
    expect(onDone).toHaveBeenCalled()
  })

  it('steps the minutes by five, keeps what the tech typed, and Clock in, no text clocks in without a send', async () => {
    const io = fakeIo()
    const { apply } = mount(io)
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    fireEvent.click(screen.getByLabelText('Five minutes more'))
    expect((screen.getByTestId('on-my-way-minutes') as HTMLInputElement).value).toBe('25')
    expect(screen.getByTestId('on-my-way-preview').textContent).toContain('about 25 minutes')
    fireEvent.change(screen.getByTestId('on-my-way-minutes'), { target: { value: '12' } })
    fireEvent.click(screen.getByLabelText('Five minutes less'))
    expect((screen.getByTestId('on-my-way-minutes') as HTMLInputElement).value).toBe('10')
    fireEvent.click(screen.getByTestId('on-my-way-secondary'))
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ jobLedgerId: 'job-512', bidId: null, notes: 'On my way to PLUM 512 · Whitfield water heater, about 10 min', travel: 'on-the-way' }))
    expect(io.send).not.toHaveBeenCalled()
  })

  it('with no GPS the minutes are typed, and Send waits until they are', async () => {
    const io = fakeIo({ loadMyPoint: vi.fn(() => Promise.resolve(null)) })
    mount(io)
    await screen.findByTestId('on-my-way-preview')
    await waitFor(() => expect(screen.getByTestId('on-my-way-guess').textContent).toBe('Type how many minutes out you are.'))
    const primary = screen.getByTestId('on-my-way-primary') as HTMLButtonElement
    expect(primary.disabled).toBe(true)
    expect(primary.title).toBe('Type the minutes, or press Start here instead.')
    fireEvent.change(screen.getByTestId('on-my-way-minutes'), { target: { value: '15' } })
    expect(primary.disabled).toBe(false)
    expect(screen.getByTestId('on-my-way-preview').textContent).toContain('about 15 minutes')
  })

  it('a job with no customer: the hold row, a press that promises only the clock, and Start here instead arrives at once', async () => {
    const io = fakeIo({ loadCustomer: vi.fn(() => Promise.resolve(NOBODY)) })
    const { apply } = mount(io)
    expect((await screen.findByTestId('on-my-way-hold')).textContent).toBe('⚠No text: this job has no customer yet.')
    expect(screen.queryByTestId('on-my-way-preview')).toBeNull()
    expect(screen.getByTestId('on-my-way-primary').textContent).toBe('On my way')
    expect(screen.queryByTestId('on-my-way-secondary')).toBeNull()
    fireEvent.click(screen.getByTestId('on-my-way-start-here'))
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ jobLedgerId: 'job-512', bidId: null, notes: 'On site at PLUM 512 · Whitfield water heater', travel: 'on-site' }))
    expect(io.send).not.toHaveBeenCalled()
  })

  it('texts off: the switch’s words in the hold row', async () => {
    mount(fakeIo({ loadTextsOn: vi.fn(() => Promise.resolve(false)) }))
    expect((await screen.findByTestId('on-my-way-hold')).textContent).toBe('⚠No text: texts are off. The owner or a dev turns them on in Settings → Phone and texts.')
  })

  it('the phone at the job: the press becomes I’m here, clocks in on site and sends the I’m here line', async () => {
    const io = fakeIo({ loadJobPoint: vi.fn(() => Promise.resolve(ME)) })
    const { apply } = mount(io)
    expect((await screen.findByText('Your phone says you are already there, so there is no drive to text.')).tagName).toBe('P')
    expect(screen.getByTestId('on-my-way-preview').textContent).toBe('Dana, this is Luis with Click Plumbing. I am here at 1208 Mesquite Ln.')
    expect(screen.queryByTestId('on-my-way-minutes')).toBeNull()
    expect(screen.getAllByTestId('on-my-way-act')[0]!.textContent).toBe('📍Clocks you in on PLUM 512 · Whitfield water heater, on site now.')
    expect(screen.getByTestId('on-my-way-primary').textContent).toBe('I’m here, text Dana')
    expect(screen.getByTestId('on-my-way-secondary').textContent).toBe('I’m here, no text')
    await pressPrimary()
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ jobLedgerId: 'job-512', bidId: null, notes: 'On site at PLUM 512 · Whitfield water heater', travel: 'on-site' }))
    expect(io.send).toHaveBeenCalledWith(expect.objectContaining({ quickReplyId: 'q2', fills: {} }))
  })

  it('two still-open jobs: the other is pressable, its customer fills the line, and a late arrival gets the window line', async () => {
    const io = fakeIo()
    mount(io, { destinations: [WHITFIELD, RIVERBEND], leaving: 'PLUM 498 · Baker St water heater', canFinishDay: true })
    await screen.findByTestId('on-my-way-preview')
    await guessed()
    fireEvent.click(screen.getAllByTestId('on-my-way-destination')[1]!)
    await waitFor(() => expect(screen.getByTestId('on-my-way-preview').textContent).toContain('Priya,'))
    expect(screen.getAllByTestId('on-my-way-act')[0]!.textContent).toBe('⏱Clocks you out of PLUM 498 · Baker St water heater and in on GAS 77 · Riverbend gas test as on the way.')
    fireEvent.change(screen.getByTestId('on-my-way-minutes'), { target: { value: '170' } })
    expect(screen.getByTestId('on-my-way-window').textContent).toBe('That lands about 3:05 PM, past the 3:00 PM window. Running late is under Message the customer and moves the board.')
    expect(screen.getByTestId('on-my-way-done-for-day').textContent).toBe('Done for the day')
  })
})

describe('the tech’s bio on the sheet (v2.5590, punch list #114)', { timeout: 15_000 }, () => {
  const bioRow = (id: string, text: string, set: Partial<BioLine> = {}): BioLine => ({ id, text, textEs: null, position: 1, addedAt: 0, removed: false, offByUser: false, ...set })
  const BIO: BioLine[] = [
    bioRow('b1', 'Luis has been a plumber for twelve years.', { position: 1, textEs: 'Luis es plomero desde hace doce años.' }),
    bioRow('b2', 'Water heaters are his specialty.', { position: 2, textEs: 'Su especialidad son los calentadores.' }),
    bioRow('b3', 'Off the clock he coaches Little League.', { position: 3 }),
    bioRow('b4', 'He is an Astros fan.', { position: 4, textEs: 'Es aficionado de los Astros.', offByUser: true }),
  ]
  const withBio = (set: Partial<OnMyWayIo> = {}) => fakeIo({ loadMyBio: vi.fn(() => Promise.resolve(BIO)), loadIntroduced: vi.fn(() => Promise.resolve(false)), ...set })

  it('the first time: the bio follows the line with the usual picks, the third row counts them, and the press sends the line then the bio', async () => {
    const io = withBio()
    const { onClose } = mount(io)
    expect((await screen.findByTestId('on-my-way-bio-first')).textContent).toBe('Dana hears from you for the first time. This goes right after:')
    expect(screen.getByTestId('on-my-way-bio').textContent).toBe('A little about Luis: Luis has been a plumber for twelve years. Water heaters are his specialty. Off the clock he coaches Little League.')
    expect(screen.getAllByTestId('on-my-way-act')[2]!.textContent).toBe('👋Then texts your bio, 3 of 4 lines, since Dana has not heard from you before.')
    expect(screen.getByTestId('on-my-way-bio-hold').textContent).toBe('Not this time')
    expect(screen.getByTestId('on-my-way-bio-edit').textContent).toBe('Edit bio')
    await pressPrimary()
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 })
    expect(io.send).toHaveBeenCalledTimes(2)
    expect(io.send.mock.calls[0]![0]).toMatchObject({ quickReplyId: 'q1' })
    expect(io.send.mock.calls[1]![0]).toEqual({ from: 'job_mode', kind: 'bio', customerId: 'cust-dana', contactId: 'contact-dana', jobId: 'job-512', lineIds: ['b1', 'b2', 'b3'] })
    expect(io.loadIntroduced).toHaveBeenCalledWith('contact-dana', 'luis')
  })

  it('Not this time holds the bio: the line goes alone', async () => {
    const io = withBio()
    const { onClose } = mount(io)
    fireEvent.click(await screen.findByTestId('on-my-way-bio-hold'))
    expect(screen.queryByTestId('on-my-way-bio')).toBeNull()
    expect(screen.getAllByTestId('on-my-way-act')).toHaveLength(2)
    await pressPrimary()
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 })
    expect(io.send).toHaveBeenCalledTimes(1)
  })

  it('Edit bio: the window opens on the usual picks, a tick changes the preview and the count, and Use these brings the pick back', async () => {
    const io = withBio()
    const { onClose } = mount(io)
    fireEvent.click(await screen.findByTestId('on-my-way-bio-edit'))
    const win = await screen.findByTestId('bio-pick-window')
    expect(screen.getByRole('dialog', { name: 'Your bio for Dana' })).toBeTruthy()
    const boxes = within(win).getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.map((b) => b.checked)).toEqual([true, true, true, false])
    fireEvent.click(boxes[3]!)
    fireEvent.click(boxes[2]!)
    expect(screen.getByTestId('bio-pick-preview').textContent).toBe('A little about Luis: Luis has been a plumber for twelve years. Water heaters are his specialty. He is an Astros fan.')
    expect(screen.getByTestId('bio-pick-count').textContent).toMatch(/^\d+ left of 320$/)
    fireEvent.click(screen.getByTestId('bio-pick-use'))
    await waitFor(() => expect(screen.queryByTestId('bio-pick-window')).toBeNull())
    expect(screen.getByTestId('on-my-way-bio').textContent).toBe('A little about Luis: Luis has been a plumber for twelve years. Water heaters are his specialty. He is an Astros fan.')
    expect(screen.getAllByTestId('on-my-way-act')[2]!.textContent).toContain('3 of 4 lines')
    await pressPrimary()
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 })
    expect(io.send.mock.calls[1]![0]).toMatchObject({ kind: 'bio', lineIds: ['b1', 'b2', 'b4'] })
  })

  it('Back leaves the pick as it was, and every line unticked says nothing goes', async () => {
    const io = withBio()
    mount(io)
    fireEvent.click(await screen.findByTestId('on-my-way-bio-edit'))
    const win = await screen.findByTestId('bio-pick-window')
    fireEvent.click(within(win).getAllByRole('checkbox')[0]!)
    fireEvent.click(screen.getByTestId('bio-pick-back'))
    await waitFor(() => expect(screen.queryByTestId('bio-pick-window')).toBeNull())
    expect(screen.getByTestId('on-my-way-bio').textContent).toContain('twelve years')
    fireEvent.click(screen.getByTestId('on-my-way-bio-edit'))
    const again = await screen.findByTestId('bio-pick-window')
    for (const box of within(again).getAllByRole('checkbox').slice(0, 3)) fireEvent.click(box)
    expect(screen.getByTestId('bio-pick-preview').textContent).toBe('Nothing goes while every line is off.')
    fireEvent.click(screen.getByTestId('bio-pick-use'))
    await waitFor(() => expect(screen.queryByTestId('bio-pick-window')).toBeNull())
    expect(screen.getByTestId('on-my-way-bio').textContent).toBe('Nothing goes while every line is off.')
    expect(screen.getAllByTestId('on-my-way-act')).toHaveLength(2)
  })

  it('a customer who has the bio already, a tech with none, or the push not in: no bio block', async () => {
    mount(withBio({ loadIntroduced: vi.fn(() => Promise.resolve(true)) }))
    await screen.findByTestId('on-my-way-preview')
    await waitFor(() => expect(screen.getAllByTestId('on-my-way-act')).toHaveLength(2))
    expect(screen.queryByTestId('on-my-way-bio-first')).toBeNull()
    cleanup()
    mount(withBio({ loadMyBio: vi.fn(() => Promise.resolve([])) }))
    await screen.findByTestId('on-my-way-preview')
    expect(screen.queryByTestId('on-my-way-bio-first')).toBeNull()
    cleanup()
    mount(fakeIo())
    await screen.findByTestId('on-my-way-preview')
    expect(screen.queryByTestId('on-my-way-bio-first')).toBeNull()
  })

  it('a Spanish reader gets the Spanish lines, and a line without Spanish cannot be ticked', async () => {
    const io = withBio({ loadCustomer: vi.fn(() => Promise.resolve({ ...DANA, lang: 'es' as const })) })
    mount(io)
    expect((await screen.findByTestId('on-my-way-bio')).textContent).toBe('Un poco sobre Luis: Luis es plomero desde hace doce años. Su especialidad son los calentadores.')
    expect(screen.getAllByTestId('on-my-way-act')[2]!.textContent).toContain('2 of 4 lines')
    fireEvent.click(screen.getByTestId('on-my-way-bio-edit'))
    const win = await screen.findByTestId('bio-pick-window')
    const boxes = within(win).getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes[2]!.disabled).toBe(true)
    expect(within(win).getByText('No Spanish yet, so it cannot go to a Spanish reader.')).toBeTruthy()
  })
})
