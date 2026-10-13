// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { LineFileChips, MessageFiles } from './LineFiles'
import { lineFilesFromRows, type MessageAttachmentRow } from '../../../lib/messages/lineFiles'
import type { OwnLinkState } from '../../../lib/messages/sentLineFiles'
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
// The job's tick under Attachments (cut 10) reads its own row; PhotoSaveTick.render.test covers it.
vi.mock('../../../lib/photos/photoSavesIo', () => ({ loadPhotoSave: vi.fn(() => Promise.resolve(null)), setPhotoSave: vi.fn() }))

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
      'PDFHillside-Boerne-sitework-rev1.pdf · 1.3 MB · our copy kept on arrivalOpenSave to Drive',
      'IMGsite-photo-pad.jpg · 2.8 MB · our copy kept on arrivalOpenSave to Drive',
      '↗Addendum 2 drawings · a link, not a fileOpen',
      'FHillside-Boerne-full-set.zip · 31 MB · too big to keep, it stays in Gmail',
    ])
    expect(within(files).getByRole('link', { name: 'Open Hillside-Boerne-sitework-rev1.pdf' }).getAttribute('href')).toBe('/files/messages/f-greg-sitework')
    expect(within(files).getByRole('link', { name: 'Open Addendum 2 drawings' }).getAttribute('href')).toBe('https://drive.example/addendum-2')
    cleanup()
    renderWithProviders(<MessageWindow message={line('m-greg-text-in')} contact={greg} tile={undefined} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Text' }).querySelector('[data-message-files]')).toBeNull()
  })

  it('saves a file that came in to the job’s Drive folder, then says where it went and opens it there (cut 7f)', async () => {
    const save = vi.fn(() => Promise.resolve({ driveFileId: 'drvSitework0001', url: 'https://drive.google.com/file/d/drvSitework0001/view' }))
    const m = { ...line('m-greg-email-in'), jobId: 'bid:bid-boerne' }
    renderWithProviders(<MessageWindow message={m} contact={greg} tile={view.tiles['bid:bid-boerne']} onClose={vi.fn()} />)
    const row = screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' }).querySelector('[data-message-file="f-greg-sitework"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Save to Drive' }))
    const sheet = row.querySelector('[data-save-to-drive]') as HTMLElement
    expect(sheet.textContent).toContain('Save it to B482’s Drive folder')
    // A bid's folder has no halves, so there is no pick: it goes into the folder, which only the team sees.
    expect(sheet.textContent).toContain('It goes into the job’s Drive folder. Only the team sees it there.')
    expect(within(sheet).queryByRole('radiogroup')).toBeNull()
    expect(save).not.toHaveBeenCalled()
    cleanup()
    // The window's own io is the default; the test hands one in through MessageFiles.
    renderWithProviders(<MessageFiles files={m.files!} jobKey="bid:bid-boerne" jobLabel="B482" save={save} />)
    const r = document.querySelector('[data-message-file="f-greg-sitework"]') as HTMLElement
    fireEvent.click(within(r).getByRole('button', { name: 'Save to Drive' }))
    fireEvent.click(within(r).getByRole('button', { name: 'Save it' }))
    await waitFor(() => expect(r.querySelector('[data-saved-to-drive]')).toBeTruthy())
    expect(save).toHaveBeenCalledWith('f-greg-sitework', 'team_only')
    expect(r.querySelector('[data-saved-to-drive]')!.textContent).toBe('Saved to the job’s Drive folder. Open in Drive')
    expect(within(r).getByRole('link', { name: 'Open in Drive' }).getAttribute('href')).toBe('https://drive.google.com/file/d/drvSitework0001/view')
  })

  it('on a GC project picks Plans for a drawing and Team only for a quote; a photo goes to the photos; no job asks for one', async () => {
    const save = vi.fn(() => Promise.resolve({ driveFileId: 'drvPlans00001', url: 'https://drive.google.com/file/d/drvPlans00001/view' }))
    const files = line('m-greg-email-in').files!
    renderWithProviders(<MessageFiles files={files} jobKey="project:p-helotes" jobLabel="#47" save={save} />)
    const pdf = document.querySelector('[data-message-file="f-greg-sitework"]') as HTMLElement
    fireEvent.click(within(pdf).getByRole('button', { name: 'Save to Drive' }))
    const radios = within(pdf).getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.checked)).toEqual([false, true])
    fireEvent.click(radios[0]!)
    fireEvent.click(within(pdf).getByRole('button', { name: 'Save it' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith('f-greg-sitework', 'team_only'))
    await waitFor(() => expect(pdf.textContent).toContain('Saved to the job’s Team only folder, under From email.'))
    const photo = document.querySelector('[data-message-file="f-greg-photo"]') as HTMLElement
    fireEvent.click(within(photo).getByRole('button', { name: 'Save to Drive' }))
    expect(photo.textContent).toContain('It goes into the job’s photos, named by its day and who sent it.')
    cleanup()
    renderWithProviders(<MessageFiles files={files} jobKey={null} jobLabel={null} save={save} />)
    const none = document.querySelector('[data-message-file="f-greg-sitework"]') as HTMLElement
    fireEvent.click(within(none).getByRole('button', { name: 'Save to Drive' }))
    expect(none.textContent).toContain('This message is on nobody’s job. Tie it to a job first, so the file has a folder.')
    expect(within(none).queryByRole('button', { name: 'Save it' })).toBeNull()
  })

  it('a file saved before says it is in Drive; a refusal keeps its words and the button to try again', async () => {
    const files = line('m-greg-email-in').files!.map((f) => (f.id === 'f-greg-sitework' ? { ...f, driveFileId: 'drvSaved00001' } : f))
    const save = vi.fn(() => Promise.reject(new Error('A training account cannot change Drive.')))
    renderWithProviders(<MessageFiles files={files} jobKey="bid:bid-boerne" jobLabel="B482" save={save} />)
    const saved = document.querySelector('[data-message-file="f-greg-sitework"]') as HTMLElement
    expect(saved.querySelector('[data-saved-to-drive]')!.textContent).toBe('Saved to the job’s Drive. Open in Drive')
    expect(within(saved).queryByRole('button', { name: 'Save to Drive' })).toBeNull()
    const photo = document.querySelector('[data-message-file="f-greg-photo"]') as HTMLElement
    fireEvent.click(within(photo).getByRole('button', { name: 'Save to Drive' }))
    fireEvent.click(within(photo).getByRole('button', { name: 'Save it' }))
    await waitFor(() => expect(photo.textContent).toContain('A training account cannot change Drive.'))
    expect(within(photo).getByRole('button', { name: 'Save it' })).toBeTruthy()
  })

  it('marks each file on a line we sent how it went, under the line and in its Files, with our link’s opens and Cut it off (cut 7f)', async () => {
    const row = (id: string, more: Partial<MessageAttachmentRow>): MessageAttachmentRow => ({
      id, message_id: 'm-rosa-out', sort_order: 0, kind: 'file', name: '', mime: 'application/pdf', size_bytes: null, bucket_path: null,
      left_in_gmail: null, url: null, host: null, paper: null, paper_answer: null, paper_answered_by: null, paper_answered_at: null, ...more,
    })
    const files = lineFilesFromRows([
      row('a-addendum', { sort_order: 0, name: 'Addendum 2.pdf', size_bytes: 412_000, bucket_path: 'out/m/1-Addendum 2.pdf', sent_as: 'file' }),
      row('a-plans', { sort_order: 1, kind: 'link', name: 'Boerne Retail Shell plans, rev 2', url: 'https://clicktooling.com/t/7Hq2#plans', sent_as: 'link' }),
      row('a-bidtab', { sort_order: 2, kind: 'link', name: 'Bid tab, Sitework.pdf', url: 'https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0', sent_as: 'link', drive_link_id: 'dl-bidtab', drive_file_id: 'drvBidTab00001' }),
    ]).get('m-rosa-out')!

    renderWithProviders(<LineFileChips files={files} onOpen={vi.fn()} />)
    expect([...document.querySelectorAll('[data-line-files] button')].map((b) => b.textContent)).toEqual([
      'PDFAddendum 2.pdf · sent as the file',
      '↗Boerne Retail Shell plans, rev 2 · sent as our link to their portal',
      '↗Bid tab, Sitework.pdf · sent as our link to the file',
    ])
    cleanup()

    const state: OwnLinkState = { cutAt: null, cutByName: null, endsAt: '2026-11-08T21:42:00Z', opens: 2, openedAt: ['2026-10-12T19:10:00Z', '2026-10-09T21:42:00Z'] }
    const links = {
      load: vi.fn((): Promise<Record<string, OwnLinkState>> => Promise.resolve({ 'dl-bidtab': state })),
      cut: vi.fn(() => Promise.resolve()),
      portalOpens: vi.fn(() => Promise.resolve({ opens: 2, lastOpenedAt: '2026-10-12T19:10:00Z' })),
    }
    renderWithProviders(
      <MessageFiles files={files} jobKey="bid:b482" jobLabel="B482" links={links} nowIso="2026-10-12T20:00:00Z" who={greg} sentAt="2026-10-09T21:42:00Z" />,
    )
    const section = document.querySelector('[data-message-files]') as HTMLElement
    expect(within(section).getByRole('heading', { name: 'Files (3)' })).toBeTruthy()
    await waitFor(() => expect(section.querySelector('[data-link-opens]')).toBeTruthy())
    expect(links.load).toHaveBeenCalledWith(['dl-bidtab'])
    // Their portal's opens since the line went, by Greg's company (a trade partner).
    await waitFor(() => expect(section.textContent).toContain('they opened their portal twice since'))
    expect(links.portalOpens).toHaveBeenCalledWith({ kind: 'trade', gcCompanyId: greg.gcCompanyId ?? null, customerId: greg.customerId ?? null }, '2026-10-09T21:42:00Z')
    const rows = [...section.querySelectorAll('[data-message-file]')] as HTMLElement[]
    expect(rows.map((r) => r.textContent)).toEqual([
      'PDFAddendum 2.pdf · 412 KB · sent as the file · kept with the copyOpen',
      '↗Boerne Retail Shell plans, rev 2 · sent as our link to their portal · they opened their portal twice since, last Mon Oct 12 at 2:10 PMOpen',
      '↗Bid tab, Sitework.pdf · sent as our link to the file · opened twice, last 2:10 PMOpens: today 2:10 PM · Fri Oct 9, 4:42 PMOpenCut it off',
    ])
    // A sent file has no Save to Drive; our own link opens through the office's page, never the public one.
    expect(within(section).queryByRole('button', { name: 'Save to Drive' })).toBeNull()
    expect(within(rows[2]!).getByRole('link', { name: 'Open Bid tab, Sitework.pdf' }).getAttribute('href')).toBe('/files/drive/bid%3Ab482%3AdrvBidTab00001')
    expect(within(rows[1]!).queryByRole('button', { name: 'Cut it off' })).toBeNull()

    links.load.mockImplementation(() => Promise.resolve({ 'dl-bidtab': { ...state, cutAt: '2026-10-12T19:30:00Z', cutByName: 'Rosa' } }))
    fireEvent.click(within(rows[2]!).getByRole('button', { name: 'Cut it off' }))
    await waitFor(() => expect(rows[2]!.textContent).toContain('cut off by Rosa Mon Oct 12 · our link opens nothing now'))
    expect(links.cut).toHaveBeenCalledWith('dl-bidtab')
    expect(within(rows[2]!).queryByRole('button', { name: 'Cut it off' })).toBeNull()
    expect(rows[2]!.querySelector('[data-link-opens]')).toBeNull()
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
