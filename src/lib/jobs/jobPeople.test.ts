import { describe, expect, it } from 'vitest'
import { estimateChipHref, estimateChipWords, jobPeopleLine, jobPeopleRows, pickJobEstimateAuthor, wearsEstimateChip, type JobEstimateAuthor } from './jobPeople'

const nia: JobEstimateAuthor = { userId: 'u-nia', name: 'Nia', estimateId: 'e-1', estimateNumber: 1041 }
const team = [
  { user_id: 'u-luis', name: 'Luis' },
  { user_id: 'u-marcus', name: ' Marcus ' },
]

describe('jobPeopleRows (v2.6694 — the estimate’s author among the job’s people)', () => {
  it('the team in its order, nobody flagged, when the job came from no estimate', () => {
    const rows = jobPeopleRows(team, null)
    expect(rows.map((r) => r.name)).toEqual(['Luis', 'Marcus'])
    expect(rows.every((r) => r.onTeam && !wearsEstimateChip(r))).toBe(true)
  })
  it('an author on the team wears the chip on their own row, and no row is added', () => {
    const rows = jobPeopleRows([...team, { user_id: 'u-nia', name: 'Nia' }], nia)
    expect(rows.map((r) => [r.name, wearsEstimateChip(r), r.onTeam])).toEqual([
      ['Luis', false, true],
      ['Marcus', false, true],
      ['Nia', true, true],
    ])
  })
  it('an author who is not on the team is added at the end with the chip', () => {
    const rows = jobPeopleRows(team, nia)
    expect(rows.map((r) => [r.name, wearsEstimateChip(r), r.onTeam])).toEqual([
      ['Luis', false, true],
      ['Marcus', false, true],
      ['Nia', true, false],
    ])
    expect(jobPeopleLine(rows)).toBe('Luis, Marcus, Nia')
  })
  it('a nameless author off the team is left out; a nameless team member reads Unknown', () => {
    expect(jobPeopleRows([{ user_id: 'u-x', name: null }], { ...nia, name: null }).map((r) => r.name)).toEqual(['Unknown'])
  })
})

describe('the chip’s words and door', () => {
  it('names the estimate by number and opens it there', () => {
    expect(estimateChipWords(nia)).toEqual({ label: 'E', title: 'Wrote estimate #1041, the one this job came from. Opens it.' })
    expect(estimateChipHref(nia)).toBe('/estimates/1041')
  })
  it('falls back to the id when the row has no number', () => {
    expect(estimateChipWords({ estimateNumber: null }).title).toBe('Wrote the estimate, the one this job came from. Opens it.')
    expect(estimateChipHref({ estimateId: 'e-1', estimateNumber: null })).toBe('/estimates/e-1')
  })
})

describe('pickJobEstimateAuthor', () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: 'e-1', estimate_number: 1041, created_by: 'u-nia', status: 'customer_accepted', doc_kind: 'estimate', created_at: '2026-11-01T10:00:00Z', ...over })
  it('the newest signed estimate that is not a change order, with the author’s name', () => {
    const got = pickJobEstimateAuthor(
      [row({ id: 'e-old', estimate_number: 1030, created_at: '2026-10-01T10:00:00Z' }), row({ id: 'e-co', doc_kind: 'change_order', created_at: '2026-11-05T10:00:00Z' }), row({ id: 'e-draft', status: 'draft', created_at: '2026-11-06T10:00:00Z' }), row()],
      new Map([['u-nia', 'Nia']]),
    )
    expect(got).toEqual(nia)
  })
  it('null when nothing fits, a name of null when the viewer could not read it', () => {
    expect(pickJobEstimateAuthor([row({ doc_kind: 'change_order' })], null)).toBeNull()
    expect(pickJobEstimateAuthor(null, null)).toBeNull()
    expect(pickJobEstimateAuthor([row({ estimate_number: null })], null)).toEqual({ ...nia, name: null, estimateNumber: null })
  })
})
