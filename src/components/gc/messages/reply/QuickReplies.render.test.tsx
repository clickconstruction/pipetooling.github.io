// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import { QR_PRESS_COUNTED, type QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { ReplyBox } from './ReplyBox'

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'trade',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: Date.parse('2026-09-12T14:00:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

const LINES: QuickReply[] = [
  line('q3', 'Checking on the number. Still good for today?', { stepId: 'ask', uses: { 'u-rosa': 23 } }),
  line('q2', 'Did the invite come through?', { stepId: 'invited', uses: { 'u-rosa': 14 } }),
  line('q14', 'Got it, thank you.', { for: 'any', uses: { 'u-rosa': 30 } }),
  line('q4', 'Understood. You will have it by 9 AM Thursday.', { for: 'customer', stepId: 'bid' }),
  line('q8', 'The site is open from 7.', { removed: true }),
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
  }
}

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
})

function box(quick: QuickRepliesIo = fakeQuick()) {
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
  renderWithProviders(
    <OpenThreadContext.Provider value={open}>
      <ReplyBox contact={contact} io={fakeIo()} quickIo={quick} />
    </OpenThreadContext.Provider>,
  )
  return { quick, el: document.querySelector('[data-reply-box]') as HTMLElement, open }
}

const textbox = (el: HTMLElement) => within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement

beforeEach(() => {
  localStorage.clear()
})

describe('the quick replies strip above the reply box (Messages, cut 3)', () => {
  it('starts folded and reads nothing until opened', () => {
    const { el, quick } = box()
    expect(el.querySelector('[data-qr-strip="folded"]')).toBeTruthy()
    expect(quick.loadLines).not.toHaveBeenCalled()
  })

  it('opens to their kind’s lines and anyone’s, the most used first, a removed line gone, and keeps the choice', async () => {
    const { el, quick } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    await waitFor(() => expect(el.querySelector('[data-qr-line="q3"]')).toBeTruthy())
    expect(quick.loadLines).toHaveBeenCalledTimes(1)
    expect([...el.querySelectorAll('[data-qr-line]')].map((b) => b.getAttribute('data-qr-line'))).toEqual(['q3', 'q2', 'q14'])
    expect(el.textContent).toContain('Other trade partners:')
    expect(el.textContent).toContain('Anyone:')
    expect(el.textContent).toContain('3 for trade partners')
    expect(localStorage.getItem('msgQrOpen')).toBe('1')
  })

  it('lights the pill for the group in view, a press moving it, each pill’s hover counting its lines', async () => {
    const { el } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    await waitFor(() => expect(el.querySelector('[data-qr-line="q3"]')).toBeTruthy())
    const pills = [...el.querySelectorAll('[data-qr-pill]')]
    expect(pills.map((p) => p.getAttribute('aria-current'))).toEqual(['true', null])
    expect(pills.map((p) => p.getAttribute('title'))).toEqual([
      'Other trade partners. Scrolls the lines to this group. 2 lines.',
      'Anyone. Scrolls the lines to this group. 1 line.',
    ])
    fireEvent.click(pills[1]!)
    expect(pills.map((p) => p.getAttribute('aria-current'))).toEqual([null, 'true'])
    expect(el.querySelector('[data-qr-line="q3"]')?.getAttribute('title')).toContain(QR_PRESS_COUNTED)
  })

  it('fills the box with a line, counts the press, and folds while there are words', async () => {
    const { el, quick } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    fireEvent.click(await within(el).findByRole('button', { name: 'Did the invite come through?' }))
    expect(textbox(el).value).toBe('Did the invite come through?')
    expect(quick.press).toHaveBeenCalledWith('q2', 'c-greg')
    expect(el.querySelector('[data-qr-strip="folded"]')).toBeTruthy()
    fireEvent.change(textbox(el), { target: { value: '' } })
    expect(el.querySelector('[data-qr-strip="open"]')).toBeTruthy()
  })

  it('narrows a long list, lights the words, and offers to add words no line has', async () => {
    const many = Array.from({ length: 11 }, (_, i) => line(`t${i}`, `Team line ${i} about the pad`))
    const { el } = box(fakeQuick(many))
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    const narrow = await within(el).findByRole('textbox', { name: 'Narrow the quick replies' })
    fireEvent.change(narrow, { target: { value: 'line 10' } })
    expect([...el.querySelectorAll('[data-qr-line]')].map((b) => b.getAttribute('data-qr-line'))).toEqual(['t10'])
    expect(el.querySelector('[data-qr-line="t10"] mark')?.textContent).toBe('line 10')
    fireEvent.change(narrow, { target: { value: 'striping' } })
    expect(el.textContent).toContain('No line has those words.')
    fireEvent.click(within(el).getByRole('button', { name: 'Add “striping” as a quick reply' }))
    const add = await screen.findByRole('dialog', { name: 'Add a quick reply' })
    expect((within(add).getByRole('textbox', { name: 'The line' }) as HTMLTextAreaElement).value).toBe('striping')
  })

  it('adds a line for the team from the box, its tags guessed from the words until set', async () => {
    const { el, quick } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    fireEvent.click(await within(el).findByRole('button', { name: 'Add a line' }))
    const add = await screen.findByRole('dialog', { name: 'Add a quick reply' })
    fireEvent.change(within(add).getByRole('textbox', { name: 'The line' }), { target: { value: 'Send the W-9 when you can.' } })
    expect(add.querySelector('[data-add-guess]')?.textContent).toBe('guessed from the words')
    expect(within(add).getByRole('radio', { name: 'trade partners' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(add).getByRole('radio', { name: 'anyone' }))
    expect(add.querySelector('[data-add-guess]')?.textContent).toBe('set by you')
    fireEvent.click(within(add).getByRole('button', { name: 'Add the line' }))
    await waitFor(() => expect(quick.add).toHaveBeenCalledWith('Send the W-9 when you can.', { for: 'any', stepId: null }, false))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a quick reply' })).toBeNull())
    expect(quick.loadLines).toHaveBeenCalledTimes(2)
  })

  it('refuses an empty line in the add window', async () => {
    const { el, quick } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    fireEvent.click(await within(el).findByRole('button', { name: 'Add a line' }))
    const add = await screen.findByRole('dialog', { name: 'Add a quick reply' })
    fireEvent.click(within(add).getByRole('button', { name: 'Add the line' }))
    expect(within(add).getByRole('alert').textContent).toBe('Write the line first.')
    expect(quick.add).not.toHaveBeenCalled()
  })

  it('opens Find a reply with their last message and every line, and a press fills the box and closes it', async () => {
    const { el, quick } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    fireEvent.click(await within(el).findByRole('button', { name: '⤢ Find' }))
    const find = await screen.findByRole('dialog', { name: 'Find a reply · Greg Paulk' })
    expect(find.querySelector('[data-find-last]')?.textContent).toContain('Their last message · email')
    expect(find.querySelector('[data-find-where]')?.textContent).toContain('Where Greg is')
    expect(find.querySelector('[data-find-where]')?.textContent).toContain('Nothing on now.')
    fireEvent.click(find.querySelector('[data-find-line="q14"]') as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Find a reply · Greg Paulk' })).toBeNull())
    expect(textbox(el).value).toBe('Got it, thank you.')
    expect(quick.press).toHaveBeenCalledWith('q14', 'c-greg')
  })

  it('says Nothing matches. in Find a reply when no line has the narrowed words, and offers them as a line', async () => {
    const { el } = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    fireEvent.click(await within(el).findByRole('button', { name: '⤢ Find' }))
    const find = await screen.findByRole('dialog', { name: 'Find a reply · Greg Paulk' })
    fireEvent.change(within(find).getByRole('textbox', { name: 'Narrow the lines' }), { target: { value: 'striping' } })
    expect(find.querySelector('[data-find-lines]')?.textContent).toContain('Nothing matches.')
    fireEvent.click(within(find).getByRole('button', { name: 'Add “striping” as a quick reply' }))
    const add = await screen.findByRole('dialog', { name: 'Add a quick reply' })
    expect((within(add).getByRole('textbox', { name: 'The line' }) as HTMLTextAreaElement).value).toBe('striping')
  })

  it('has no strip on a note', () => {
    const { el } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    expect(el.querySelector('[data-qr-strip]')).toBeNull()
  })
})
