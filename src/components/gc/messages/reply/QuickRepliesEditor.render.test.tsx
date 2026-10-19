// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { SEED_FLOWS } from '../../../../lib/flows/seed'
import { stepsByKind, type QuickReply, type QuickReplyVersion } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { QuickRepliesEditor } from './QuickRepliesEditor'

// The prototype's demo people: Robert is signed in, Rosa and Wendi are the office.
const ME = 'u-robert'
const NAMES = { 'u-robert': 'Robert', 'u-rosa': 'Rosa', 'u-wendi': 'Wendi' }
const at = (iso: string) => Date.parse(iso)

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'trade',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: at('2026-09-12T14:00:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

const LINES: QuickReply[] = [
  line('q3', 'Checking on the number. Still good for today?', {
    stepId: 'ask',
    addedBy: 'u-robert',
    addedAt: at('2026-09-14T13:40:00.000Z'),
    uses: { 'u-rosa': 23, 'u-robert': 12, 'u-wendi': 6 },
    lastUsed: { at: at('2026-10-12T13:02:00.000Z'), by: 'u-robert', contactId: 'c-bill' },
  }),
  line('q2', 'Did the invite come through?', { stepId: 'invited', addedBy: 'u-robert', uses: { 'u-rosa': 14, 'u-robert': 3 } }),
  line('q4', 'Understood. You will have it by 9 AM Thursday.', { for: 'customer', stepId: 'bid' }),
  line('q14', 'Got it, thank you.', { for: 'any', uses: { 'u-rosa': 30 } }),
  line('q9', 'Running ten minutes behind.', { for: 'any', scope: 'mine', addedBy: ME }),
  line('q10', 'Rosa’s own line.', { for: 'any', scope: 'mine' }),
  line('q8', 'The site is open from 7.', { removed: true }),
]

const VERSIONS: Record<string, QuickReplyVersion[]> = {
  q3: [
    { by: 'u-robert', at: at('2026-09-14T13:40:00.000Z'), kind: 'added', toText: 'Checking on the quote. Still good for today?', toTags: { for: 'trade', stepId: null } },
    { by: 'u-robert', at: at('2026-09-22T14:05:00.000Z'), kind: 'tags', fromTags: { for: 'trade', stepId: null }, toTags: { for: 'trade', stepId: 'ask' } },
    { by: 'u-wendi', at: at('2026-09-29T21:12:00.000Z'), kind: 'words', fromText: 'Checking on the quote. Still good for today?', toText: 'Checking on the number. Still good for today?' },
  ],
}

function fakeIo(set: Partial<QuickRepliesIo> = {}): QuickRepliesIo {
  return {
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadVersions: vi.fn(() => Promise.resolve(VERSIONS)),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
    setShortcut: vi.fn(() => Promise.resolve(1)),
    ...set,
  }
}

async function editor(io: QuickRepliesIo = fakeIo(), initialAdd = '') {
  const onChanged = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <QuickRepliesEditor
      io={io}
      me={ME}
      steps={stepsByKind(SEED_FLOWS)}
      names={NAMES}
      contactNames={{ 'c-bill': 'Bill Sorrell' }}
      initialAdd={initialAdd}
      onChanged={onChanged}
      onClose={onClose}
    />,
  )
  const el = await screen.findByRole('dialog', { name: 'Quick replies' })
  await waitFor(() => expect(el.querySelector('[data-qr-editor-lines]')).toBeTruthy())
  return { el, io, onChanged, onClose }
}

const rowIds = (el: HTMLElement) => [...el.querySelectorAll('[data-qr-editor-row]')].map((r) => r.getAttribute('data-qr-editor-row'))
const openLine = (el: HTMLElement, id: string) => fireEvent.click(within(el.querySelector(`[data-qr-editor-row="${id}"]`) as HTMLElement).getAllByRole('button')[0]!)

describe('the quick replies editor (Messages, cut 3)', () => {
  it('opens on every line the person may read, by who it is for and its step, the most used first', async () => {
    const { el } = await editor()
    expect(within(el).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'All · 5',
      'Trade partners · 2',
      'Customers · 1',
      'Architects · 0',
      'Anyone · 2',
      'Mine · 1',
      'Removed · 1',
    ])
    expect([...el.querySelectorAll('[data-qr-editor-group]')].map((g) => g.getAttribute('data-qr-editor-group'))).toEqual(['trade:invited', 'trade:ask', 'customer:bid', 'any:'])
    expect(rowIds(el)).toEqual(['q2', 'q3', 'q4', 'q14', 'q9'])
    const q3 = el.querySelector('[data-qr-editor-row="q3"]') as HTMLElement
    expect(q3.textContent).toContain('4112 by you')
    expect(q3.textContent).toContain('Robert · Sep 14')
    expect(q3.textContent).toContain('Wendi · Sep 29')
    expect(el.querySelector('[data-qr-editor-row="q2"]')?.textContent).toContain('—')
    expect(el.querySelector('[data-qr-editor-row="q9"]')?.textContent).toContain('mine')
    expect(el.querySelector('[data-qr-editor-foot]')?.textContent).toBe('5 lines · by who they are for, then the step, the most used first.')
  })

  it('cuts the list by tab and finds words, lighting them', async () => {
    const { el } = await editor()
    fireEvent.click(within(el).getByRole('tab', { name: 'Customers · 1' }))
    expect(rowIds(el)).toEqual(['q4'])
    fireEvent.click(within(el).getByRole('tab', { name: 'All · 5' }))
    fireEvent.change(within(el).getByRole('textbox', { name: 'Find a line' }), { target: { value: 'number' } })
    expect(rowIds(el)).toEqual(['q3'])
    expect(el.querySelector('[data-qr-editor-row="q3"] mark')?.textContent).toBe('number')
    expect(el.querySelector('[data-qr-editor-foot]')?.textContent).toBe('1 line match “number” · by who they are for, then the step, the most used first.')
    fireEvent.change(within(el).getByRole('textbox', { name: 'Find a line' }), { target: { value: 'striping' } })
    expect(el.querySelector('[data-qr-editor-lines]')?.textContent).toContain('No line has those words.')
  })

  it('opens a line in place with its history, newest first, who used it and when it was last used', async () => {
    const { el } = await editor()
    openLine(el, 'q3')
    const opened = el.querySelector('[data-qr-open="q3"]') as HTMLElement
    expect((within(opened).getByRole('textbox', { name: "The line's words" }) as HTMLTextAreaElement).value).toBe('Checking on the number. Still good for today?')
    const history = opened.querySelector('[data-qr-history]') as HTMLElement
    expect(history.textContent).toContain('History · 3 versions · used 41 times')
    const rows = [...history.children].slice(1, 4).map((r) => r.textContent)
    expect(rows[0]).toContain('Wendi · Sep 29, 4:12 PM')
    expect(rows[0]).toContain('changed the words: Checking on the quote. Still good for today? → Checking on the number. Still good for today?')
    expect(rows[1]).toContain('Robert · Sep 22, 9:05 AM')
    expect(rows[1]).toContain('tagged it')
    expect(rows[2]).toContain('added it: Checking on the quote. Still good for today?')
    expect(history.querySelector('del')?.textContent).toBe('Checking on the quote. Still good for today?')
    const usedBy = opened.querySelector('[data-qr-used-by]')?.textContent ?? ''
    expect(usedBy).toContain('Rosa 23')
    expect(usedBy).toContain('Robert 12')
    expect(usedBy).toContain('Wendi 6')
    expect(usedBy).toContain('last used Oct 12, 8:02 AM, on Bill Sorrell')
  })

  it('saves new words through edit_quick_reply, and says so when nothing changed', async () => {
    const { el, io, onChanged } = await editor()
    openLine(el, 'q2')
    fireEvent.click(within(el.querySelector('[data-qr-open="q2"]') as HTMLElement).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Nothing changed.')).toBeTruthy()
    expect(io.edit).not.toHaveBeenCalled()
    openLine(el, 'q2')
    const opened = el.querySelector('[data-qr-open="q2"]') as HTMLElement
    fireEvent.change(within(opened).getByRole('textbox', { name: "The line's words" }), { target: { value: 'Did the invite come through okay?' } })
    fireEvent.click(within(opened).getByRole('radio', { name: 'anyone' }))
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.edit).toHaveBeenCalledWith('q2', 'Did the invite come through okay?', { for: 'any', stepId: null }))
    expect(await screen.findByText('Saved, with your name and today in its history.')).toBeTruthy()
    expect(io.loadLines).toHaveBeenCalledTimes(2)
    expect(io.loadVersions).toHaveBeenCalledTimes(2)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(el.querySelector('[data-qr-open]')).toBeNull()
  })

  it('says a refusal from the table in its own words, and keeps the line open', async () => {
    const { el } = await editor(fakeIo({ edit: vi.fn(() => Promise.reject(new Error('That line is not there.'))) }))
    openLine(el, 'q2')
    const opened = el.querySelector('[data-qr-open="q2"]') as HTMLElement
    fireEvent.change(within(opened).getByRole('textbox', { name: "The line's words" }), { target: { value: 'Did it come through?' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    expect((await within(opened).findByRole('alert')).textContent).toBe('That line is not there.')
    expect(el.querySelector('[data-qr-open="q2"]')).toBeTruthy()
  })

  it('asks before it removes a line, and brings a removed line back from the Removed tab', async () => {
    const { el, io } = await editor()
    openLine(el, 'q2')
    fireEvent.click(within(el.querySelector('[data-qr-open="q2"]') as HTMLElement).getByRole('button', { name: 'Remove this line…' }))
    let ask = await screen.findByRole('alertdialog', { name: 'Remove this line?' })
    expect(ask.textContent).toContain('“Did the invite come through?”')
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Remove this line?' })).toBeNull())
    expect(io.remove).not.toHaveBeenCalled()
    fireEvent.click(within(el.querySelector('[data-qr-open="q2"]') as HTMLElement).getByRole('button', { name: 'Remove this line…' }))
    ask = await screen.findByRole('alertdialog', { name: 'Remove this line?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove it' }))
    await waitFor(() => expect(io.remove).toHaveBeenCalledWith('q2'))
    expect(await screen.findByText('Removed. It can be brought back from the Removed tab.')).toBeTruthy()

    fireEvent.click(within(el).getByRole('tab', { name: 'Removed · 1' }))
    expect(rowIds(el)).toEqual(['q8'])
    openLine(el, 'q8')
    const removed = el.querySelector('[data-qr-open="q8"]') as HTMLElement
    expect((within(removed).getByRole('textbox', { name: "The line's words" }) as HTMLTextAreaElement).disabled).toBe(true)
    expect(removed.textContent).toContain('Bring the line back before you change it.')
    expect(within(removed).queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.click(within(removed).getByRole('button', { name: 'Bring it back' }))
    await waitFor(() => expect(io.restore).toHaveBeenCalledWith('q8'))
    expect(await screen.findByText('Back on the list.')).toBeTruthy()
    await waitFor(() => expect(within(el).getByRole('tab', { name: 'All · 5' }).getAttribute('aria-selected')).toBe('true'))
  })

  it('starts on its add row with words a search found none for, the tags guessed until set', async () => {
    const { el, io } = await editor(fakeIo(), 'Send the W-9 when you can.')
    const add = el.querySelector('[data-qr-add]') as HTMLElement
    expect((within(add).getByRole('textbox', { name: 'The line' }) as HTMLTextAreaElement).value).toBe('Send the W-9 when you can.')
    expect(add.querySelector('[data-add-guess]')?.textContent).toBe('guessed from the words')
    expect(within(add).getByRole('radio', { name: 'trade partners' }).getAttribute('aria-checked')).toBe('true')
    expect((within(add).getByRole('combobox', { name: 'On the step' }) as HTMLSelectElement).value).toBe('papers')
    fireEvent.click(within(add).getByRole('checkbox'))
    fireEvent.click(within(add).getByRole('button', { name: 'Add the line' }))
    await waitFor(() => expect(io.add).toHaveBeenCalledWith('Send the W-9 when you can.', { for: 'trade', stepId: 'papers' }, true))
    expect(await screen.findByText('Added to yours, with your name and today on it.')).toBeTruthy()
    expect(el.querySelector('[data-qr-add]')).toBeNull()
  })

  it('refuses an empty line on the add row', async () => {
    const { el, io } = await editor()
    fireEvent.click(within(el).getByRole('button', { name: '+ Add a line' }))
    const add = el.querySelector('[data-qr-add]') as HTMLElement
    fireEvent.click(within(add).getByRole('radio', { name: 'anyone' }))
    expect(add.querySelector('[data-add-guess]')?.textContent).toBe('set by you')
    fireEvent.click(within(add).getByRole('button', { name: 'Add the line' }))
    expect(within(add).getByRole('alert').textContent).toBe('Write the line first.')
    expect(io.add).not.toHaveBeenCalled()
  })

  it('folds who added a line and its last change under its words on a phone', async () => {
    const wide = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      const { el } = await editor()
      expect([...el.querySelectorAll('th')].map((h) => h.textContent)).toEqual(['Line', 'Used'])
      expect(el.querySelector('[data-qr-editor-row="q3"] [data-qr-editor-byline]')?.textContent).toBe('added by Robert · Sep 14 · changed by Wendi · Sep 29')
      expect(el.querySelector('[data-qr-editor-row="q2"] [data-qr-editor-byline]')?.textContent).toBe('added by Robert · Sep 12')
    } finally {
      window.matchMedia = wide
    }
  })

  it('closes on Done', async () => {
    const { el, onClose } = await editor()
    fireEvent.click(within(el).getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
