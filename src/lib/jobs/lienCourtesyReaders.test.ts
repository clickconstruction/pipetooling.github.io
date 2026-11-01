import { describe, expect, it } from 'vitest'
import { buildLienTimeline, type LienTimelineInput } from './lienTimeline'
import { lienCourtesyFromItems } from './lienTimelineDesk'
import { lienStopPaperKind, lienStopWindowWords } from './lienStopPaper'

/** The courtesy notice as the readers draw it (punch list #231, PR 3): the Timeline's node, the desk items it is read off, the stop window. */

const base = (over: Partial<LienTimelineInput> = {}): LienTimelineInput => ({
  todayYmd: '2026-11-02',
  isSub: true,
  propertyKind: 'non_residential',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent', at: '2026-10-14T20:00:00Z' }],
  noticeState: 'sent',
  retainage: null,
  affidavit: { deadline: '2026-12-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [] },
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
  ...over,
})

describe('the courtesy notice on the Timeline', () => {
  it('draws nothing when none went, and the newest one as a finished square step between the notice and the affidavit', () => {
    expect(buildLienTimeline(base()).steps.some((s) => s.kind === 'courtesy')).toBe(false)
    const t = buildLienTimeline(base({ courtesy: [{ at: '2026-10-23T15:00:00Z', how: 'by email', by: 'Grace', lienDay: '2026-12-15' }, { at: '2026-10-31T15:00:00Z', how: 'by email and text', by: 'Grace', lienDay: '2026-12-15' }] }))
    const keys = t.steps.map((s) => s.key)
    expect(keys.indexOf('courtesy')).toBeGreaterThan(keys.indexOf('notice:2026-08'))
    expect(keys.indexOf('courtesy')).toBeLessThan(keys.indexOf('affidavit'))
    const c = t.steps.find((s) => s.kind === 'courtesy')!
    expect(c).toMatchObject({ label: 'Courtesy notice', date: '2026-10-31', dateWords: 'sent Oct 31', state: 'done', words: 'by email and text · by Grace · named Dec 15', move: null })
    // Our paper, not a Chapter 53 step: the next step is still the affidavit.
    expect(t.next.kind).toBe('affidavit')
  })

  it('is read off the sent notice’s desk items: the channels that went, who pressed, the day named; a press where nothing went is skipped', () => {
    const items = [
      { kind: 'notice_53_056', status: 'sent', voided_at: null, fields: { courtesy: [
        { at: '2026-10-23T15:00:00Z', by: 'Grace', lienDay: '2026-12-15', claim: 4850, to: [{ who: 'original_contractor', channel: 'email', address: 'a@b.example', ok: true, id: 'e1', reason: '' }] },
        { at: '2026-10-25T15:00:00Z', by: 'Grace', lienDay: '2026-12-15', claim: 4850, to: [{ who: 'original_contractor', channel: 'text', address: '555', ok: false, id: null, reason: 'STOP' }] },
        { at: '2026-10-31T15:00:00Z', by: 'Taunya', lienDay: '', claim: 4850, to: [{ who: 'original_contractor', channel: 'text', address: '555', ok: true, id: 't1', reason: '' }, { who: 'owner', channel: 'email', address: 'o@b.example', ok: true, id: 'e2', reason: '' }] },
      ] } },
      { kind: 'notice_53_056', status: 'drafted', voided_at: null, fields: { courtesy: [{ at: '2026-10-01T15:00:00Z', by: 'x', lienDay: '', claim: 0, to: [{ who: 'owner', channel: 'email', address: 'o', ok: true, id: 'e', reason: '' }] }] } },
    ] as never
    expect(lienCourtesyFromItems(items)).toEqual([
      { at: '2026-10-23T15:00:00Z', how: 'by email', by: 'Grace', lienDay: '2026-12-15' },
      { at: '2026-10-31T15:00:00Z', how: 'by email and text', by: 'Taunya', lienDay: '' },
    ])
  })

  it('the stop window names it as our paper', () => {
    const step = buildLienTimeline(base({ courtesy: [{ at: '2026-10-31T15:00:00Z', how: 'by email', by: 'Grace', lienDay: '2026-12-15' }] })).steps.find((s) => s.kind === 'courtesy')!
    expect(lienStopPaperKind(step)).toBe('courtesy')
    expect(lienStopWindowWords({ step, noticeMonths: null })).toMatchObject({ eyebrow: 'Courtesy notice', title: 'The courtesy notice', noPaper: null })
  })
})
