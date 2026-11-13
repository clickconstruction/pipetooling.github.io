// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { LineFileChips, MessageFiles } from './LineFiles'
import { lineFilesFromRows, type MessageAttachmentRow } from '../../../lib/messages/lineFiles'
import type { OwnLinkState } from '../../../lib/messages/sentLineFiles'
import { MessageWindow } from './MessageWindow'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { loadRichMail } from '../../../lib/messages/richMailIo'
import { recoveryFailureFromError } from '../../../lib/offlineRecoveryState'
import { EMAIL_VIEW_KEY } from '../../../lib/messages/richMail'
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
// The rich view's read (#259) is a bucket download; the tests hand it the HTML. The retry panel reads the signed-in user.
vi.mock('../../../lib/messages/richMailIo', () => ({ loadRichMail: vi.fn() }))
vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

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

  it('draws a web address in the words as one press with a link mark, the doubled form once, and the sender’s bold as bold (v2.6508)', () => {
    const plans = 'https://maxxbuilders.box.example/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3'
    const m = { ...line('m-greg-email-in'), body: `Wendi,\n\nWe at *Marrex Builders* invite you to bid.\n\n*Link to Plans*:\n**${plans}\n<${plans}>*\nDeadline: *Monday, November 02, 2026, 3:00 PM*` }
    renderWithProviders(<MessageWindow message={m} contact={greg} tile={undefined} onClose={vi.fn()} />)
    const full = screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' }).querySelector('[data-message-full]') as HTMLElement
    const a = within(full).getByRole('link', { name: plans })
    expect(a.getAttribute('href')).toBe(plans)
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a.querySelector('svg')).toBeTruthy()
    expect(full.querySelectorAll('a[data-body-link]').length).toBe(1)
    expect([...full.querySelectorAll('strong')].map((b) => b.textContent)).toEqual(['Marrex Builders', 'Link to Plans', plans, 'Monday, November 02, 2026, 3:00 PM'])
    expect(full.textContent).not.toContain('*')
    expect(full.textContent).not.toContain('<')
    // The print page draws the same: the address a link, the bold in <b>, no star.
    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    const html = vi.mocked(openHtmlPrintWindow).mock.calls[0]![0] as string
    expect(html).toContain(`<a href="${plans}" target="_blank" rel="noopener noreferrer">${plans}</a>`)
    expect(html).toContain('<b>Marrex Builders</b>')
    expect(html.split(plans).length - 1).toBe(2)
    expect(html).not.toContain('*')
    // Copy still carries the words as they came, stars and all.
    const write = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(write).toHaveBeenCalledWith(m.body)
  })

  it('lists an email’s Attachments: where each is, and Open where it can be opened (cut 6)', () => {
    renderWithProviders(<MessageWindow message={line('m-greg-email-in')} contact={greg} tile={undefined} onClose={vi.fn()} />)
    const files = screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' }).querySelector('[data-message-files]') as HTMLElement
    expect(within(files).getByRole('heading', { name: 'Attachments (4)' })).toBeTruthy()
    expect([...files.querySelectorAll('[data-message-file]')].map((r) => r.textContent)).toEqual([
      'PDFHillside-Boerne-sitework-rev1.pdf · 1.3 MB · our copy kept on arrivalOpenSave to Drive',
      'IMGsite-photo-pad.jpg · 2.8 MB · our copy kept on arrivalOpenSave to Drive',
      'Addendum 2 drawings · a link, not a fileOpen',
      'FHillside-Boerne-full-set.zip · 31 MB · too big to keep, it stays in Gmail',
    ])
    expect(within(files).getByRole('link', { name: 'Open Hillside-Boerne-sitework-rev1.pdf' }).getAttribute('href')).toBe('/files/messages/f-greg-sitework')
    expect(within(files).getByRole('link', { name: 'Open Addendum 2 drawings' }).getAttribute('href')).toBe('https://drive.example/addendum-2')
    // v2.6508: a link's mark is the chain link the words use, with its meaning in its title, and every row's Open sits
    // right after its words (the words take only their width), not pinned to the window's far edge.
    const linkRow = files.querySelector('[data-message-file="f-greg-addendum"]') as HTMLElement
    const mark = linkRow.querySelector('[data-file-badge="link"]') as HTMLElement
    expect(mark.getAttribute('title')).toBe('A link, not a file. Open goes to its address.')
    expect(mark.querySelector('svg')).toBeTruthy()
    expect(files.querySelector('[data-file-badge="pdf"]')!.textContent).toBe('PDF')
    for (const row of files.querySelectorAll<HTMLElement>('[data-message-file]')) {
      const words = row.querySelector<HTMLElement>('[data-message-file-words]')!
      expect(words.style.flexGrow).toBe('0')
      const open = row.querySelector('a[aria-label^="Open"]')
      if (open) expect(words.nextElementSibling).toBe(open)
    }
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
      'Boerne Retail Shell plans, rev 2 · sent as our link to their portal',
      'Bid tab, Sitework.pdf · sent as our link to the file',
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
      'Boerne Retail Shell plans, rev 2 · sent as our link to their portal · they opened their portal twice since, last Mon Oct 12 at 2:10 PMOpen',
      'Bid tab, Sitework.pdf · sent as our link to the file · opened twice, last 2:10 PMOpens: today 2:10 PM · Fri Oct 9, 4:42 PMOpenCut it off',
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

  it('draws the signature’s number, address and street address as presses, the tracking links as links (v2.6513)', () => {
    const m: ThreadMessage = {
      ...line('m-greg-email-in'),
      body: `Thank you.\nGlenn Gelwin\n[image: phone] (832) 871-4166 ext. 121\n[image: email] glenn@marrexbuilders.example <https://server.utags.co/gLCOFBOU>\n[image: company-address] 4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477\n[image: instagram] <https://server.utags.co/yhmOAqla>`,
      files: [],
    }
    const acts = { onCall: vi.fn(), onReply: vi.fn(), onMap: vi.fn() }
    renderWithProviders(<MessageWindow message={m} contact={greg} tile={undefined} onClose={vi.fn()} contactActs={acts} />)
    const full = screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' }).querySelector('[data-message-full]') as HTMLElement
    expect([...full.querySelectorAll('[data-contact-point]')].map((el) => el.getAttribute('data-contact-point'))).toEqual(['phone', 'email', 'address'])
    expect(full.textContent).not.toContain('[image: phone]')
    expect(full.textContent).toContain('(832) 871-4166 ext. 121')
    // Call dials the number alone, the extension kept as words; no Text on a number with an extension.
    const call = within(full).getByTestId('body-call') as HTMLAnchorElement
    expect(call.getAttribute('href')).toBe('tel:+18328714166')
    expect(within(full).queryByTestId('body-text')).toBeNull()
    fireEvent.click(call)
    expect(acts.onCall).toHaveBeenCalledWith(expect.objectContaining({ kind: 'phone', number: '(832) 871-4166', ext: '121' }), 'phone')
    fireEvent.click(within(full).getByTestId('body-email'))
    expect(acts.onReply).toHaveBeenCalledWith(expect.objectContaining({ kind: 'email', address: 'glenn@marrexbuilders.example' }), 'email')
    const map = within(full).getByTestId('body-map') as HTMLAnchorElement
    expect(map.getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=4150%20Bluebonnet%20Dr.%20Suite%20102%20Stafford%2C%20TX%2C%2077477')
    expect(map.getAttribute('target')).toBe('_blank')
    fireEvent.click(map)
    expect(acts.onMap).toHaveBeenCalledWith(expect.objectContaining({ kind: 'address' }))
    // The tracking links stay plain links, never contact points.
    expect([...full.querySelectorAll('[data-body-link]')].map((a) => a.getAttribute('href'))).toEqual(['https://server.utags.co/gLCOFBOU', 'https://server.utags.co/yhmOAqla'])
    cleanup()
    // With no thread around it, Text and Email are not offered; Call and the map still work on their own.
    renderWithProviders(<MessageWindow message={m} contact={greg} tile={undefined} onClose={vi.fn()} />)
    expect(screen.queryByTestId('body-email')).toBeNull()
    expect(screen.getByTestId('body-call')).toBeTruthy()
    expect(screen.getByTestId('body-map')).toBeTruthy()
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

/** An invitation as a mail client writes it: a table, a linked word, a logo, a tracking pixel, a script. */
const RICH_HTML = '<html><body><table width="600"><tr><td style="padding:4px">Scope</td><td>Plumbing</td></tr></table><p>See the <a href="https://plans.example/set" target="_self">plans</a>.</p><img src="https://sender.example/logo.png" width="200" height="60" alt="Sender logo"><img src="https://track.example/o.gif" width="1" height="1"><script>alert(1)</script></body></html>'

describe('MessageWindow: Rich text · Plain over an email the reader kept the HTML of (#259, v2.6676)', () => {
  const richLine = (): ThreadMessage => ({ ...line('m-greg-email-in'), bodyHtmlPath: 'm-greg-email-in/body.html' })
  const chips = () => screen.getByRole('group', { name: 'Read it as' })
  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    cleanup()
  })

  it('draws no chips on a line with no kept HTML, and the plain words as before', () => {
    renderWithProviders(<MessageWindow message={line('m-greg-email-in')} contact={greg} tile={undefined} onClose={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Read it as' })).toBeNull()
    const full = document.querySelector('[data-message-full]') as HTMLElement
    expect(full.getAttribute('data-email-view')).toBeNull()
    expect(full.textContent).toBe(line('m-greg-email-in').body)
    expect(loadRichMail).not.toHaveBeenCalled()
  })

  it('opens on Plain with the chips over the words, reads nothing from the bucket until Rich text is pressed', () => {
    renderWithProviders(<MessageWindow message={richLine()} contact={greg} tile={undefined} onClose={vi.fn()} />)
    const group = chips()
    expect([...group.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Rich text', 'false'],
      ['Plain', 'true'],
    ])
    const full = document.querySelector('[data-message-full]') as HTMLElement
    expect(full.getAttribute('data-email-view')).toBe('plain')
    expect(full.textContent).toBe(richLine().body)
    expect(loadRichMail).not.toHaveBeenCalled()
  })

  it('Rich text reads the kept HTML, draws it cleaned with pictures off, Show pictures turns them on, and the choice is kept', async () => {
    vi.mocked(loadRichMail).mockResolvedValue({ ok: true, html: RICH_HTML })
    renderWithProviders(<MessageWindow message={richLine()} contact={greg} tile={undefined} onClose={vi.fn()} />)
    fireEvent.click(within(chips()).getByRole('button', { name: 'Rich text' }))
    expect(loadRichMail).toHaveBeenCalledWith('m-greg-email-in/body.html')
    expect(localStorage.getItem(EMAIL_VIEW_KEY)).toBe('rich')
    const paper = await screen.findByText('Scope')
    const rich = paper.closest('[data-rich-mail]') as HTMLElement
    expect(rich.getAttribute('data-pictures')).toBe('off')
    expect(rich.closest('[data-theme="light"]')).toBeTruthy()
    // The table stands, the script is gone, the link opens in a new tab, the pixel is gone, the logo is off.
    expect(rich.querySelector('table')!.getAttribute('width')).toBe('600')
    expect(rich.querySelector('script')).toBeNull()
    expect(rich.textContent).not.toContain('alert')
    const a = rich.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://plans.example/set')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    const imgs = rich.querySelectorAll('img')
    expect(imgs.length).toBe(1)
    expect(imgs[0]!.hasAttribute('src')).toBe(false)
    expect(imgs[0]!.getAttribute('alt')).toBe('Sender logo')
    expect(screen.getByText('1 picture is off.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show pictures' }))
    await waitFor(() => expect((document.querySelector('[data-rich-mail] img') as HTMLElement).getAttribute('src')).toBe('https://sender.example/logo.png'))
    expect(screen.queryByRole('button', { name: 'Show pictures' })).toBeNull()
    expect((document.querySelector('[data-rich-mail]') as HTMLElement).getAttribute('data-pictures')).toBe('on')
    expect(document.querySelector('[data-rich-mail]')!.innerHTML).not.toContain('track.example')
    // Copy still carries the plain words.
    const write = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(write).toHaveBeenCalledWith(richLine().body)
    // Plain goes back to the words and keeps that too.
    fireEvent.click(within(chips()).getByRole('button', { name: 'Plain' }))
    expect((document.querySelector('[data-message-full]') as HTMLElement).textContent).toBe(richLine().body)
    expect(localStorage.getItem(EMAIL_VIEW_KEY)).toBe('plain')
  })

  it('opens on Rich text when the device kept it, and a read that fails draws its reason', async () => {
    localStorage.setItem(EMAIL_VIEW_KEY, 'rich')
    vi.mocked(loadRichMail).mockResolvedValue({ ok: false, failure: recoveryFailureFromError(new Error('The bucket said no.'), 'The sender’s layout could not be read.') })
    renderWithProviders(<MessageWindow message={richLine()} contact={greg} tile={undefined} onClose={vi.fn()} />)
    expect(within(chips()).getByRole('button', { name: 'Rich text' }).getAttribute('aria-pressed')).toBe('true')
    expect(loadRichMail).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('The bucket said no.')).toBeTruthy()
    expect(document.querySelector('[data-rich-mail]')).toBeNull()
  })
})
