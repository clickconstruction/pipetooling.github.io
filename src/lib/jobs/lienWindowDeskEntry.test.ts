import { describe, expect, it } from 'vitest'
import { lienWindowDeskEntryFor, type LienWindowDeskLists } from './lienWindowDeskEntry'
import { lienWindowDeskAffidavit, lienWindowDeskNotice } from './lienTimelineDesk'

type NoticeEntry = LienWindowDeskLists['queue']['entries'][number]
type AffidavitEntry = LienWindowDeskLists['affidavits']['entries'][number]

// Made-up desk rows: only what the pick reads.
const notice = (jobId: string, pile: string, holdUntil: string | null = null) => ({ jobId, pile, item: holdUntil ? { hold_until: holdUntil } : null }) as unknown as NoticeEntry
const affidavit = (jobId: string, pile: string, gates: Array<{ key: string; ok: boolean }> = []) => ({ jobId, pile, gates, item: null }) as unknown as AffidavitEntry

const desk: LienWindowDeskLists = {
  queue: { entries: [notice('job-b', 'to_draft'), notice('job-a', 'awaiting'), notice('job-c', 'held', '2026-12-01')] },
  affidavits: { entries: [affidavit('job-a', 'to_draft'), affidavit('job-d', 'needs_property', [{ key: 'owner', ok: false }, { key: 'legal', ok: true }])] },
}

describe('lienWindowDeskEntryFor — one job’s place on the Lien desk, for the Lien window (punch list #335)', () => {
  it('picks the job’s own two entries, never a neighbour’s', () => {
    expect(lienWindowDeskEntryFor(desk, 'job-a')).toEqual({ deskNotice: { state: 'awaiting', holdUntil: null }, deskAffidavit: { state: 'to_draft', missing: [], holdUntil: null } })
    expect(lienWindowDeskEntryFor(desk, 'job-b')).toEqual({ deskNotice: { state: 'to_draft', holdUntil: null }, deskAffidavit: null })
    expect(lienWindowDeskEntryFor(desk, 'job-c').deskNotice).toEqual({ state: 'held', holdUntil: '2026-12-01' })
    expect(lienWindowDeskEntryFor(desk, 'job-d')).toEqual({ deskNotice: null, deskAffidavit: { state: 'needs_property', missing: ['owner'], holdUntil: null } })
  })

  it('is the Pipeline’s and the Lien desk page’s own pick, entry for entry', () => {
    for (const jobId of ['job-a', 'job-b', 'job-c', 'job-d', 'job-nowhere']) {
      expect(lienWindowDeskEntryFor(desk, jobId)).toEqual({
        deskNotice: lienWindowDeskNotice(desk.queue.entries.find((e) => e.jobId === jobId)),
        deskAffidavit: lienWindowDeskAffidavit(desk.affidavits.entries.find((e) => e.jobId === jobId)),
      })
    }
  })

  it('hands over nothing with no desk, no job, or a job on neither list, so the header reads as it did', () => {
    const none = { deskNotice: null, deskAffidavit: null }
    expect(lienWindowDeskEntryFor(null, 'job-a')).toEqual(none)
    expect(lienWindowDeskEntryFor(undefined, 'job-a')).toEqual(none)
    expect(lienWindowDeskEntryFor(desk, null)).toEqual(none)
    expect(lienWindowDeskEntryFor(desk, '')).toEqual(none)
    expect(lienWindowDeskEntryFor(desk, 'job-nowhere')).toEqual(none)
  })
})
