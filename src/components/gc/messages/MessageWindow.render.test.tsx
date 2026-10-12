// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MessageWindow } from './MessageWindow'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { runJobShare } from '../../../lib/jobShare'
import { contactById } from '../../../lib/contacts/kernel'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { SENT_LINE_PREFIX } from '../../../lib/messages/sentLines'
import type { ThreadMessage } from '../../../lib/messages/thread'

vi.mock('../../../lib/jobsDocuments/printWindow', () => ({ openHtmlPrintWindow: vi.fn(() => true) }))
vi.mock('../../../lib/jobShare', () => ({ runJobShare: vi.fn(() => Promise.resolve('copied')) }))

const view = spineMessagesView()
const greg = contactById(view.contacts, 'c-greg')!
const line = (id: string) => view.messages.find((m) => m.id === id)!

describe('MessageWindow: one message in full (Messages, cut 1)', () => {
  afterEach(() => vi.clearAllMocks())

  it('reads its facts, its job with change, and its whole words', () => {
    const onChangeJob = vi.fn()
    const m = line('m-greg-email-in')
    renderWithProviders(<MessageWindow message={m} contact={greg} tile={view.tiles['bid:bid-boerne']} onChangeJob={onChangeJob} onClose={vi.fn()} />)
    const win = screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' })
    const facts = win.querySelector('dl') as HTMLElement
    expect([...facts.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['From', 'Received', 'Through', 'Tied to'])
    expect(facts.textContent).toContain('greg@hillside.example')
    expect(facts.textContent).toContain('B482 Boerne Retail Shell')
    fireEvent.click(within(facts).getByRole('button', { name: 'change' }))
    expect(onChangeJob).toHaveBeenCalledTimes(1)
    expect(win.querySelector('[data-message-full]')!.textContent).toBe(m.body)
  })

  it('lists an email’s Attachments: where each is, and Open where it can be opened (cut 6)', () => {
    renderWithProviders(<MessageWindow message={line('m-greg-email-in')} contact={greg} tile={undefined} onClose={vi.fn()} />)
    const files = screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' }).querySelector('[data-message-files]') as HTMLElement
    expect(within(files).getByRole('heading', { name: 'Attachments (4)' })).toBeTruthy()
    expect([...files.querySelectorAll('[data-message-file]')].map((r) => r.textContent)).toEqual([
      'PDFHillside-Boerne-sitework-rev1.pdf · 1.3 MB · our copy kept on arrivalOpen',
      'IMGsite-photo-pad.jpg · 2.8 MB · our copy kept on arrivalOpen',
      '↗Addendum 2 drawings · a link, not a fileOpen',
      'FHillside-Boerne-full-set.zip · 31 MB · too big to keep, it stays in Gmail',
    ])
    expect(within(files).getByRole('link', { name: 'Open Hillside-Boerne-sitework-rev1.pdf' }).getAttribute('href')).toBe('/files/messages/f-greg-sitework')
    expect(within(files).getByRole('link', { name: 'Open Addendum 2 drawings' }).getAttribute('href')).toBe('https://drive.example/addendum-2')
    cleanup()
    renderWithProviders(<MessageWindow message={line('m-greg-text-in')} contact={greg} tile={undefined} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Text' }).querySelector('[data-message-files]')).toBeNull()
  })

  it('a line on the person says so; a sent copy keeps its own job and says where its copy is kept', () => {
    const sent: ThreadMessage = { ...line('m-greg-text-out'), id: `${SENT_LINE_PREFIX}copy-1`, channel: 'email', direction: 'out', subject: 'Your bid, Boerne' }
    renderWithProviders(<MessageWindow message={sent} contact={greg} tile={undefined} onClose={vi.fn()} />)
    const win = screen.getByRole('dialog', { name: 'Email: Your bid, Boerne' })
    expect(win.textContent).toContain('no job, it sits on the person')
    expect(within(win).queryByRole('button', { name: 'change' })).toBeNull()
    expect(win.textContent).toContain('A copy as it went is kept with the sent copies.')
  })

  it('its tools: a later cut\'s first, Copy, Print or save as PDF, and Share', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const first = vi.fn((_m: ThreadMessage, selection: string) => <button type="button">{selection ? 'Highlight' : 'Remove'}</button>)
    const m = line('m-greg-text-in')
    renderWithProviders(<MessageWindow message={m} contact={greg} tile={undefined} first={first} onClose={vi.fn()} />)
    const win = screen.getByRole('dialog', { name: 'Text' })
    expect(within(win).getByRole('button', { name: 'Remove' })).toBeTruthy()
    expect(first).toHaveBeenLastCalledWith(m, '')

    fireEvent.click(within(win).getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(m.body))
    fireEvent.click(within(win).getByRole('button', { name: 'Print or save as PDF' }))
    expect(vi.mocked(openHtmlPrintWindow).mock.calls[0]![0]).toContain('detention pond')
    fireEvent.click(within(win).getByRole('button', { name: 'Share…' }))
    await waitFor(() => expect(runJobShare).toHaveBeenCalledWith(expect.objectContaining({ title: 'Text · Greg Paulk', text: m.body }), navigator))
    expect(await screen.findByText('Copied, to paste where you share it.')).toBeTruthy()
  })

  it('closes on ×, on its backdrop and on Escape, never on a press inside', () => {
    const onClose = vi.fn()
    renderWithProviders(<MessageWindow message={line('m-greg-text-in')} contact={greg} tile={undefined} onClose={onClose} />)
    const win = screen.getByRole('dialog', { name: 'Text' })
    fireEvent.click(win)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(win.parentElement!)
    fireEvent.click(within(win).getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
