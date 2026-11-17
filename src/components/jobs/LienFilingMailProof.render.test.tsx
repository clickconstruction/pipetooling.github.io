// @vitest-environment jsdom
/**
 * What went out on a recorded filing: every mailed file with its own link, each envelope's number and receipt, the
 * count, the Next line, and the two writes (a receipt taken off, one more mailed file).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingMailProof from './LienFilingMailProof'

vi.mock('../../lib/materials/photoShrink', () => ({ shrinkPhoto: async (file: File) => ({ blob: file, shrunk: false }) }))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({ putJobFolderFile: vi.fn() }))
vi.mock('../../lib/jobs/lienReceiptReadIo', () => ({ readTrackingFromPhoto: async () => '' }))

afterEach(cleanup)

const copies = [
  { url: 'https://drive.example/file/1', driveFileId: 'd1', name: 'Lien notice as mailed · 1042 · 2026-11-17.pdf', at: '', by: null },
  { url: 'https://drive.example/file/2', driveFileId: 'd2', name: 'Lien notice as mailed · 1042 · 2026-11-17 · 2.pdf', at: '', by: null },
]
const filing = {
  id: 'f1',
  kind: 'notice_53_056',
  served_at: null,
  filed_at: null,
  document_url: 'https://drive.example/file/1',
  document_note: 'What was mailed: a, b',
  sends: [
    { recipient: 'owner', method: 'certified_mail', tracking: '9507 01', sent_on: '2026-11-17', receipt_url: 'https://drive.example/r-owner' },
    { recipient: 'original_contractor', method: 'certified_mail', tracking: '9507 02', sent_on: '2026-11-17' },
  ],
}
const base = { filing: filing as never, item: { itemId: 'i1', copies }, jobId: 'j1', jobNumber: '1042', userId: 'u1', todayYmd: '2026-11-18', onChanged: vi.fn() }

describe('LienFilingMailProof', () => {
  it('links every mailed file, shows each envelope with its receipt, counts the proof and names what is next', () => {
    renderWithProviders(<LienFilingMailProof {...base} canEdit />)
    const block = document.querySelector('[data-lien-mail-proof="notice"]') as HTMLElement
    expect(within(block).getByText('What went out')).toBeTruthy()
    expect(block.querySelector('[data-lien-mail-proof-chip]')?.textContent).toBe('Mail proof: 2 of 3 on file')
    const links = within(block.querySelector('[data-lien-mail-proof-files]') as HTMLElement).getAllByRole('link') as HTMLAnchorElement[]
    expect(links.map((a) => [a.textContent, a.href])).toEqual([
      ['Lien notice as mailed · 1042 · 2026-11-17.pdf ›', 'https://drive.example/file/1'],
      ['Lien notice as mailed · 1042 · 2026-11-17 · 2.pdf ›', 'https://drive.example/file/2'],
    ])
    const owner = block.querySelector('[data-lien-mail-proof-envelope="owner"]') as HTMLElement
    expect(owner.textContent).toContain('Owner of record')
    expect(owner.textContent).toContain('Certified mail 9507 01')
    expect((within(owner).getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe('https://drive.example/r-owner')
    const gc = block.querySelector('[data-lien-mail-proof-envelope="original_contractor"]') as HTMLElement
    expect(gc.textContent).toContain('No receipt yet')
    expect(within(gc).getByRole('button', { name: 'Add the receipt' })).toBeTruthy()
    expect(block.querySelector('[data-lien-mail-proof-next]')?.textContent).toBe('Next: Add the original contractor’s receipt.')
  })

  it('reads only, with no press, for someone who cannot edit', () => {
    renderWithProviders(<LienFilingMailProof {...base} canEdit={false} />)
    const block = document.querySelector('[data-lien-mail-proof]') as HTMLElement
    expect(within(block).queryAllByRole('button')).toHaveLength(0)
    expect((within(block).getByRole('link', { name: 'Owner of record: open the receipt' }) as HTMLAnchorElement).href).toBe('https://drive.example/r-owner')
    expect(block.textContent).toContain('No receipt yet')
  })

  it('takes a receipt off after asking, writes it at once and reads again', async () => {
    const onChanged = vi.fn()
    const keep = vi.fn(async () => [filing.sends[0]!, filing.sends[1]!].map((s) => ({ recipient: s.recipient, method: s.method, tracking: s.tracking, sent_on: s.sent_on })))
    renderWithProviders(<LienFilingMailProof {...base} onChanged={onChanged} canEdit keep={keep as never} />)
    const owner = () => document.querySelector('[data-lien-mail-proof-envelope="owner"]') as HTMLElement
    fireEvent.click(within(owner()).getByRole('button', { name: 'Take off' }))
    fireEvent.click(within(owner()).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(keep).toHaveBeenCalledWith({ filingId: 'f1', recipient: 'owner', proof: { receiptUrl: '' } }))
    await waitFor(() => expect(owner().textContent).toContain('No receipt yet'))
    expect(document.querySelector('[data-lien-mail-proof-chip]')?.textContent).toBe('Mail proof: 1 of 3 on file')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('adds one more mailed file to the recorded notice and lists it at once', async () => {
    const addCopy = vi.fn(async () => ({ name: 'Lien notice as mailed · 1042 · 2026-11-18 · 3.pdf', url: 'https://drive.example/file/3' }))
    renderWithProviders(<LienFilingMailProof {...base} canEdit addCopy={addCopy as never} />)
    const file = new File([new Uint8Array([1, 2])], 'scan.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Add another'), { target: { files: [file] } })
    await waitFor(() => expect(addCopy).toHaveBeenCalledWith({ filingId: 'f1', itemId: 'i1', jobId: 'j1', jobNumber: '1042', file, todayYmd: '2026-11-18', userId: 'u1', paper: 'notice', hasDocument: true }))
    await waitFor(() => expect(within(document.querySelector('[data-lien-mail-proof-files]') as HTMLElement).getAllByRole('link')).toHaveLength(3))
  })

  it('offers no file press on an affidavit, whose scan has its own, and none for a second file with nowhere to keep it', () => {
    renderWithProviders(<LienFilingMailProof {...base} filing={{ ...filing, kind: 'affidavit', served_at: null, document_note: 'the clerk’s stamped affidavit, scanned', sends: [] } as never} item={null} hasContractor canEdit />)
    expect(document.querySelector('[data-lien-mail-proof="affidavit"] [data-lien-mail-proof-add]')).toBeNull()
    expect(document.querySelector('[data-lien-mail-proof-files]')?.textContent).toContain('Stamped by the clerk')
    cleanup()
    renderWithProviders(<LienFilingMailProof {...base} item={null} canEdit />)
    expect(document.querySelector('[data-lien-mail-proof-add]')).toBeNull()
  })
})
