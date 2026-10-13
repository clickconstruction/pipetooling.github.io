// @vitest-environment jsdom
/**
 * Messages, residential R8 · 1 (card 1 of the integrations mockups): the app's own emails in a person's thread. A run of
 * the app's lines folds to one row with its count, its days and each line's subject; a press opens it in place and
 * closes it again; a link at a folded line opens its run; and a sent line shows its small print, from, opened and paid,
 * read through a fake `sent_copy_stamps`. Elena and the copies are made up; nothing here is a real row.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APP_WHO, type SentCopyStamps } from '../../../lib/messages/appLines'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import type { MessagesView } from '../../../lib/messages/messagesIo'
import type { SentStampsIo } from '../../../lib/messages/sentStampsIo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { startOfYmdInAppTzMs } from '../../../utils/dateUtils'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { MessagesWrites } from './messagesWrites'
import { ThreadWindow } from './ThreadWindow'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** A Chicago wall time. */
const ct = (ymd: string, hour: number, minute: number) => new Date(startOfYmdInAppTzMs(ymd) + (hour * 60 + minute) * 60_000).toISOString()

/** A copy the app sent Elena with nobody pressing Send, as `sentLines` draws it. */
const appLine = (copyId: string, at: string, subject: string): ThreadMessage => ({
  id: `sent:${copyId}`,
  contactId: 'c-elena',
  jobId: null,
  channel: 'email',
  direction: 'out',
  at,
  who: APP_WHO,
  subject,
  body: subject,
  channelId: 'ch-elena-email',
})

/** The spine's view, with four of the app's emails to Elena: three in a row after her note, one alone before her call. */
function view(): MessagesView {
  const v = spineMessagesView()
  return {
    ...v,
    messages: [
      ...v.messages,
      appLine('sd-scheduled', ct('2026-09-27', 9, 0), 'Your work is scheduled'),
      appLine('sd-invoice', ct('2026-09-29', 10, 3), 'Invoice 1312'),
      appLine('sd-paid', ct('2026-09-30', 19, 0), 'Paid, thank you'),
      appLine('sd-statement', ct('2026-10-02', 8, 0), 'Your statement'),
    ],
  }
}

const STAMPS: SentCopyStamps[] = [
  { id: 'sd-invoice', fromEmail: 'office@clickplumbing.example', openedAt: ct('2026-09-29', 18, 12), paid: { at: '2026-09-30T17:00:00.000Z', how: 'card' } },
  { id: 'sd-statement', fromEmail: null, openedAt: ct('2026-10-02', 9, 30), paid: null },
  { id: 'sd-paid', fromEmail: null, openedAt: null, paid: null },
]

function writes(): MessagesWrites {
  return {
    nameContact: vi.fn(() => Promise.resolve(null)),
    tieMessage: vi.fn(() => Promise.resolve()),
    setDefaultJob: vi.fn(() => Promise.resolve()),
    addJob: vi.fn(() => Promise.resolve()),
    removeJob: vi.fn(() => Promise.resolve()),
    searchRecords: vi.fn(() => Promise.resolve([])),
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
}

function open(more: { at?: string; stampsIo?: SentStampsIo } = {}) {
  const stampsIo = more.stampsIo ?? { load: vi.fn(async () => STAMPS) }
  renderWithProviders(
    <ThreadWindow contactId="c-elena" at={more.at ?? null} onClose={vi.fn()} view={view()} nowIso={DEMO_NOW} writes={writes()} stampsIo={stampsIo} />,
  )
  const win = screen.getByRole('dialog', { name: /: messages$/ })
  return { win, stampsIo }
}

const lineOf = (win: HTMLElement, id: string) => win.querySelector<HTMLElement>(`[data-thread-line="${id}"]`)
const foldOf = (win: HTMLElement) => win.querySelector<HTMLElement>('[data-thread-fold="fold:sent:sd-scheduled"]')!

describe('ThreadWindow: the app’s own emails (R8 · 1)', () => {
  it('folds the app’s run to one row with its count, its days and each subject, and opens and closes it in place', () => {
    const { win } = open()
    const fold = foldOf(win)
    expect(fold.textContent).toBe('the app·3 emails, Sep 27 to Sep 30 ▸· Your work is scheduled· Invoice 1312· Paid, thank you')
    expect(lineOf(win, 'sent:sd-invoice')).toBeNull()
    // A lone line of the app's stays a line.
    expect(lineOf(win, 'sent:sd-statement')).toBeTruthy()

    const press = within(fold).getByRole('button', { name: '3 emails, Sep 27 to Sep 30 ▸' })
    expect(press.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(press)
    expect(within(foldOf(win)).getByRole('button', { name: '3 emails, Sep 27 to Sep 30 ▾' }).getAttribute('aria-expanded')).toBe('true')
    expect(['sent:sd-scheduled', 'sent:sd-invoice', 'sent:sd-paid'].map((id) => !!lineOf(win, id))).toEqual([true, true, true])

    fireEvent.click(within(foldOf(win)).getByRole('button', { name: '3 emails, Sep 27 to Sep 30 ▾' }))
    expect(lineOf(win, 'sent:sd-invoice')).toBeNull()
  })

  it('shows an open line’s small print: from, opened and paid, each only when the copy has it', async () => {
    const { win, stampsIo } = open()
    // One read for the thread's copies, once each.
    await waitFor(() => expect(stampsIo.load).toHaveBeenCalledWith(['sd-invoice', 'sd-paid', 'sd-scheduled', 'sd-statement']))
    await waitFor(() => expect(lineOf(win, 'sent:sd-statement')!.querySelector('[data-line-small-print]')!.textContent).toBe('opened Oct 2, 9:30 AM'))

    fireEvent.click(within(foldOf(win)).getByRole('button', { name: /3 emails/ }))
    const invoice = lineOf(win, 'sent:sd-invoice')!.querySelector('[data-line-small-print]')!
    expect(invoice.textContent).toBe('from office@clickplumbing.example· opened Sep 29, 6:12 PM· paid Sep 30 by card')
    // A copy with nothing to say draws no small print.
    expect(lineOf(win, 'sent:sd-paid')!.querySelector('[data-line-small-print]')).toBeNull()
  })

  it('opens the run that holds the line a link opened the thread at', () => {
    const { win } = open({ at: 'sent:sd-invoice' })
    expect(within(foldOf(win)).getByRole('button', { name: /3 emails/ }).getAttribute('aria-expanded')).toBe('true')
    expect(lineOf(win, 'sent:sd-invoice')).toBeTruthy()
  })

  it('keeps the lines and draws no small print when the read fails', async () => {
    const failing: SentStampsIo = { load: vi.fn(async () => Promise.reject(new Error('Could not read the stamps.'))) }
    const { win } = open({ stampsIo: failing })
    await waitFor(() => expect(failing.load).toHaveBeenCalled())
    expect(lineOf(win, 'sent:sd-statement')).toBeTruthy()
    expect(win.querySelector('[data-line-small-print]')).toBeNull()
  })
})
