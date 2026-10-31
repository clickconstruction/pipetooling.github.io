// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LegalAffidavitWindow from './LegalAffidavitWindow'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import type { RecordCheckLine, StatementDraft, StatementFace, StatementFilingDraft } from '../../../lib/legal/affidavitPaper'

const check = vi.hoisted(() => ({ lines: [] as RecordCheckLine[], loading: false, failed: [] as string[], calls: [] as unknown[] }))
vi.mock('./useStatementRecordCheck', () => ({ useStatementRecordCheck: (input: unknown) => { check.calls.push(input); return { lines: check.lines, loading: check.loading, failed: check.failed } } }))
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

afterEach(() => { cleanup(); check.lines = []; check.failed = []; check.calls = [] })

const TODAY = '2026-10-31'
const roster = [
  { id: 'u-g', name: 'Grace Lee', role: 'assistant', title: 'Office manager' },
  { id: 'u-da', name: 'Daniel Alvarez', role: 'master_technician', title: null },
]
const account = { payerName: 'Northline Builders', jobs: [{ id: 'j1', label: '742' }], propertyCounty: 'Williamson' }
function open(over: Partial<Parameters<typeof LegalAffidavitWindow>[0]> = {}) {
  // Typed parameters, so a test may read a call's arguments by index.
  const onSave = vi.fn(async (_draft: StatementDraft, _entryId: string | null): Promise<string | null> => 'st-new')
  const onClose = vi.fn()
  render(<LegalAffidavitWindow entry={null} initialOn="2026-09-03" account={account} roster={roster} officeCounty="Guadalupe" todayYmd={TODAY} busy={false} onSave={onSave} onClose={onClose} zIndex={800} {...over} />)
  return { onSave, onClose }
}

describe('LegalAffidavitWindow (punch list #220, v2.6210)', () => {
  it('opens on the composer’s day, before a notary, on the office’s county; the roster pick fills the role line and the title', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Swear a statement' })).toBeTruthy()
    expect(document.querySelector('[data-legal-affidavit-account]')!.textContent).toBe('Northline Builders · job 742')
    expect((screen.getByLabelText('The day it is about') as HTMLInputElement).value).toBe('2026-09-03')
    expect(document.querySelector('[data-legal-affidavit-form="notary"]')!.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-legal-affidavit-county="Guadalupe"]')!.getAttribute('aria-pressed')).toBe('true')
    // The RMP leads the pick.
    const pick = screen.getByLabelText('Who swears it') as HTMLSelectElement
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Pick one of our team', 'Daniel Alvarez · RMP', 'Grace Lee', 'Someone else, a witness…'])
    fireEvent.change(pick, { target: { value: 'u-da' } })
    expect((screen.getByLabelText('Their role, one line') as HTMLInputElement).value).toBe('Responsible Master Plumber of record for Click Plumbing and Electrical')
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Affidavit of Daniel Alvarez')
    expect(document.querySelector('[data-legal-affidavit-opener]')!.textContent).toContain('My name is Daniel Alvarez. I am over eighteen years of age, of sound mind, and capable of making this affidavit.')
    // The record check reads the affiant and the span.
    const last = check.calls[check.calls.length - 1] as { affiant: { userId: string | null }; incidentOn: string; enabled: boolean }
    expect(last.affiant.userId).toBe('u-da')
    expect(last.incidentOn).toBe('2026-09-03')
    expect(last.enabled).toBe(true)
  })

  it('a witness is typed; No notary flips the opener, the title and the county to the property’s; the blank is one press', () => {
    open()
    fireEvent.change(screen.getByLabelText('Who swears it'), { target: { value: '__witness' } })
    fireEvent.change(screen.getByLabelText('Their full name'), { target: { value: 'Thanh Nguyen' } })
    fireEvent.change(screen.getByLabelText('Their role, one line'), { target: { value: 'the foreman for Brightline Electric' } })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Affidavit of Thanh Nguyen')
    fireEvent.click(document.querySelector('[data-legal-affidavit-form="declaration"]')!)
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Declaration of Thanh Nguyen')
    expect(document.querySelector('[data-legal-affidavit-opener]')!.textContent).toContain('capable of making this declaration. I am the foreman for Brightline Electric. I have no interest in the outcome of this dispute.')
    expect(document.querySelector('[data-legal-affidavit-county="Williamson"]')!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(document.querySelector('[data-legal-affidavit-county="blank"]')!)
    expect(document.querySelector('[data-legal-affidavit-county="blank"]')!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('The notary writes the county in by hand where the paper is signed.')).toBeTruthy()
    // A title typed by hand stops following the picks.
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'What Thanh saw' } })
    fireEvent.click(document.querySelector('[data-legal-affidavit-form="notary"]')!)
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('What Thanh saw')
  })

  it('Save sleeps with the reason until the draft is sound, then sends the draft trimmed and closes', async () => {
    const { onSave, onClose } = open()
    const save = document.querySelector('[data-legal-affidavit-save]') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(save.title).toBe('Pick who swears it.')
    fireEvent.change(screen.getByLabelText('Who swears it'), { target: { value: 'u-da' } })
    expect(save.title).toBe('Type the statement.')
    fireEvent.change(screen.getByLabelText('The last day of the span'), { target: { value: '2026-09-17' } })
    fireEvent.change(screen.getByLabelText('The statement'), { target: { value: '  Northline never called us back.\nI drove past the site.  ' } })
    expect(save.disabled).toBe(false)
    expect(screen.getByText('Saves to the Timeline’s Said lane on Sep 3 to Sep 17 as a draft. The firm reads it as a draft.')).toBeTruthy()
    fireEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]).toEqual([
      { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', userId: 'u-da', name: 'Daniel Alvarez', role: 'Responsible Master Plumber of record for Click Plumbing and Electrical' }, incidentOn: '2026-09-03', incidentTo: '2026-09-17', form: 'notary', venueCounty: 'Guadalupe', body: 'Northline never called us back.\nI drove past the site.' },
      null,
    ])
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('the dim closes an empty window; once typed, ✕ asks first and the dim does nothing', () => {
    const { onClose } = open()
    fireEvent.click(document.querySelector('[data-legal-affidavit-backdrop]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    const second = open()
    fireEvent.change(screen.getByLabelText('The statement'), { target: { value: 'x' } })
    fireEvent.click(document.querySelector('[data-legal-affidavit-backdrop]')!)
    expect(second.onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(second.onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Leave without saving?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Leave it' }))
    expect(second.onClose).toHaveBeenCalledTimes(1)
  })

  it('draws the record check with the affiant’s lines bold and an empty day amber, and names a source that could not be read', () => {
    check.lines = [
      { ymd: '2026-09-03', kind: 'clock', text: 'Clock session · Daniel Alvarez · 7:12 AM to 8:05 AM · job 742', theirs: true },
      { ymd: '2026-09-04', kind: 'note', text: 'Nothing recorded on this day. No clock session, report or note. The paragraph that names it rests on the affiant’s word alone.', theirs: false },
    ]
    check.failed = ['the field reports (timed out)']
    open()
    const lines = document.querySelectorAll('[data-legal-record-line]')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.getAttribute('data-theirs')).toBe('yes')
    expect(lines[0]!.textContent).toContain('Sep 3')
    expect(screen.getByText(/Could not read the field reports \(timed out\)/)).toBeTruthy()
    expect(screen.getByText('What the record says about Sep 3')).toBeTruthy()
  })

  it('a statement being changed opens on its words; a signed one is read only with its door to the Timeline', async () => {
    const entry: LegalEntryRow = { id: 'st', matter_id: 'm', kind: 'statement', amount: null, body: 'Northline never called us back.', occurred_on: '2026-09-03', meta: { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', user_id: 'u-da', name: 'Daniel Alvarez', role: 'RMP' }, form: 'notary', incident_to: '2026-09-17', venue_county: 'Guadalupe', state: 'printed', prints: [{ at: '2026-10-28T19:14:00Z', by: 'u-g', face: 'whole', text: '' }] }, via_portal: false, created_by: 'u-g', acknowledged_at: null, created_at: '2026-10-28T15:00:00Z' }
    const { onSave } = open({ entry })
    expect(screen.getByRole('dialog', { name: 'Change the statement' })).toBeTruthy()
    expect(document.querySelector('[data-legal-affidavit-chip]')!.textContent).toBe('printed 1× · last Oct 28')
    expect((screen.getByLabelText('The statement') as HTMLTextAreaElement).value).toBe('Northline never called us back.')
    expect(document.querySelector('[data-legal-affidavit-prints]')!.textContent).toContain('the whole paper · Grace Lee')
    fireEvent.change(screen.getByLabelText('The statement'), { target: { value: 'Northline never called us back. On September 17 the room was empty.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the statement' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![1]).toBe('st')
    cleanup()
    const onShowTimeline = vi.fn()
    open({ entry: { ...entry, meta: { ...(entry.meta as object), state: 'signed', signed_on: '2026-10-29', document_id: 'd1' } }, onShowTimeline })
    expect(document.querySelector('[data-legal-affidavit-save]')).toBeNull()
    expect((screen.getByLabelText('The statement') as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.getByText(/The signed copy is filed/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'The statement on the Timeline ↗' }))
    expect(onShowTimeline).toHaveBeenCalled()
  })
})

describe('LegalAffidavitWindow · Print ▾ (punch list #220, v2.6211)', () => {
  it('Print saves a new draft first, opens the sheet on the whole paper, and the sheet’s Print notes the print on the new row', async () => {
    const onPrint = vi.fn(async (_id: string, _face: StatementFace, _text: string): Promise<boolean> => true)
    const { onSave, onClose } = open({ onPrint })
    const print = document.querySelector('[data-legal-affidavit-print]') as HTMLButtonElement
    expect(print.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Who swears it'), { target: { value: 'u-da' } })
    fireEvent.change(screen.getByLabelText('The statement'), { target: { value: 'Northline never called us back.' } })
    expect(print.disabled).toBe(false)
    fireEvent.click(print)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![1]).toBeNull()
    await waitFor(() => expect(document.querySelector('[data-legal-print-frame]')).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    const frame = document.querySelector('[data-legal-print-frame]') as HTMLIFrameElement
    Object.defineProperty(frame.contentWindow!, 'print', { value: vi.fn(), configurable: true })
    fireEvent.click(document.querySelector('[data-legal-print-press]')!)
    await waitFor(() => expect(onPrint).toHaveBeenCalledTimes(1))
    expect(onPrint.mock.calls[0]![0]).toBe('st-new')
    expect(onPrint.mock.calls[0]![1]).toBe('whole')
    expect(onPrint.mock.calls[0]![2]).toMatch(/^1\. My name is Daniel Alvarez\./)
    fireEvent.click(screen.getByRole('button', { name: 'Back to the statement' }))
    expect(screen.getByLabelText('The statement')).toBeTruthy()
  })
  it('▾ offers the three faces, and a row’s Print opens the window on the sheet', () => {
    const entry: LegalEntryRow = { id: 'st', matter_id: 'm', kind: 'statement', amount: null, body: 'x', occurred_on: '2026-09-03', meta: { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', user_id: 'u-da', name: 'Daniel Alvarez', role: 'RMP' }, form: 'notary', state: 'draft', prints: [] }, via_portal: false, created_by: 'u-g', acknowledged_at: null, created_at: '2026-10-28T15:00:00Z' }
    open({ entry })
    fireEvent.click(document.querySelector('[data-legal-affidavit-print-faces]')!)
    expect([...document.querySelectorAll('[data-legal-affidavit-faces-menu] [role="menuitem"]')].map((b) => b.textContent)).toEqual(['The whole paper', 'The statement alone', 'The signing page alone'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'The signing page alone' }))
    expect(document.querySelector('[data-legal-print-face="signing"]')!.getAttribute('aria-pressed')).toBe('true')
    cleanup()
    open({ entry, initialPrint: 'whole' })
    expect(document.querySelector('[data-legal-print-frame]')).toBeTruthy()
  })
})

describe('LegalAffidavitWindow · File the signed copy… (punch list #220, v2.6212)', () => {
  const entry: LegalEntryRow = { id: 'st', matter_id: 'm', kind: 'statement', amount: null, body: 'Northline never called us back.', occurred_on: '2026-09-03', meta: { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', user_id: 'u-da', name: 'Daniel Alvarez', role: 'RMP' }, form: 'notary', venue_county: 'Guadalupe', state: 'printed', prints: [{ at: '2026-10-28T19:14:00Z', by: 'u-g', face: 'whole', text: '' }] }, via_portal: false, created_by: 'u-g', acknowledged_at: null, created_at: '2026-10-28T15:00:00Z' }
  it('opens the filing panel from the footer and from a row, files through the desk, and closes', async () => {
    const onFile = vi.fn(async (_id: string, _file: File, _filing: StatementFilingDraft): Promise<boolean> => true)
    const { onClose } = open({ entry, onFile })
    fireEvent.click(document.querySelector('[data-legal-affidavit-file]')!)
    await waitFor(() => expect(document.querySelector('[data-legal-statement-file]')).toBeTruthy())
    fireEvent.drop(document.querySelector('[data-legal-statement-drop]')!, { dataTransfer: { files: [new File(['%PDF-1.4'], 'signed.pdf', { type: 'application/pdf' })] } })
    fireEvent.change(screen.getByLabelText('The day it was signed'), { target: { value: '2026-10-29' } })
    fireEvent.click(document.querySelector('[data-legal-statement-file-press]')!)
    await waitFor(() => expect(onFile).toHaveBeenCalledTimes(1))
    expect(onFile.mock.calls[0]![0]).toBe('st')
    expect(onFile.mock.calls[0]![2]).toMatchObject({ signedOn: '2026-10-29', asPrinted: true, incidentOn: '2026-09-03' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    cleanup()
    open({ entry, onFile, initialFile: true })
    expect(document.querySelector('[data-legal-statement-file]')).toBeTruthy()
    cleanup()
    // A signed statement offers no filing.
    open({ entry: { ...entry, meta: { ...(entry.meta as object), state: 'signed', signed_on: '2026-10-29', document_id: 'd1' } }, onFile, initialFile: true })
    expect(document.querySelector('[data-legal-statement-file]')).toBeNull()
    expect(document.querySelector('[data-legal-affidavit-file]')).toBeNull()
  })
})

describe('LegalAffidavitWindow · the business-records preset (punch list #220, v2.6213)', () => {
  it('Start from the records form writes the title, the role and the rule’s paragraphs from the picks, and stops once edited by hand', () => {
    open({ documents: [{ id: 'd1', title: 'Final invoice 891' }, { id: 'd2', title: 'The clock for job 891' }] })
    fireEvent.click(document.querySelector('[data-legal-affidavit-preset="records"]')!)
    fireEvent.change(screen.getByLabelText('Who swears it'), { target: { value: 'u-g' } })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Business Records Affidavit of Grace Lee')
    expect((screen.getByLabelText('Their role, one line') as HTMLInputElement).value).toBe('custodian of records for Click Plumbing and Electrical')
    const body = screen.getByLabelText('The statement') as HTMLTextAreaElement
    expect(body.value.split('\n')[0]).toBe('I am the custodian of records of Click Plumbing and Electrical and am familiar with the manner in which its records are created and maintained by virtue of my duties and responsibilities.')
    expect(body.value).toContain('Attached are ____ pages of records.')
    fireEvent.click(document.querySelector('[data-legal-affidavit-record="d1"]')!)
    fireEvent.click(document.querySelector('[data-legal-affidavit-record="d2"]')!)
    fireEvent.change(screen.getByLabelText('Pages of records'), { target: { value: '14' } })
    expect(body.value).toContain('Attached are 14 pages of records.')
    expect(body.value).toContain('The records attached are: Final invoice 891; The clock for job 891.')
    fireEvent.change(screen.getByLabelText('The affiant’s standing'), { target: { value: 'owner' } })
    expect(body.value.startsWith('I am an owner of Click Plumbing and Electrical')).toBe(true)
    expect((screen.getByLabelText('Their role, one line') as HTMLInputElement).value).toBe('an owner of Click Plumbing and Electrical')
    // The office edits a paragraph: the picks stop rewriting.
    fireEvent.change(body, { target: { value: body.value + '\nThe clock is kept by the app.' } })
    fireEvent.click(document.querySelector('[data-legal-affidavit-record="d1"]')!)
    expect(body.value).toContain('The clock is kept by the app.')
    expect(document.querySelector('[data-legal-affidavit-records]')!.textContent).toContain('The paragraphs were edited by hand.')
    expect(document.querySelector('[data-legal-affidavit-records]')!.textContent).toContain('at least 14 days before trial')
    // Back to a plain statement: the edited paragraphs stay, the title follows the affiant again.
    fireEvent.click(document.querySelector('[data-legal-affidavit-preset="statement"]')!)
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Affidavit of Grace Lee')
    expect(document.querySelector('[data-legal-affidavit-records]')).toBeNull()
  })
  it('a statement being changed offers no Start from', () => {
    const entry: LegalEntryRow = { id: 'st', matter_id: 'm', kind: 'statement', amount: null, body: 'x', occurred_on: '2026-09-03', meta: { title: 'T', affiant: { kind: 'team', name: 'Daniel Alvarez' }, form: 'notary', state: 'draft', prints: [] }, via_portal: false, created_by: 'u-g', acknowledged_at: null, created_at: '2026-10-28T15:00:00Z' }
    open({ entry })
    expect(document.querySelector('[data-legal-affidavit-preset="records"]')).toBeNull()
  })
})

describe('LegalAffidavitWindow · the affiant’s full name (v2.6238)', () => {
  it('a picked team member’s roster name is prefilled and editable, and the paper, the title and the problem words follow it', () => {
    open()
    expect(screen.queryByLabelText('Their full name')).toBeNull()
    fireEvent.change(screen.getByLabelText('Who swears it'), { target: { value: 'u-da' } })
    const name = screen.getByLabelText('Their full name') as HTMLInputElement
    expect(name.value).toBe('Daniel Alvarez')
    expect(document.querySelector('[data-legal-affidavit-window]')!.textContent).toContain('Prefilled from the roster. Type it as it reads on their ID. The notary checks it.')
    // The RMP's role line asks for the license number until it is edited.
    expect(document.querySelector('[data-legal-affidavit-window]')!.textContent).toContain('Add the license number, then edit as you like.')
    fireEvent.change(name, { target: { value: 'Daniel Ruiz Alvarez' } })
    expect(document.querySelector('[data-legal-affidavit-opener]')!.textContent).toContain('My name is Daniel Ruiz Alvarez.')
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Affidavit of Daniel Ruiz Alvarez')
    fireEvent.change(name, { target: { value: ' ' } })
    fireEvent.change(screen.getByLabelText('The statement'), { target: { value: 'x' } })
    expect((document.querySelector('[data-legal-affidavit-save]') as HTMLButtonElement).title).toBe('Type their full name, as it reads on their ID.')
    // With no notary, the help drops the notary.
    fireEvent.click(document.querySelector('[data-legal-affidavit-form="declaration"]')!)
    expect(document.querySelector('[data-legal-affidavit-window]')!.textContent).not.toContain('The notary checks it.')
  })
})
