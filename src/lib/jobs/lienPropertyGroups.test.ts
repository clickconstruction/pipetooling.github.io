import { describe, expect, it } from 'vitest'
import { groupLienBookByProperty } from './lienPropertyGroups'
import type { LienProperty } from './lienPropertyPapers'
import type { LienTimelineBookRow } from './lienTimelineBook'

const row = (jobId: string, addressId: string | null): LienTimelineBookRow => ({ jobId, job: { addressId } }) as unknown as LienTimelineBookRow
const property = (key: string, jobs: number, over: Partial<LienProperty> = {}): LienProperty => ({ key, addressId: key, address: `${key} Ridgeline Dr`, ownerName: 'Avery Pell', rows: [], jobs: Array.from({ length: jobs }, () => ({})) as LienProperty['jobs'], openBalance: 1_000 * jobs, tally: jobs > 1 ? `${jobs} notices sent` : '1 notice sent', tallies: { notices: '', affidavits: '' }, sameOwner: [], ...over })

const properties = [property('p7', 7), property('p2', 2, { ownerName: '', tally: '' }), property('p1', 1)]

describe('groupLienBookByProperty', () => {
  it('a property with more than one job gets a head; the rest gather under two plain heads', () => {
    const shown = [row('a', 'p2'), row('b', 'p7'), row('c', 'p1'), row('d', 'p7'), row('e', null), row('f', 'p2')]
    const out = groupLienBookByProperty(shown, properties)
    expect(out.map((s) => `${s.kind}:${s.key}:${s.rows.map((r) => r.jobId).join('')}`)).toEqual(['property:p2:af', 'property:p7:bd', 'singles:singles:c', 'no_record:no_record:e'])
    expect(out.map((s) => s.addressId)).toEqual(['p2', 'p7', null, null])
  })
  it('a head is the whole property, and says how many a filter left', () => {
    const [p7] = groupLienBookByProperty([row('b', 'p7'), row('d', 'p7')], properties)
    expect(p7).toMatchObject({ title: 'p7 Ridgeline Dr', words: 'Avery Pell · 7 jobs · $7,000 open · 7 notices sent · 2 shown' })
    const whole = groupLienBookByProperty(Array.from({ length: 7 }, (_, i) => row(`j${i}`, 'p7')), properties)[0]!
    expect(whole.words).toBe('Avery Pell · 7 jobs · $7,000 open · 7 notices sent')
  })
  it('leaves out what a property does not have', () => {
    expect(groupLienBookByProperty([row('a', 'p2')], properties)[0]!.words).toBe('2 jobs · $2,000 open · 1 shown')
  })
  it('counts the plain heads, and a record the book does not know is one job each', () => {
    const out = groupLienBookByProperty([row('c', 'p1'), row('x', 'p-unknown'), row('e', null), row('g', null)], properties)
    expect(out.map((s) => `${s.title} · ${s.words}`)).toEqual(['One job each · 2 properties', 'No property record · 2 jobs'])
    expect(groupLienBookByProperty([row('c', 'p1')], properties)[0]!.words).toBe('1 property')
  })
  it('nothing shown is no sections', () => {
    expect(groupLienBookByProperty([], properties)).toEqual([])
  })
})
