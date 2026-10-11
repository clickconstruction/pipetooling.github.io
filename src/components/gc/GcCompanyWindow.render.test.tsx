// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcCompanyWindow, type CompanyPapersDoor } from './GcCompanyWindow'
import { PartnerName } from './GcPartnerName'
import { GcCompanyOpenerContext } from './gcCompanyOpener'
import { boardStateFromRows, type BoardRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { partnerActivity } from '../../lib/gc/companyFile'
import { paperDayChoices } from '../../lib/gc/paperSend'
import type { PaperSendOutcome } from '../../lib/gc/papersIo'
import type { Partner } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** The clinic with Lonestar's bookkeeper named, and Hillside's no on the sitework written down. */
function rows(): BoardRows {
  const base = clinicBoardRows()
  return {
    ...base,
    companies: base.companies.map((c) => (c.id === 'lonestar' ? { ...c, contact_gets: ['quotes', 'job'] } : c)),
    people: [{ id: 'pp1', company_id: 'lonestar', name: 'Ana Ruiz', email: 'ana@lonestar.test', role: 'Bookkeeper', gets: ['pay'] }],
    invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'declined', declined_why: 'wont', decline_reason: 'busy', decline_note: 'crews on a school job', declined_on: '2026-10-06' } : i)),
  }
}

function open(companyId: string, over: { onLanguage?: (lang: 'en' | 'es') => Promise<void>; onClose?: () => void } = {}) {
  const state = boardStateFromRows(rows())
  const partner = state.partners.find((p) => p.id === companyId)!
  const onLanguage = over.onLanguage ?? vi.fn(() => Promise.resolve())
  const onClose = over.onClose ?? vi.fn()
  render(<GcCompanyWindow state={state} partner={partner} lang="en" onLanguage={onLanguage} onClose={onClose} onOpenProject={() => undefined} />)
  return { onLanguage, onClose, dialog: screen.getByRole('dialog', { name: partner.company }) }
}

describe('GcCompanyWindow', () => {
  it('shows how they answer, their vetting, where they drive from, and who gets our emails', () => {
    const { dialog } = open('lonestar')
    expect(within(dialog).getByText('quoted 1 of 1 asks')).toBeTruthy()
    expect(within(dialog).getByText('a company we know')).toBeTruthy()
    expect(within(dialog).getByText('4410 Boerne Stage Rd, San Antonio, up to 60 mi')).toBeTruthy()
    const people = dialog.querySelector('[data-gc-company-people="lonestar"]') as HTMLElement
    expect(within(people).getByText('Ray Ortiz')).toBeTruthy()
    expect(within(people).getByText('Ana Ruiz')).toBeTruthy()
    expect(within(people).getByText('Bookkeeper')).toBeTruthy()
    expect(within(people).getByText('Pay and papers')).toBeTruthy()
    expect(within(people).getByText('Quotes and plans')).toBeTruthy()
  })

  it('says no email is on file rather than making one up', () => {
    const { dialog } = open('lonestar')
    const people = dialog.querySelector('[data-gc-company-people="lonestar"]') as HTMLElement
    expect(within(people).getByText('no email on file')).toBeTruthy()
    expect(people.textContent).not.toMatch(/\.example/)
    expect(within(people).getByRole('link', { name: 'ana@lonestar.test' })).toBeTruthy()
  })

  it('lists the times they passed with the reason written down, and its vetting for a company new to us', () => {
    const { dialog } = open('hillside')
    expect(within(dialog).getByText('Times they passed')).toBeTruthy()
    expect(within(dialog).getByText(/too busy: crews on a school job/)).toBeTruthy()
    expect(within(dialog).getByText('not vetted yet. Their form is not in yet.')).toBeTruthy()
    expect(within(dialog).getByText('address not set')).toBeTruthy()
  })

  it('sets the language, and shows the problem in words when it does not save', async () => {
    const onLanguage = vi.fn(() => Promise.reject(new Error('That did not save.')))
    const { dialog } = open('hillside', { onLanguage })
    fireEvent.change(within(dialog).getByLabelText('Language for Hillside Excavation'), { target: { value: 'es' } })
    expect(onLanguage).toHaveBeenCalledWith('es')
    await within(dialog).findByText('That did not save.')
  })

  it('shows their portal on its own tab when the page passes it, and no such tab when it does not', () => {
    const state = boardStateFromRows(rows())
    const partner = state.partners.find((p) => p.id === 'lonestar')!
    const { unmount } = render(<GcCompanyWindow state={state} partner={partner} lang="en" onLanguage={vi.fn()} onClose={vi.fn()} onOpenProject={() => undefined} portal={<p>The link is on.</p>} />)
    const dialog = screen.getByRole('dialog', { name: 'Lonestar Earthworks' })
    expect(within(dialog).queryByText('The link is on.')).toBeNull()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Their portal' }))
    expect(within(dialog).getByText('The link is on.')).toBeTruthy()
    unmount()
    const { dialog: plain } = open('lonestar')
    expect(within(plain).queryByRole('tab', { name: 'Their portal' })).toBeNull()
  })

  it('closes on Escape and on its close button', () => {
    const onClose = vi.fn()
    const { dialog } = open('hillside', { onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('PartnerName', () => {
  it('is plain text where no window can open, and opens the company where one can', async () => {
    const onOpen = vi.fn()
    render(
      <>
        <PartnerName partnerId="plain" company="Plain Co" />
        <GcCompanyOpenerContext.Provider value={{ openPartner: onOpen }}>
          <PartnerName partnerId="linked" company="Linked Co" />
        </GcCompanyOpenerContext.Provider>
      </>,
    )
    expect(screen.getByText('Plain Co').tagName).toBe('STRONG')
    fireEvent.click(screen.getByRole('button', { name: 'Linked Co' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('linked'))
  })
})

describe('GcCompanyWindow · Documents (B6-b-ii)', () => {
  /** Hillside: no paper on file and nothing asked yet. The Book has its W-9 form and no master services agreement. */
  function openDocs(over: { papers?: Partial<CompanyPapersDoor> | null; outcome?: PaperSendOutcome; partner?: Partial<Partner>; coiLink?: string | null } = {}) {
    const state = boardStateFromRows(rows())
    const partner = { ...state.partners.find((p) => p.id === 'hillside')!, ...over.partner }
    const onSend = vi.fn((): Promise<PaperSendOutcome> => Promise.resolve(over.outcome ?? { ok: true, to: ['Dee Park'], emailed: true }))
    const onRecordInsurance = vi.fn(() => Promise.resolve())
    const onMarkCoiGood = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    const papers = over.papers === null ? undefined : { entries: { msa: null, w9: 'entry-w9' }, onSend, onRecordInsurance, onMarkCoiGood, ...over.papers }
    render(
      <GcCompanyWindow
        state={state}
        partner={partner}
        lang="en"
        onLanguage={vi.fn()}
        onClose={onClose}
        onOpenProject={() => undefined}
        {...(papers ? { papers } : {})}
        {...(over.coiLink !== undefined ? { coiReceivedLink: over.coiLink } : {})}
        at={{ tab: 'documents' }}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: partner.company })
    const row = (key: string) => within(dialog.querySelector(`[data-gc-doc="${key}"]`) as HTMLElement)
    return { state, onSend, onRecordInsurance, onMarkCoiGood, onClose, dialog, row }
  }

  it('shows a certificate from their portal waiting for a look, with its link, and marks it good (P5b-2)', async () => {
    const waiting = { coiReceived: { id: 'paper-waiting', sentOn: '2026-10-09', expires: '2027-10-09' } }
    const { dialog, row, onMarkCoiGood } = openDocs({ partner: waiting, coiLink: 'https://drive.google.com/file/d/up/view' })
    const r = row('insurance-received')
    expect(r.getByText('Certificate from their portal')).toBeTruthy()
    expect(r.getByText('waiting for your look')).toBeTruthy()
    expect(r.getByText(/Came in Oct 9 · good to Oct 9\. It counts once it is marked good\./)).toBeTruthy()
    expect(r.getByRole('link', { name: 'Open the certificate' }).getAttribute('href')).toBe('https://drive.google.com/file/d/up/view')
    // The insurance row still reads as owed until it is marked good.
    expect(row('insurance').getByText('none on file')).toBeTruthy()
    fireEvent.click(r.getByRole('button', { name: 'Mark it good' }))
    await waitFor(() => expect(onMarkCoiGood).toHaveBeenCalledWith('paper-waiting'))
    expect(await within(dialog).findByText('Marked good. Their insurance counts now, good to Oct 9.')).toBeTruthy()
  })

  it('draws the certificate’s link only when it is https (gc 2)', () => {
    const waiting = { coiReceived: { id: 'paper-waiting', sentOn: '2026-10-09', expires: '2027-10-09' } }
    const { row } = openDocs({ partner: waiting, coiLink: 'javascript:alert(1)' })
    expect(row('insurance-received').getByText('Certificate from their portal')).toBeTruthy()
    expect(row('insurance-received').queryByRole('link')).toBeNull()
  })

  it('shows the waiting certificate with no Mark it good to a reader without the presses', () => {
    const { row } = openDocs({ papers: null, partner: { coiReceived: { id: 'paper-waiting', sentOn: '2026-10-09', expires: '2027-10-09' } } })
    expect(row('insurance-received').getByText('Certificate from their portal')).toBeTruthy()
    expect(row('insurance-received').queryByRole('button', { name: 'Mark it good' })).toBeNull()
  })

  it('counts what is missing on its tab, and shows each company paper with where it stands', () => {
    const { dialog, row } = openDocs()
    expect(within(dialog).getByRole('tab', { name: /^Documents · \d+ to get$/ }).getAttribute('aria-selected')).toBe('true')
    expect(row('msa').getByText('not sent')).toBeTruthy()
    expect(row('insurance').getByText('none on file')).toBeTruthy()
    expect(row('w9').getByText('none on file')).toBeTruthy()
  })

  it('shows the master agreement waiting on the agreement, with no send, until the Contract Book has it', () => {
    const { row } = openDocs()
    expect(row('msa').getByText('Waiting on the agreement')).toBeTruthy()
    expect(row('msa').queryByRole('button')).toBeNull()
  })

  it('asks for the W-9 with its email shown as they get it, then says who it went to', async () => {
    const { state, dialog, row, onSend } = openDocs()
    fireEvent.click(row('w9').getByRole('button', { name: 'Ask for it' }))
    const send = within(dialog.querySelector('[data-gc-paper-send="w9"]') as HTMLElement)
    expect(send.getByText('Your W-9 for Click Construction')).toBeTruthy()
    expect(send.getByText('Read and sign')).toBeTruthy()
    fireEvent.change(send.getByLabelText('Your line, added to the email'), { target: { value: 'Thank you.' } })
    expect(within(dialog.querySelector('[data-gc-paper-email]') as HTMLElement).getByText('Thank you.')).toBeTruthy()
    fireEvent.click(send.getByRole('button', { name: 'Send the ask' }))
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toBe('Sent to Dee Park.'))
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ paper: 'w9', mode: 'first' }), paperDayChoices(state.today)[1]!.on, 'Thank you.')
    expect(dialog.querySelector('[data-gc-paper-send]')).toBeNull()
  })

  it('says when a send is on record and its email did not go, so a reminder tries again', async () => {
    const { dialog, row } = openDocs({ outcome: { ok: false, recorded: true, why: 'No one at the company gets this kind of email.' } })
    fireEvent.click(row('insurance').getByRole('button', { name: 'Ask for it' }))
    fireEvent.click(within(dialog.querySelector('[data-gc-paper-send="insurance"]') as HTMLElement).getByRole('button', { name: 'Send the ask' }))
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toBe('On record, the email did not go: No one at the company gets this kind of email. Send the reminder to try again.'))
  })

  it('keeps the send open with the words when nothing went on record', async () => {
    const { dialog, row } = openDocs({ outcome: { ok: false, recorded: false, why: 'Spanish emails wait until a native speaker reads them. Send it in English.' } })
    fireEvent.click(row('w9').getByRole('button', { name: 'Ask for it' }))
    const send = within(dialog.querySelector('[data-gc-paper-send="w9"]') as HTMLElement)
    fireEvent.click(send.getByRole('button', { name: 'Send the ask' }))
    await waitFor(() => expect(send.getByRole('alert').textContent).toContain('Spanish emails wait'))
  })

  it('files a certificate that came by email, refusing in words without its day or its link', async () => {
    const { dialog, row, onRecordInsurance } = openDocs()
    fireEvent.click(row('insurance').getByRole('button', { name: 'Record their insurance' }))
    const form = within(dialog.querySelector('[data-gc-record-insurance="hillside"]') as HTMLElement)
    fireEvent.click(form.getByRole('button', { name: 'File the certificate' }))
    expect(form.getByRole('alert').textContent).toBe('Say the day their insurance runs out.')
    fireEvent.change(form.getByLabelText('The day their insurance runs out'), { target: { value: '2027-04-30' } })
    fireEvent.change(form.getByLabelText('Link to the certificate'), { target: { value: 'drive.google.com/file/d/coi' } })
    fireEvent.click(form.getByRole('button', { name: 'File the certificate' }))
    expect(form.getByRole('alert').textContent).toBe('Paste the link to their certificate. It starts with https.')
    fireEvent.change(form.getByLabelText('Link to the certificate'), { target: { value: 'https://drive.google.com/file/d/coi' } })
    fireEvent.click(form.getByRole('button', { name: 'File the certificate' }))
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toBe('Filed. Hillside Excavation’s insurance is good to Apr 30.'))
    expect(onRecordInsurance).toHaveBeenCalledWith('2027-04-30', 'https://drive.google.com/file/d/coi')
  })

  it('is read only without the papers’ presses: no step on any row', () => {
    const { dialog } = openDocs({ papers: null })
    expect(within(dialog).queryByRole('button', { name: 'Ask for it' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Record their insurance' })).toBeNull()
    expect(within(dialog).queryByText('Waiting on the agreement')).toBeNull()
  })

  it('steps out of a send on Escape before it closes the window', () => {
    const { dialog, row, onClose } = openDocs()
    fireEvent.click(row('w9').getByRole('button', { name: 'Ask for it' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(dialog.querySelector('[data-gc-paper-send]')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('GcCompanyWindow · opened at a paper (the opener’s CompanyAt)', () => {
  function openAt(at: { tab?: 'about' | 'documents' | 'portal'; doc?: string; send?: boolean }, entries: CompanyPapersDoor['entries'] | 'none' = { msa: null, w9: 'entry-w9' }) {
    const state = boardStateFromRows(rows())
    const partner = state.partners.find((p) => p.id === 'hillside')!
    const papers = (e: CompanyPapersDoor['entries']): CompanyPapersDoor => ({
      entries: e,
      onSend: vi.fn((): Promise<PaperSendOutcome> => Promise.resolve({ ok: true, to: [], emailed: true })),
      onRecordInsurance: vi.fn(() => Promise.resolve()),
      onMarkCoiGood: vi.fn(() => Promise.resolve()),
    })
    const view = (e: CompanyPapersDoor['entries'] | 'none') => (
      <GcCompanyWindow state={state} partner={partner} lang="en" onLanguage={vi.fn()} onClose={vi.fn()} onOpenProject={() => undefined} {...(e === 'none' ? {} : { papers: papers(e) })} at={at} />
    )
    const r = render(view(entries))
    const dialog = screen.getByRole('dialog', { name: partner.company })
    return { dialog, rerender: (e: CompanyPapersDoor['entries']) => r.rerender(view(e)) }
  }

  it('opens Documents with the W-9’s send open, as a not-ready bar asks', () => {
    const { dialog } = openAt({ tab: 'documents', doc: 'w9', send: true })
    expect(within(dialog).getByRole('tab', { name: /^Documents/ }).getAttribute('aria-selected')).toBe('true')
    expect(dialog.querySelector('[data-gc-paper-send="w9"]')).toBeTruthy()
  })

  it('opens Documents for a paper named without a tab, and waits for the Book’s entries before it opens the send', () => {
    const { dialog, rerender } = openAt({ doc: 'w9', send: true }, null)
    expect(within(dialog).getByRole('tab', { name: /^Documents/ }).getAttribute('aria-selected')).toBe('true')
    expect(dialog.querySelector('[data-gc-paper-send]')).toBeNull()
    rerender({ msa: null, w9: 'entry-w9' })
    expect(dialog.querySelector('[data-gc-paper-send="w9"]')).toBeTruthy()
  })

  it('opens at the master agreement’s row with no send while the Book has no agreement', () => {
    const { dialog } = openAt({ tab: 'documents', doc: 'msa', send: true })
    expect(dialog.querySelector('[data-gc-paper-send]')).toBeNull()
    expect(within(dialog.querySelector('[data-gc-doc="msa"]') as HTMLElement).getByText('Waiting on the agreement')).toBeTruthy()
  })

  it('opens at the row, read only, for a reader with no presses', () => {
    const { dialog } = openAt({ tab: 'documents', doc: 'insurance', send: true }, 'none')
    expect(within(dialog).getByRole('tab', { name: /^Documents/ }).getAttribute('aria-selected')).toBe('true')
    expect(dialog.querySelector('[data-gc-paper-send]')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Ask for it' })).toBeNull()
  })

  it('opens on About when only the company is named, as every caller did before', () => {
    const { dialog } = openAt({})
    expect(within(dialog).getByRole('tab', { name: 'About' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('GcCompanyWindow · Activity (the Board’s B2b-iv)', () => {
  function openActivity(onLogContact?: (how: 'call' | 'text' | 'email', note: string) => Promise<void>, onOpenProject = vi.fn()) {
    const state = boardStateFromRows(clinicBoardRows())
    const partner = state.partners.find((p) => p.id === 'hillside')!
    render(
      <GcCompanyWindow
        state={state}
        partner={partner}
        lang="en"
        onLanguage={() => Promise.resolve()}
        onClose={() => undefined}
        onOpenProject={onOpenProject}
        {...(onLogContact ? { onLogContact } : {})}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: partner.company })
    const events = partnerActivity(state, partner)
    fireEvent.click(within(dialog).getByRole('tab', { name: `Activity (${events.length})` }))
    return { dialog, events, onOpenProject }
  }

  it('sits between About and Documents with its count, newest first, the filters cutting it', () => {
    const { dialog, events } = openActivity()
    expect(within(dialog).getAllByRole('tab').map((t) => t.getAttribute('data-gc-company-tab'))).toEqual(['about', 'activity', 'documents'])
    expect(within(dialog).getByText('Rosa: New to us; met at the pre-bid.')).toBeTruthy()
    const notes = events.filter((e) => e.kind === 'note').length
    fireEvent.click(within(dialog).getByRole('button', { name: `Calls and notes ${notes}` }))
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(notes)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Money 0' }))
    expect(within(dialog).getByText('Nothing here yet.')).toBeTruthy()
  })

  it('a line about a job opens the job', () => {
    const { dialog, onOpenProject } = openActivity()
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Hill Country Clinic · Sitework' })[0]!)
    expect(onOpenProject).toHaveBeenCalledWith('p1')
  })

  it('logs a contact with how they were reached, and has no box without the write', async () => {
    const log = vi.fn(() => Promise.resolve())
    const { dialog } = openActivity(log)
    const press = within(dialog).getByRole('button', { name: 'Log a contact' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'How you reached them' }), { target: { value: 'text' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'What was said' }), { target: { value: '  Crew free from the 20th. ' } })
    fireEvent.click(press)
    await waitFor(() => expect(log).toHaveBeenCalledWith('text', 'Crew free from the 20th.'))
    await waitFor(() => expect((within(dialog).getByRole('textbox', { name: 'What was said' }) as HTMLInputElement).value).toBe(''))
  })

  it('says in words when the contact did not log, and keeps the note', async () => {
    const { dialog } = openActivity(() => Promise.reject(new Error('the network dropped')))
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'What was said' }), { target: { value: 'Left a message.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Log a contact' }))
    expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'The contact was not logged: the network dropped')
    expect((within(dialog).getByRole('textbox', { name: 'What was said' }) as HTMLInputElement).value).toBe('Left a message.')
  })

  it('shows no box when the page gives no write', () => {
    const { dialog } = openActivity()
    expect(within(dialog).queryByRole('button', { name: 'Log a contact' })).toBeNull()
  })
})
