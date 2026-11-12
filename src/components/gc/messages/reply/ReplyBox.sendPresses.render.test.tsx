// @vitest-environment jsdom
/**
 * Punch list #319 PR 1b: the three presses over the reply box on a text. The office team sees *Send Dana* with Ask for
 * photos, An estimate and A bill; a tech does not, and an email does not. Ask for photos puts the ask in. An estimate
 * and A bill write their `/` word, so the list opens on that person's papers, a pick writes the line with its link,
 * the estimates end with a row that starts one, and no open bill says nothing is owed. A number that sent STOP has
 * the three dead, with the reason as their title.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import type { Contact } from '../../../../lib/contacts/kernel'
import type { EstimateLinkIo } from '../../../../lib/messages/estimateLinkIo'
import type { Paper } from '../../../../lib/messages/papers'
import type { PapersIo } from '../../../../lib/messages/papersIo'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import type { UserRole } from '../../../../hooks/useAuth'
import { ReplyBox } from './ReplyBox'

vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))
const who = vi.hoisted(() => ({ role: 'assistant' as string }))
vi.mock('../../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../../test/renderSmokeMocks')
  const made = useAuthModuleMock({ role: 'assistant', profileName: 'Rosa Delgado' })
  const withRole = <T extends { role?: unknown } | null | undefined>(auth: T): T => (auth ? { ...auth, role: who.role as UserRole } : auth)
  return { ...made, useAuth: () => withRole(made.useAuth()), useOptionalAuth: () => withRole(made.useOptionalAuth()) }
})
const doors = vi.hoisted(() => ({ startEstimate: vi.fn(async () => undefined) }))
vi.mock('../../../firstLook/useLookDoors', () => ({ useLookDoors: () => ({ has: true, book: vi.fn(), startEstimate: doors.startEstimate, pressing: false }) }))

const DANA: Contact = {
  id: 'c-dana',
  kind: 'customer',
  name: 'Dana Whitfield',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-dana' },
  channels: [
    { id: 'ch-dana-cell', kind: 'phone', value: '(210) 555-0188', optedOutAt: null },
    { id: 'ch-dana-mail', kind: 'email', value: 'dana@example.test', optedOutAt: null },
  ],
  jobIds: [],
  defaultJobId: null,
  customerId: 'cust-dana',
  gcCompanyId: null,
}

const PAPERS: Paper[] = [
  { kind: 'bill', id: 'b-paid', jobId: 'j-helotes', job: 'Helotes re-pipe', number: '1312', open: false, amount: 300, billedYmd: '2026-09-01', payUrl: 'https://clicktooling.com/pay/b-paid' },
  { kind: 'estimate', id: 'e-1044', jobId: null, job: 'Kitchen re-pipe', number: '1044', approved: false, amount: 3200, sentYmd: '2026-10-14' },
]

const fakeQuick = (): QuickRepliesIo =>
  ({
    loadLines: vi.fn(() => Promise.resolve([])),
    loadVersions: vi.fn(() => Promise.resolve({})),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
    setShortcut: vi.fn(() => Promise.resolve(1)),
  }) as QuickRepliesIo

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
})

const LINK = 'https://clicktooling.com/show/k7m2p9xq4d'

function draw(over: { contact?: Contact; papers?: Paper[]; kinds?: Array<'text' | 'email'> } = {}) {
  const papersIo: PapersIo = { load: vi.fn(() => Promise.resolve(over.papers ?? PAPERS)) }
  const estimateLinkIo: EstimateLinkIo = { share: vi.fn((id: string) => Promise.resolve(`https://clicktooling.com/e/new-${id}`)), shareToken: vi.fn((id: string) => Promise.resolve(`new-${id}`)) }
  const showLinkIo = { mint: vi.fn(() => Promise.resolve({ id: 'L1', link: LINK })) }
  renderWithProviders(<ReplyBox contact={over.contact ?? DANA} io={fakeIo()} quickIo={fakeQuick()} papersIo={papersIo} estimateLinkIo={estimateLinkIo} showLinkIo={showLinkIo} kinds={over.kinds ?? ['text']} />)
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  const textbox = within(el).getByRole('textbox') as HTMLTextAreaElement
  fireEvent.focus(textbox)
  fireEvent.click(textbox)
  return { el, textbox, showLinkIo, estimateLinkIo }
}

beforeEach(() => {
  localStorage.clear()
  who.role = 'assistant'
  doors.startEstimate.mockClear()
})

describe('the three presses over the reply box (punch list #319 PR 1b)', () => {
  it('the office team sees Send Dana and the three presses on a text', async () => {
    const { el } = draw()
    const row = await waitFor(() => {
      const found = el.querySelector('[data-send-presses]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    expect(row.textContent).toBe('Send DanaAsk for photosAn estimateA bill')
    expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ask for photos', 'An estimate', 'A bill'])
  })

  it('a tech’s box never draws them, and neither does an email', async () => {
    who.role = 'primary'
    const tech = draw()
    expect(tech.el.querySelector('[data-send-presses]')).toBeNull()
    document.body.innerHTML = ''
    who.role = 'assistant'
    const email = draw({ kinds: ['email'] })
    expect(email.el.querySelector('[data-send-presses]')).toBeNull()
  })

  it('Ask for photos puts the ask in with the link made for this thread', async () => {
    const { textbox, showLinkIo } = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Ask for photos' }))
    await waitFor(() => expect(textbox.value).toBe(`Hi Dana, this is Rosa with Click Plumbing. So we can price this before we come out, send us a few photos or a short video here: ${LINK} Or reply to this text with the photos.`))
    expect(showLinkIo.mint).toHaveBeenCalledWith('c-dana')
  })

  it('An estimate lists their estimates, a pick writes the line with its link, and the last row starts a new one', async () => {
    const { el, textbox, estimateLinkIo } = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'An estimate' }))
    expect(textbox.value).toBe('/estimate')
    const paper = await waitFor(() => {
      const found = el.querySelector('[data-slash-paper="e-1044"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    const extra = el.querySelector('[data-slash-extra]') as HTMLElement
    expect(extra.textContent).toBe('Start a new estimateOpens a new estimate on them.')
    fireEvent.mouseDown(paper)
    await waitFor(() => expect(textbox.value).toContain('https://clicktooling.com/e/new-e-1044'))
    expect(textbox.value).not.toContain('/estimate')
    expect(estimateLinkIo.share).toHaveBeenCalledWith('e-1044')
  })

  it('with no estimate the last row reads Start an estimate, and a pick opens one and clears the word', async () => {
    const { el, textbox } = draw({ papers: [] })
    fireEvent.click(await screen.findByRole('button', { name: 'An estimate' }))
    const extra = await waitFor(() => {
      const found = el.querySelector('[data-slash-extra]')
      expect(found?.textContent).toBe('Start an estimateOpens a new estimate on them.')
      return found as HTMLElement
    })
    fireEvent.mouseDown(extra)
    await waitFor(() => expect(doors.startEstimate).toHaveBeenCalledTimes(1))
    expect(textbox.value).toBe('')
  })

  it('A bill with none open says nothing is owed', async () => {
    const { el, textbox } = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'A bill' }))
    expect(textbox.value).toBe('/bill')
    await waitFor(() => expect(el.querySelector('[data-slash-note]')?.textContent).toBe('Nothing is owed. Bill Customer makes a bill.'))
  })

  it('a word already written keeps its place above the press’s word', async () => {
    const { textbox } = draw()
    fireEvent.change(textbox, { target: { value: 'Thanks for the call.' } })
    fireEvent.click(await screen.findByRole('button', { name: 'A bill' }))
    expect(textbox.value).toBe('Thanks for the call.\n/bill')
  })

  it('a number that sent STOP has the three dead, with the reason', async () => {
    const stopped: Contact = { ...DANA, channels: [{ id: 'ch-dana-cell', kind: 'phone', value: '(210) 555-0188', optedOutAt: '2026-11-01T15:00:00.000Z' }] }
    const { el } = draw({ contact: stopped })
    const row = await waitFor(() => {
      const found = el.querySelector('[data-send-presses]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    const buttons = within(row).getAllByRole('button') as HTMLButtonElement[]
    expect(buttons.every((b) => b.disabled)).toBe(true)
    expect(buttons[0]!.title).toMatch(/STOP|stop/)
  })

  it('the presses sit on the kinds’ own row, after them, and leave no row of their own (the owner’s side, 2026-11-12)', async () => {
    const { el } = draw({ kinds: ['text', 'email'] })
    const row = await waitFor(() => {
      const found = el.querySelector('[data-reply-top-row]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    const kinds = row.querySelector('[role="radiogroup"]')
    const presses = row.querySelector('[data-send-presses]') as HTMLElement
    expect(kinds).toBeTruthy()
    expect(presses).toBeTruthy()
    expect(Array.from(row.children)).toEqual([kinds, presses])
    // At the right of the row, and still at the right when a narrow window wraps them under the kinds.
    expect(presses.style.marginLeft).toBe('auto')
    expect(el.querySelectorAll('[data-send-presses]')).toHaveLength(1)
  })

  it('on an email the kinds stand alone, with no row around them', async () => {
    const { el } = draw({ kinds: ['email', 'text'] })
    fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
    await waitFor(() => expect(el.querySelector('[data-send-presses]')).toBeNull())
    expect(el.querySelector('[data-reply-top-row]')).toBeNull()
    expect(el.querySelector('[role="radiogroup"]')).toBeTruthy()
  })
})
