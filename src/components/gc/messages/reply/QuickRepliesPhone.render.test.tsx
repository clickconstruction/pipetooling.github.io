// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { SEED_FLOWS } from '../../../../lib/flows/seed'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import { PHONE_ONLY_CUSTOMERS, stepsByKind, type QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { QuickRepliesEditor } from './QuickRepliesEditor'
import { ReplyBox } from './ReplyBox'

// Send texts is on here, so a text writes as it will once the owner turns it on (`ReplyBox.textsOn` holds the off box).
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))

/**
 * R3's screens over the residential prototype's lines (v0.8, branch spike/gc-mode): the editor's Phone tab and marks,
 * a customer line's Spanish and phone fields, and the strip and box with a blank the app cannot fill. Rosa is signed
 * in to the editor; the box writes to Greg, the demo's trade partner, with a line for anyone.
 */

const ME = 'u-rosa'
const NAMES = { 'u-rosa': 'Rosa', 'u-luis': 'Luis Ortega' }

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: ME,
  addedAt: Date.parse('2026-09-30T13:10:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  textEs: null,
  phoneOrder: null,
  phoneName: null,
  ...set,
})

const LINES: QuickReply[] = [
  line('r1', '{first}, this is Click Plumbing. We have you down for {day} between {window}.', { stepId: 'booked', uses: { 'u-rosa': 38 } }),
  line('r2', '{first}, this is {me} with Click Plumbing. We are on our way, about {minutes} minutes out.', {
    stepId: 'onway',
    phoneOrder: 1,
    phoneName: 'On our way',
    textEs: '{first}, le habla {me} de Click Plumbing. Vamos en camino.',
    uses: { 'u-luis': 41 },
  }),
  line('r3', '{first}, we are running behind this morning. Our new window is {window}.', { stepId: 'onway', phoneOrder: 2, uses: { 'u-luis': 6 } }),
  line('r4', '{first}, here is what we found: {found}. {me} will send you the estimate today.', { stepId: 'found', phoneOrder: 3, uses: { 'u-luis': 12 } }),
  line('q1', 'Your quote is in your portal now, thank you.', { for: 'trade', stepId: 'ask', uses: { 'u-rosa': 10 } }),
]

function fakeQuick(lines: QuickReply[] = LINES): QuickRepliesIo {
  return {
    loadLines: vi.fn(() => Promise.resolve(lines)),
    loadVersions: vi.fn(() => Promise.resolve({})),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
  }
}

async function editor(io: QuickRepliesIo = fakeQuick()) {
  renderWithProviders(
    <QuickRepliesEditor
      io={io}
      me={ME}
      steps={stepsByKind(SEED_FLOWS)}
      names={NAMES}
      contactNames={{}}
      fills={{ first: 'Dana', me: 'Luis' }}
      previewTo="Dana"
      initialAdd=""
      onChanged={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  const el = await screen.findByRole('dialog', { name: 'Quick replies' })
  await waitFor(() => expect(el.querySelector('[data-qr-editor-lines]')).toBeTruthy())
  return { el, io }
}

const openLine = (el: HTMLElement, id: string) => fireEvent.click(within(el.querySelector(`[data-qr-editor-row="${id}"]`) as HTMLElement).getAllByRole('button')[0]!)
const phoneRows = (el: HTMLElement) => [...el.querySelectorAll('[data-qr-phone-row]')].map((r) => r.getAttribute('data-qr-phone-row'))

beforeEach(() => {
  localStorage.clear()
})

describe('the quick replies editor’s Phone tab and marks (Messages R3)', () => {
  it('shows Phone after Mine once a line is on the phone, and marks each row', async () => {
    const { el } = await editor()
    expect(within(el).getAllByRole('tab').map((t) => t.textContent).slice(-2)).toEqual(['Mine · 0', 'Phone · 3'])
    const marks = (id: string) => [...el.querySelectorAll(`[data-qr-editor-row="${id}"] [data-qr-mark]`)].map((m) => m.getAttribute('data-qr-mark'))
    expect(marks('r2')).toEqual(['phone', 'es'])
    expect(marks('r1')).toEqual(['no es'])
    expect(marks('q1')).toEqual([])
  })

  it('lists the phone’s lines by place, each by its short name and its words filled, and moves one up', async () => {
    const { el, io } = await editor()
    fireEvent.click(within(el).getByRole('tab', { name: 'Phone · 3' }))
    expect(el.querySelector('[data-qr-editor-lines]')).toBeNull()
    expect(phoneRows(el)).toEqual(['r2', 'r3', 'r4'])
    const r2 = el.querySelector('[data-qr-phone-row="r2"]') as HTMLElement
    expect(r2.textContent).toContain('On our way · Dana, this is Luis with Click Plumbing.')
    expect(r2.querySelector('[data-qr-blank="minutes"]')).toBeTruthy()
    expect((el.querySelector('[data-qr-phone-row="r4"]') as HTMLElement).textContent).toContain('Here is what we found · Dana, here is what we found: {found}.')
    fireEvent.click(within(el).getByRole('button', { name: /^Move up: Here is what we found/ }))
    await waitFor(() => expect(io.edit).toHaveBeenCalledTimes(2))
    expect(io.edit).toHaveBeenNthCalledWith(1, 'r4', LINES[3]!.text, { for: 'customer', stepId: 'found' }, { phoneOrder: 2 })
    expect(io.edit).toHaveBeenNthCalledWith(2, 'r3', LINES[2]!.text, { for: 'customer', stepId: 'onway' }, { phoneOrder: 3 })
    expect(await screen.findByText('Moved. The phone shows the new order.')).toBeTruthy()
    expect(io.loadLines).toHaveBeenCalledTimes(2)
  })

  it('takes a line off the phone in one save', async () => {
    const { el, io } = await editor()
    fireEvent.click(within(el).getByRole('tab', { name: 'Phone · 3' }))
    fireEvent.click(within(el).getByRole('button', { name: /^Take it off the phone: We are running behind/ }))
    await waitFor(() => expect(io.edit).toHaveBeenCalledWith('r3', LINES[2]!.text, { for: 'customer', stepId: 'onway' }, { phoneOrder: 0 }))
    expect(io.edit).toHaveBeenCalledTimes(1)
  })

  it('says which line waits past six', async () => {
    const seven = [...LINES, ...[4, 5, 6, 7].map((n) => line(`p${n}`, `Line ${n}.`, { phoneOrder: n }))]
    const { el } = await editor(fakeQuick(seven))
    fireEvent.click(within(el).getByRole('tab', { name: 'Phone · 7' }))
    expect([...el.querySelectorAll('[data-qr-phone-row] [data-qr-phone-waits]')].map((w) => w.closest('[data-qr-phone-row]')?.getAttribute('data-qr-phone-row'))).toEqual(['p7'])
  })
})

describe('a customer line opened in the editor (Messages R3)', () => {
  it('takes its Spanish, a place on the phone and a short name, and saves them with the words', async () => {
    const { el, io } = await editor()
    openLine(el, 'r1')
    const opened = el.querySelector('[data-qr-open="r1"]') as HTMLElement
    expect(opened.textContent).toContain('None yet, so a Spanish speaker reads the English.')
    expect(opened.querySelector('[data-qr-preview]')?.textContent).toContain('As it would go to Dana. Fill {day} and {window} in the box before it sends.')
    fireEvent.change(within(opened).getByRole('textbox', { name: 'The line in Spanish' }), { target: { value: '{first}, le tenemos agendado el {day}.' } })
    fireEvent.click(within(opened.querySelector('[data-qr-phone-tick]') as HTMLElement).getByRole('checkbox'))
    fireEvent.change(within(opened).getByRole('textbox', { name: 'Its short name on the phone' }), { target: { value: 'Booked' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(io.edit).toHaveBeenCalledWith('r1', LINES[0]!.text, { for: 'customer', stepId: 'booked' }, { textEs: '{first}, le tenemos agendado el {day}.', phoneOrder: 4, phoneName: 'Booked' }),
    )
  })

  it('puts a chip’s blank in the words at the cursor, and lights it in the preview', async () => {
    const { el } = await editor()
    openLine(el, 'r1')
    const opened = el.querySelector('[data-qr-open="r1"]') as HTMLElement
    const words = within(opened).getByRole('textbox', { name: "The line's words" }) as HTMLTextAreaElement
    words.setSelectionRange(0, 0)
    fireEvent.click(within(opened.querySelector('[data-qr-chips]') as HTMLElement).getByRole('button', { name: '{thing}' }))
    expect(words.value.startsWith('{thing}{first}, this is Click Plumbing.')).toBe(true)
    expect(opened.querySelector('[data-qr-preview] [data-qr-blank="thing"]')).toBeTruthy()
  })

  it('lists a customer’s steps under each flow’s name', async () => {
    const { el } = await editor()
    openLine(el, 'r1')
    const select = within(el.querySelector('[data-qr-open="r1"]') as HTMLElement).getByRole('combobox', { name: 'On the step' })
    expect([...select.querySelectorAll('optgroup')].map((g) => g.getAttribute('label'))).toEqual(['Residential customer', 'GC customer'])
  })

  it('offers a trade partner’s line no Spanish and no phone, and says why', async () => {
    const { el } = await editor()
    openLine(el, 'q1')
    const opened = el.querySelector('[data-qr-open="q1"]') as HTMLElement
    expect(within(opened).queryByRole('textbox', { name: 'The line in Spanish' })).toBeNull()
    const tick = opened.querySelector('[data-qr-phone-tick]') as HTMLElement
    expect((within(tick).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    expect(tick.textContent).toContain(PHONE_ONLY_CUSTOMERS)
  })

  it('takes a line off the phone when it moves away from customers', async () => {
    const { el, io } = await editor()
    openLine(el, 'r3')
    const opened = el.querySelector('[data-qr-open="r3"]') as HTMLElement
    fireEvent.click(within(opened).getByRole('radio', { name: 'anyone' }))
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.edit).toHaveBeenCalledWith('r3', LINES[2]!.text, { for: 'any', stepId: null }, { phoneOrder: null }))
  })
})

describe('a blank the box cannot fill (Messages R3)', () => {
  const fakeIo = (): ReplyIo => ({
    loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
    addNote: vi.fn(() => Promise.resolve('m-note')),
    sendEmail: vi.fn(() => Promise.resolve('m-email')),
    sendText: vi.fn(() => Promise.resolve('m-text')),
  })

  function box() {
    const view = spineMessagesView()
    const contact = view.contacts.find((c) => c.id === 'c-greg')!
    const open: OpenThread = {
      contact,
      lines: view.messages.filter((m) => m.contactId === 'c-greg'),
      jobFilter: null,
      rail: view.rails['c-greg'] ?? [],
      tiles: view.tiles,
      userNames: view.userNames,
      nowIso: DEMO_NOW,
      searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
    }
    const found = line('a1', '{first}, here is what we found: {found}.', { for: 'any' })
    renderWithProviders(
      <OpenThreadContext.Provider value={open}>
        <ReplyBox contact={contact} io={fakeIo()} quickIo={fakeQuick([found])} />
      </OpenThreadContext.Provider>,
    )
    return document.querySelector('[data-reply-box]') as HTMLElement
  }

  it('shows the line filled with the blank lit, fills the box on a press, and waits until the person fills it', async () => {
    const el = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    await waitFor(() => expect(el.querySelector('[data-qr-line="a1"]')).toBeTruthy())
    const strip = el.querySelector('[data-qr-line="a1"]') as HTMLElement
    expect(strip.textContent).toBe('Greg, here is what we found: {found}.')
    expect(strip.querySelector('[data-qr-blank="found"]')).toBeTruthy()
    fireEvent.click(strip)
    const words = within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement
    expect(words.value).toBe('Greg, here is what we found: {found}.')
    expect(el.querySelector('[data-reply-waits]')?.textContent).toBe('Fill {found} first. The app does not know it.')
    expect((within(el).getByRole('button', { name: 'Send text…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(words, { target: { value: 'Greg, here is what we found: a cracked clean-out.' } })
    expect(el.querySelector('[data-reply-waits]')).toBeNull()
    expect((within(el).getByRole('button', { name: 'Send text…' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
