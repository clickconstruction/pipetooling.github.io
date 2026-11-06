// @vitest-environment jsdom
/**
 * The record on the phone sheet, over a fake io (punch list #237, PR 3): a stage whose latest record is filed reads as
 * paper with the record's header, its rows from the snapshot, the mark where it was signed and the foot; one amended reads
 * open again with *Amending v1*; and a record that appears with a press says *Filed as record … with the last answer*.
 * Made-up questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { ChecklistRecord } from '../../lib/jobs/stageChecklistRecord'
import type { JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from './JobStageChecklistStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'helpers', profileName: 'Luis Ortega', user: { id: 'u-luis', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = 'job-zz-1'
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const Q: StageChecklistQuestion[] = [
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false },
]
const answer = (id: string, questionId: string, pick: 'yes' | 'no' | 'not_here'): JobAnswer => ({ id, fixtureId: 'f3', questionId, pick, note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', storagePath: null, reportPhotoId: null, signature: null, voided: null })
const RECORD: ChecklistRecord = {
  id: 'r1',
  jobId: JOB,
  fixtureId: 'f3',
  recordNo: 1,
  version: 1,
  recordId: 'CL-1042-1',
  stageName: 'Trim Set',
  kind: 'trim_set',
  state: 'filed',
  filedAt: '2026-11-01T15:20:00.000Z',
  filedBy: 'Luis Ortega',
  rows: [
    { questionId: 't1', scope: 'company', words: 'Did the final water test hold?', sheet: null, why: null, addedBy: null, pick: 'yes', note: '', by: 'Luis Ortega', at: '2026-11-01T15:14:00.000Z', signature: { mode: 'type', printedName: 'Luis Ortega', signedAt: '2026-11-01T15:14:00.000Z', storagePath: null }, photo: null },
    { questionId: 't2', scope: 'company', words: 'Are the cleanouts capped?', sheet: null, why: null, addedBy: null, pick: 'no', note: 'Roofer not here until Mon', by: 'Luis Ortega', at: '2026-11-01T15:20:00.000Z', signature: null, photo: null },
  ],
  skipped: [{ words: 'Is the grease interceptor set?', by: 'Pat Sample', why: 'the owner took it out' }],
  answerCount: 2,
  signedCount: 1,
  noCount: 1,
  amendedAt: null,
  amendedBy: '',
  amendWhy: null,
  pdf: { fileName: 'CL-1042-1 Trim Set checklist.pdf', driveFileId: 'drive-9', filedAt: '2026-11-01T15:25:00.000Z', failWhy: null },
}

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, answers: JobAnswer[] = [], records: ChecklistRecord[] = []): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...Q]),
    answers: vi.fn(async () => [...answers]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => [...records]),
    amend: vi.fn(async () => { throw new Error('not here') }),
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
})

describe('the filed paper', () => {
  it('a filed stage reads as paper: the header, the rows from the snapshot, the mark, the skipped line, the foot, and nothing to press', async () => {
    const io = fakeIo({}, [answer('a1', 't1', 'yes'), answer('a2', 't2', 'no')], [RECORD])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Trim Set checklist: Checklist filled' }))
    const paper = await waitFor(() => document.querySelector('[data-checklist-paper="CL-1042-1"]') as HTMLElement)
    expect(screen.getByText('Trim Set · filed')).toBeTruthy()
    expect(paper.querySelector('[data-checklist-filed-header]')!.textContent).toContain("Record CL-1042-1 · v1 · Nov 1 · 9:20 am · 2 answers, 1 signed · 1 No · PDF in the job's Drive folder")
    expect(within(paper).getByRole('link', { name: 'Open in Drive ↗' }).getAttribute('href')).toBe('https://drive.google.com/file/d/drive-9/view')
    const rows = paper.querySelectorAll('[data-checklist-paper-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('1. Did the final water test hold?')
    expect(rows[0]!.textContent).toContain('Yes · Luis Ortega · Nov 1 · 9:14 am')
    expect(within(rows[0] as HTMLElement).getByLabelText('Signed by Luis Ortega')).toBeTruthy()
    expect(rows[1]!.textContent).toContain('No · Luis Ortega · Nov 1 · 9:20 am')
    expect(rows[1]!.textContent).toContain('“Roofer not here until Mon”')
    expect(paper.textContent).toContain('Not on this job: Is the grease interceptor set (the owner took it out, Pat Sample)')
    expect(paper.querySelector('[data-checklist-filed-words]')!.textContent).toBe('Trim Set now reads ready on the Pipeline. One check reads No; the office acts on that.')
    // Nothing to press on the paper; the first line is not the just-filed line, since the record was there when the sheet opened.
    expect(within(paper).queryByRole('button')).toBeNull()
    expect(paper.querySelector('[data-checklist-filed-now]')).toBeNull()
    expect(screen.getByText('Filed. Nothing here changes. The office can amend it as a new version.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
  })

  it('an amended stage reads open again and says which version it is amending', async () => {
    const amended: ChecklistRecord = { ...RECORD, state: 'amended', amendedAt: '2026-11-05T22:10:00.000Z', amendedBy: 'Jo Sample', amendWhy: 'the roofer came back' }
    const io = fakeIo({}, [answer('a1', 't1', 'yes')], [amended])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Trim Set checklist: 1 of 2 answered, not ready' }))
    await waitFor(() => expect(document.querySelector('[data-checklist-amending="1"]')).toBeTruthy())
    expect(screen.getByText('Amending v1. The filed version stays; the next completion files v2.')).toBeTruthy()
    expect(document.querySelector('[data-checklist-paper]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy()
  })

  it('the record that appears with the last answer turns the sheet to paper with the just-filed line', async () => {
    let filed = false
    const io = fakeIo(
      {
        pick: vi.fn(async (key, pick) => {
          filed = true
          return answer('a2', key.questionId, pick)
        }),
        records: vi.fn(async () => (filed ? [RECORD] : [])),
      },
      [answer('a1', 't1', 'yes')],
    )
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Trim Set checklist: 1 of 2 answered, not ready' }))
    fireEvent.click(await screen.findByRole('button', { name: 'No' }))
    await waitFor(() => expect(io.records).toHaveBeenCalledTimes(2))
    const paper = await waitFor(() => document.querySelector('[data-checklist-paper="CL-1042-1"]') as HTMLElement)
    expect(paper.querySelector('[data-checklist-filed-now]')!.textContent).toBe('Filed as record CL-1042-1 with the last answer.')
  })
})
