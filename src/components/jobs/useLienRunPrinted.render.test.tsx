// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LienAffidavitFields } from '../../lib/jobsDocuments/lienAffidavitFieldsType'
import type { LienNoticeFields } from '../../lib/jobsDocuments/lienNoticeFieldsType'
import type { LienGetItRight, LienRunLine } from '../../lib/jobs/lienGetItRight'
import { lienAffidavitPrintFields, lienPrintKey, type LienPrintFact } from '../../lib/jobs/lienPrintSworn'

const loadMock = vi.hoisted(() => vi.fn())
vi.mock('../../lib/jobs/lienPrintsIo', () => ({ loadLienNewestPrints: (jobIds: readonly string[]) => loadMock(jobIds) }))
const standsMock = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
vi.mock('../../lib/jobs/lienPrintStandsIo', () => ({ readLienPrintStands: () => standsMock.read(), writeLienPrintStands: (w: unknown) => standsMock.write(w) }))

import { useLienRunPrinted, type LienRunPrintedHookInput } from './useLienRunPrinted'

const AF = { county: 'Marlow', claimantPersonName: 'ZZ Signer', claimantCompany: 'ZZ Plumbing LLC', claimantAddress: '1 Shop Rd', legalDescription: 'CB 1 BLK B LOT 7', propertyAddress: '12 Sample Rd', contractedWithName: 'ZZ Builder', workDescription: 'Plumbing', workStart: '', workEnd: '', ownerName: 'ZZ Owner', ownerAddress: '4 Owner Ct', originalContractorName: 'ZZ Builder', originalContractorAddress: '9 Yard St', contractAmount: '2000.00', paidAmount: '0.00', unpaidAmount: '2000.00', includeNoticesSworn: true } as LienAffidavitFields
const NF = { noticeDate: '2026-11-10', projectDescription: 'ZZ Shop, 12 Sample Rd', claimantName: 'ZZ Plumbing', laborMaterialsType: 'Plumbing', originalContractorName: 'ZZ Builder', contractedWithIfDifferent: '', claimAmount: '500.00', contactPerson: 'ZZ Office', claimantAddress: '1 Shop Rd' } as LienNoticeFields

function line(over: Partial<LienRunLine>): LienRunLine {
  return { key: `${over.kind ?? 'notice'}:${over.jobId ?? 'j'}`, kind: 'notice', jobId: 'j', label: '1001', title: 'ZZ Sample Shop', stage: 'Approved · to print', stageKey: 'to_print', detail: '', dueYmd: '2026-11-16', amount: 100, atRisk: false, standing: 'right', rowKey: null, press: null, leftOut: null, rightNow: false, ...over } as LienRunLine
}
function runOf(right: LienRunLine[]): LienGetItRight {
  return { day: '2026-11-16', dayWords: 'tomorrow', asked: [], settle: [], right, leftOut: [], counts: { papers: right.length, settle: 0, right: right.length, leftOut: 0, toPrint: 0, toMail: 0, toFile: 0 }, totals: { run: 0, waits: 0, right: 0 }, step: 2, steps: [] as never, rightParts: '' }
}
/** One affidavit ready to file on job-1, and one printed notice on j1. */
const RUN = runOf([line({ kind: 'affidavit', jobId: 'job-1', stageKey: 'ready', stage: 'Ready to file' }), line({ kind: 'notice', jobId: 'j1', stageKey: 'in_mail', stage: 'Approved · to mail' })])

const fact = (kind: 'notice' | 'affidavit', jobId: string, fields: Record<string, string> | null): [string, LienPrintFact] => [lienPrintKey(kind, jobId), { kind, copyId: 'c1', printedAt: '2026-11-25T16:02:00Z', printedBy: 'ZZ Rosa', fields, jobIds: [jobId], itemIds: [] }]
const noticesFor = vi.fn(() => [{ jobId: 'j1', fields: NF, printedAt: '2026-11-25T16:02:00Z', printedBy: 'ZZ Rosa', moneyNow: { claimAmount: '500.00' } }])
const affidavitsFor = vi.fn((ids: ReadonlySet<string>) => [{ jobId: 'job-1', fields: AF }].filter((p) => ids.has(p.jobId)))
const input = (over: Partial<LienRunPrintedHookInput> = {}): LienRunPrintedHookInput => ({ run: RUN, open: true, noticesFor, affidavitsFor, ...over })
const mount = (over: Partial<LienRunPrintedHookInput> = {}) => renderHook((p: LienRunPrintedHookInput) => useLienRunPrinted(p), { initialProps: input(over) })

beforeEach(() => {
  loadMock.mockReset().mockResolvedValue({ prints: new Map(), whole: true })
  standsMock.read.mockReset().mockResolvedValue([])
  standsMock.write.mockReset().mockResolvedValue({ changed: true })
  noticesFor.mockClear()
  affidavitsFor.mockClear()
})
afterEach(cleanup)

describe('useLienRunPrinted', () => {
  it('reads nothing while the checklist is shut, and has no state with no run', () => {
    const shut = mount({ open: false })
    expect(loadMock).not.toHaveBeenCalled()
    expect(noticesFor).not.toHaveBeenCalled()
    expect(shut.result.current).toMatchObject({ reading: false, failed: false, changed: [], unread: 0 })
    expect(mount({ run: null }).result.current).toBeNull()
  })

  it('reads the run’s jobs once, and an affidavit that printed the same is not to print again', async () => {
    loadMock.mockResolvedValue({ prints: new Map([fact('affidavit', 'job-1', lienAffidavitPrintFields(AF))]), whole: true })
    const view = mount()
    expect(view.result.current!.reading).toBe(true)
    // While it reads nothing counts as printed.
    expect(view.result.current!.printedSame.size).toBe(0)
    await waitFor(() => expect(view.result.current!.reading).toBe(false))
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(loadMock.mock.calls[0]![0]).toEqual(['j1', 'job-1'])
    expect([...view.result.current!.printedSame]).toEqual(['job-1'])
    expect(view.result.current!.changed).toEqual([])
    // The desk builds the run anew on every render: the same jobs are not read again.
    view.rerender(input({ run: runOf([...RUN.right]) }))
    expect(loadMock).toHaveBeenCalledTimes(1)
  })

  it('names a printed paper that would say another thing today', async () => {
    loadMock.mockResolvedValue({ prints: new Map([fact('affidavit', 'job-1', lienAffidavitPrintFields({ ...AF, unpaidAmount: '2300.00' }))]), whole: true })
    const view = mount()
    await waitFor(() => expect(view.result.current!.changed).toHaveLength(1))
    expect(view.result.current!.changed[0]).toMatchObject({ key: 'affidavit:job-1', printedBy: 'ZZ Rosa' })
    expect(view.result.current!.printedSame.size).toBe(0)
  })

  it('a failed read says so, counts nothing as printed, and reads again when asked', async () => {
    loadMock.mockResolvedValueOnce(null)
    const view = mount()
    await waitFor(() => expect(view.result.current!.failed).toBe(true))
    expect(view.result.current!.printedSame.size).toBe(0)
    loadMock.mockResolvedValue({ prints: new Map([fact('affidavit', 'job-1', lienAffidavitPrintFields(AF))]), whole: true })
    act(() => view.result.current!.reload())
    await waitFor(() => expect(view.result.current!.failed).toBe(false))
    await waitFor(() => expect([...view.result.current!.printedSame]).toEqual(['job-1']))
    expect(loadMock).toHaveBeenCalledTimes(2)
  })

  it('after a print it reads again and keeps the last answer on screen meanwhile', async () => {
    loadMock.mockResolvedValue({ prints: new Map([fact('affidavit', 'job-1', lienAffidavitPrintFields(AF))]), whole: true })
    const view = mount()
    await waitFor(() => expect(view.result.current!.reading).toBe(false))
    let release: (v: unknown) => void = () => undefined
    loadMock.mockReturnValue(new Promise((r) => (release = r)))
    act(() => view.result.current!.reload())
    expect(view.result.current!.reading).toBe(true)
    expect([...view.result.current!.printedSame]).toEqual(['job-1'])
    await act(async () => release({ prints: new Map(), whole: true }))
    await waitFor(() => expect(view.result.current!.reading).toBe(false))
    expect(view.result.current!.printedSame.size).toBe(0)
  })

  it('It stands is kept under the paper’s own difference, then the paper is no longer asked about', async () => {
    loadMock.mockResolvedValue({ prints: new Map([fact('affidavit', 'job-1', lienAffidavitPrintFields({ ...AF, unpaidAmount: '2300.00' }))]), whole: true })
    const view = mount()
    await waitFor(() => expect(view.result.current!.changed).toHaveLength(1))
    const paper = view.result.current!.changed[0]!
    // The next read finds the row the press wrote.
    standsMock.read.mockResolvedValue([{ id: 's1', jobId: 'job-1', paper: 'affidavit', changeKey: paper.changeKey, changes: [], sentDocumentId: 'c1', stoodBy: 'u1', stoodAt: '2026-11-25T20:00:00Z' }])
    await act(async () => view.result.current!.markStands(paper))
    expect(standsMock.write).toHaveBeenCalledWith({ jobId: 'job-1', paper: 'affidavit', stands: true, changeKey: paper.changeKey, changes: [{ key: 'unpaidAmount', label: 'The amount unpaid', printed: '$2,300.00', now: '$2,000.00' }], sentDocumentId: 'c1' })
    await waitFor(() => expect(view.result.current!.stood).toHaveLength(1))
    expect(view.result.current!.changed).toEqual([])
    expect([...view.result.current!.stoodAffidavits]).toEqual(['job-1'])
    // Taken back, it asks again.
    standsMock.read.mockResolvedValue([])
    await act(async () => view.result.current!.takeBackStands(paper))
    expect(standsMock.write).toHaveBeenLastCalledWith({ jobId: 'job-1', paper: 'affidavit', stands: false })
    await waitFor(() => expect(view.result.current!.changed).toHaveLength(1))
    expect(view.result.current!.stood).toEqual([])
  })

  it('a refused answer rejects with the reason and reads nothing again, and answers that cannot be read are none', async () => {
    standsMock.read.mockResolvedValue(null)
    loadMock.mockResolvedValue({ prints: new Map([fact('affidavit', 'job-1', lienAffidavitPrintFields({ ...AF, unpaidAmount: '2300.00' }))]), whole: true })
    const view = mount()
    await waitFor(() => expect(view.result.current!.changed).toHaveLength(1))
    expect(view.result.current!.failed).toBe(false)
    standsMock.write.mockRejectedValue(new Error('Not authorized to say a lien paper stands as printed'))
    await expect(view.result.current!.markStands(view.result.current!.changed[0]!)).rejects.toThrow('Not authorized')
    expect(loadMock).toHaveBeenCalledTimes(1)
  })

  it('says an instant as a day and a time, and nothing for no instant', () => {
    const view = mount({ open: false })
    expect(view.result.current!.whenWords('')).toBe('')
    expect(view.result.current!.whenWords('not a day')).toBe('')
    expect(view.result.current!.whenWords('2026-11-25T16:02:00Z')).toMatch(/^Nov 2[45], \d{1,2}:\d{2} (AM|PM)$/)
  })
})
