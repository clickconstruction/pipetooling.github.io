// @vitest-environment jsdom
/**
 * The record on the Documents read-out, over a fake io (punch list #237, PR 3): a filed stage's chip and record line with
 * Open in Drive, the versions line, Amend with its reason through the io, and Print the checklists opening the paper.
 * Made-up questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { ChecklistRecord } from '../../lib/jobs/stageChecklistRecord'
import type { JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsChecklists } from './JobDocumentsChecklists'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'assistant', profileName: 'Jo Sample', user: { id: 'u-jo', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})
const printed: string[] = []
const filed: unknown[] = []
vi.mock('../../lib/sent/sentCopiesIo', () => ({ printAndFile: (html: string, filing: unknown) => { printed.push(html); filed.push(filing); return true } }))

const JOB = { id: 'job-zz-1', hcp_number: '1042', click_number: '', job_name: 'Harbor Lane Offices', customer_name: 'Pruett & Vance', job_address: '12 Harbor Lane' }
const STAGES: JobStageRef[] = [
  { fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 },
  { fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 },
]
const Q: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Is the water test on?', asksPhoto: false },
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false },
]
const answer = (id: string, fixtureId: string, questionId: string): JobAnswer => ({ id, fixtureId, questionId, pick: 'yes', note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', storagePath: null, reportPhotoId: null, signature: null, voided: null })
const record = (over: Partial<ChecklistRecord> = {}): ChecklistRecord => ({
  id: 'r1',
  jobId: JOB.id,
  fixtureId: 'f3',
  recordNo: 1,
  version: 1,
  recordId: 'CL-1042-1',
  stageName: 'Trim Set',
  kind: 'trim_set',
  state: 'filed',
  filedAt: '2026-11-01T15:14:00.000Z',
  filedBy: 'Luis Ortega',
  rows: [{ questionId: 't1', scope: 'company', words: 'Did the final water test hold?', sheet: null, why: null, addedBy: null, pick: 'yes', note: '', by: 'Luis Ortega', at: '2026-11-01T15:14:00.000Z', signature: null, photo: null }],
  skipped: [],
  answerCount: 1,
  signedCount: 0,
  noCount: 0,
  amendedAt: null,
  amendedBy: '',
  amendWhy: null,
  pdf: { fileName: 'CL-1042-1 Trim Set checklist.pdf', driveFileId: null, filedAt: null, failWhy: null },
  ...over,
})

function fakeIo(records: ChecklistRecord[], over: Partial<StageChecklistSheetIo> = {}): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...Q]),
    answers: vi.fn(async () => [answer('a1', 'f3', 't1')]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => [...records]),
    amend: vi.fn(async (id, why) => ({ ...records.find((r) => r.id === id)!, state: 'amended' as const, amendedAt: '2026-11-05T22:10:00.000Z', amendedBy: 'Jo Sample', amendWhy: why })),
    addItem: vi.fn(async () => { throw new Error('not here') }),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => false),
    skip: vi.fn(async () => { throw new Error('not here') }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => { throw new Error('not here') }),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  printed.length = 0
  filed.length = 0
})

const stageRows = () => screen.getAllByTestId('job-documents-checklist-stage')

describe('JobDocumentsChecklists with records', () => {
  it('a filed stage wears Filed with its record line and Open in Drive once the PDF is there; a second version lists every version', async () => {
    const v1 = record({ state: 'amended', amendedAt: '2026-11-05T22:10:00.000Z', amendedBy: 'Jo Sample', amendWhy: 'the roofer came back' })
    const v2 = record({ id: 'r2', recordNo: 2, version: 2, recordId: 'CL-1042-2', filedAt: '2026-11-06T16:00:00.000Z', pdf: { fileName: 'CL-1042-2 Trim Set checklist.pdf', driveFileId: 'drive-9', filedAt: '2026-11-06T16:05:00.000Z', failWhy: null } })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo([v1, v2])} />)
    await screen.findByTestId('job-documents-checklists-summary')
    const [rough, trim] = stageRows()
    expect(rough!.querySelector('[data-checklist-stage-chip]')!.getAttribute('data-checklist-stage-chip')).toBe('open')
    expect(trim!.querySelector('[data-checklist-stage-chip]')!.textContent).toBe('Filed · CL-1042-2')
    expect(within(trim!).getByTestId('job-documents-checklist-record').textContent).toContain("Record CL-1042-2 · v2 · Nov 6 · 10:00 am · 1 answer · PDF in the job's Drive folder")
    expect(within(trim!).getByRole('link', { name: 'Open in Drive ↗' }).getAttribute('href')).toBe('https://drive.google.com/file/d/drive-9/view')
    expect(within(trim!).getByTestId('job-documents-checklist-versions').textContent).toBe('Versions: CL-1042-1 v1 (amended by Jo Sample · Nov 5 · 4:10 pm: the roofer came back) · CL-1042-2 v2')
  })

  it('Amend asks why, amends through the io, and the stage reads Amending', async () => {
    const io = fakeIo([record()])
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await screen.findByTestId('job-documents-checklists-summary')
    const trim = stageRows()[1]!
    expect(within(trim).getByTestId('job-documents-checklist-record').textContent).toContain("PDF on its way to the job's Drive folder")
    fireEvent.click(within(trim).getByRole('button', { name: 'Amend: Trim Set' }))
    fireEvent.click(within(trim).getByRole('button', { name: 'Amend as a new version' }))
    expect(await within(trim).findByText('Say why the record is amended.')).toBeTruthy()
    expect(io.amend).not.toHaveBeenCalled()
    fireEvent.change(within(trim).getByLabelText('Why the record is amended'), { target: { value: 'the roofer came back' } })
    fireEvent.click(within(trim).getByRole('button', { name: 'Amend as a new version' }))
    await waitFor(() => expect(io.amend).toHaveBeenCalledWith('r1', 'the roofer came back'))
    expect(await screen.findByText('Amended. Trim Set is open again; the next completion files v2.')).toBeTruthy()
    await waitFor(() => expect(trim.querySelector('[data-checklist-stage-chip]')!.textContent).toBe('Amending v1 · 1 of 1'))
    expect(within(trim).queryByRole('button', { name: 'Amend: Trim Set' })).toBeNull()
  })

  it('Print the checklists draws every stage on the paper, the filed one from its record and the open one as it stands, and files a copy under Sent from this job', async () => {
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo([record()])} />)
    await screen.findByTestId('job-documents-checklists-summary')
    fireEvent.click(screen.getByTestId('job-documents-checklists-print'))
    expect(printed).toHaveLength(1)
    const html = printed[0]!
    expect(html).toContain('Job 1042 · Harbor Lane Offices · Pruett &amp; Vance · 12 Harbor Lane')
    expect(html).toContain('Rough In <span class="standing">Open · 0 of 1 answered</span>')
    expect(html).toContain('1. Is the water test on?')
    expect(html).toContain('Trim Set <span class="standing">Record CL-1042-1 · v1')
    expect(html).toContain('Yes · Luis Ortega · Nov 1 · 9:14 am')
    expect(html).toContain('Trim Set now reads ready on the Pipeline.')
    expect(filed).toEqual([{ kind: 'stage_checklists', title: 'Stage checklists · Job 1042 · Harbor Lane Offices', jobIds: ['job-zz-1'], source: { table: 'jobs_ledger', id: 'job-zz-1' } }])
  })
})
