/**
 * A sub coming on (spike, 2026-10-23): the Once lane's stamps over made-up papers, sheets and lines. Nothing here is real.
 */
import { describe, expect, it } from 'vitest'
import type { CompanyPaperRow } from '../gc/companyPapers'
import type { FlowRows } from './load'
import { flowStampsFor } from './load'
import { SEED_FLOWS } from './seed'
import { readFlow } from './state'
import { subOnboardingStamps, subStampsWithOnboarding, type SubPersonRows } from './subOnboardingLoad'

const NOW = new Date('2026-10-23T20:00:00Z')
const contact = { id: 'c-sam', kind: 'sub' as const, off_since: null, off_why: null, off_by: null }
const paper = (doc_type: string, status: string, over: Partial<CompanyPaperRow> = {}): CompanyPaperRow => ({
  id: `${doc_type}-${status}`,
  company_id: null,
  doc_type,
  status,
  sent_at: null,
  signed_at: null,
  expires_at: null,
  created_at: '2026-10-20T15:00:00Z',
  ...over,
})
const rows = (subPerson: SubPersonRows | null): FlowRows => ({ contact, subPerson })
const fresh: SubPersonRows = { person: { created_at: '2026-10-20T15:00:00Z', archived_at: null }, papers: [], sheets: [] }
const lines = [
  { direction: 'in' as const, at: '2026-10-20T15:00:00Z' },
  { direction: 'out' as const, at: '2026-10-21T16:00:00Z' },
  { direction: 'out' as const, at: '2026-10-22T16:00:00Z' },
]

describe('subOnboardingStamps: a sub coming on', () => {
  it('reads reached out from our first line out, before their record is read', () => {
    expect(subOnboardingStamps(rows(null), lines, NOW).map((s) => [s.fact, s.at])).toEqual([['sub_reached', '2026-10-21T16:00:00Z']])
    expect(subOnboardingStamps(rows(fresh), [], NOW)).toEqual([])
  })

  it('reads the W-9 and the certificate through the company papers’ rule, and the sub agreement on its own', () => {
    const papers = [
      paper('w9', 'signed', { signed_at: '2026-10-22' }),
      paper('coi', 'signed', { signed_at: '2026-10-22', expires_at: '2027-10-22' }),
      paper('agreement', 'sent', { sent_at: '2026-10-22T18:00:00Z' }),
    ]
    const got = subOnboardingStamps(rows({ ...fresh, papers }), [], NOW)
    expect(got.map((s) => [s.fact, s.mark, s.at])).toEqual([
      ['w9_signed', 'ok', '2026-10-22'],
      ['coi_current', 'ok', '2026-10-22'],
      ['sub_agreement', 'wait', '2026-10-22'],
    ])
    const signed = subOnboardingStamps(rows({ ...fresh, papers: [paper('agreement', 'signed', { signed_at: '2026-10-23' })] }), [], NOW)
    expect(signed.map((s) => [s.fact, s.mark])).toEqual([['sub_agreement', 'ok']])
    // A customer's master agreement never reads on a sub.
    expect(got.some((s) => s.fact === 'msa_signed')).toBe(false)
  })

  it('reads the first job from the earliest sheet done, kept from the second, and let go from the archive', () => {
    const sheets = [{ done_at: '2026-11-02T20:00:00Z' }, { done_at: null }, { done_at: '2026-10-28T20:00:00Z' }]
    expect(subOnboardingStamps(rows({ ...fresh, sheets }), [], NOW).map((s) => [s.fact, s.at])).toEqual([
      ['sub_first_done', '2026-10-28T20:00:00Z'],
      ['sub_kept', '2026-11-02T20:00:00Z'],
    ])
    const gone = { ...fresh, person: { created_at: '2026-10-20T15:00:00Z', archived_at: '2026-11-05T15:00:00Z' } }
    expect(subOnboardingStamps(rows(gone), [], NOW).map((s) => s.fact)).toEqual(['sub_let_go'])
  })
})

describe('the seeded sub flow with the Once lane', () => {
  const read = (subPerson: SubPersonRows, ourLines = lines) => {
    const r = rows(subPerson)
    return readFlow(SEED_FLOWS.sub, subStampsWithOnboarding(flowStampsFor('sub', r, NOW), r, ourLines, NOW), NOW)
  }

  it('is the Once lane alone for a sub with no sheet yet, reached out done and their qualifications up next', () => {
    const reading = read(fresh)
    expect(reading.lanes).toHaveLength(1)
    const steps = reading.lanes[0]!.steps.map((s) => [s.stepId, s.state])
    expect(steps.map(([id]) => id)).toEqual(['reached', 'qualifications', 'w9', 'coi', 'agreement', 'first', 'kept'])
    expect(steps[0]).toEqual(['reached', 'done'])
    expect(steps[1]).toEqual(['qualifications', 'now'])
  })

  it('their qualifications read the same scale a candidate gets', () => {
    const quals = { levels: { plumbing: 3 as const, electrical: 0 as const, hvac: 0 as const }, license: { has: false as const }, location: 'Hutto' }
    expect(subOnboardingStamps({ ...rows(fresh), qualifications: quals }, [], NOW).map((s) => s.fact)).toEqual(['qualifications_noted'])
    expect(subOnboardingStamps({ ...rows(fresh), qualifications: { ...quals, location: '' } }, [], NOW)).toEqual([])
  })

  it('let go ends the lane either way', () => {
    const gone = { ...fresh, person: { created_at: '2026-10-20T15:00:00Z', archived_at: '2026-11-05T15:00:00Z' } }
    const lane = read(gone).lanes[0]!
    expect(lane.steps.find((s) => s.stepId === 'kept')?.state).toBe('done')
  })
})
