import { describe, expect, it } from 'vitest'
import type { Container, Movement, Place } from './onSite'
import { orderedPair, tieCanon, type PartTie } from './partTies'
import { buildSiteMaterialsReport, partRowsWords, reportLeadWords, reportPartRows, reportSections, REPORT_VIEWS } from './siteMaterialsReport'
import { rollKey } from './siteRollup'

// A made-up site, Juniper Ridge: two jobs, three cages.
const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: '2026-10-01T12:00:00Z' })
const cage = (id: string, jobId: string, label: string, locationId: string | null): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T12:00:00Z' })
let n = 0
const delivered = (jobId: string, name: string, quantity: number, to: string, note = 'added on site', partId: string | null = null): Movement => {
  n += 1
  return { id: `m${n}`, jobId, partId, partName: name, manufacturer: null, quantity, reason: 'delivered', fromContainerId: null, toContainerId: to, note, byUserId: null, byName: 'Priya', at: '2026-11-10T15:00:00Z', source: null, itemId: null }
}

const report = buildSiteMaterialsReport({
  site: { name: 'Juniper Ridge', customer: 'Ridgeway Builders', address: null },
  jobs: [
    { id: 'ja', label: 'J1042', name: 'Phase 2' },
    { id: 'jb', label: 'J1057', name: 'Pump house' },
  ],
  rows: {
    places: [place('ya', 'ja', 'Laydown yard'), place('yb', 'jb', 'Laydown yard')],
    containers: [cage('r12', 'ja', 'R12', 'ya'), cage('r31', 'ja', 'R31', 'ya'), cage('p1', 'jb', 'P1', 'yb')],
    movements: [
      delivered('ja', '2" 90 pvc', 94, 'r12', 'ea'),
      delivered('ja', '2 inch 90 PVC', 42, 'r31', 'ea'),
      delivered('jb', '2inch 90s pvc', 28, 'p1', 'ea'),
      delivered('ja', '2" 90', 10, 'r31'),
      delivered('ja', '3/4 COPPER TEE', 300, 'r12', 'ea', 'book-1'),
    ],
  },
  now: new Date('2026-11-12T18:00:00Z'),
  printedBy: 'Dana',
})

describe('the material location report, by part', () => {
  it('is a third reading the chips offer, with its own lead and no box sections', () => {
    expect(REPORT_VIEWS.map((v) => v.label)).toEqual(['By job', 'By location', 'By part'])
    expect(reportSections(report, 'part')).toEqual([])
    expect(reportLeadWords('part')).toContain('Every part across the site’s jobs')
  })
  it('lists one row per part across the jobs, the same words folded, with where each is', () => {
    const rows = reportPartRows(report)
    expect(rows.map((r) => `${r.name} ${r.total}`)).toEqual(['2" 90 10', '2" 90 pvc 164', '3/4 COPPER TEE 300'])
    const pvc = rows[1]!
    expect(pvc.spellings).toEqual(['2" 90 pvc', '2 inch 90 PVC', '2inch 90s pvc'])
    expect(pvc.holds.map((h) => `${h.stencil} ${h.onHand} ${h.jobLabel} ${h.placeName}`)).toEqual(['R12 94 J1042 Laydown yard', 'R31 42 J1042 Laydown yard', 'P1 28 J1057 Laydown yard'])
    expect(pvc.unit).toBe('ea')
    expect(rows[0]!.unit).toBeNull()
    expect(partRowsWords(rows)).toBe('3 parts · 474 pieces')
    expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(report.jobs.flatMap((j) => j.boxes).flatMap((b) => b.lines).reduce((sum, l) => sum + l.onHand, 0))
  })
  it('joins the names a person joined on the site’s screen, and names a typed row tied to the book', () => {
    const tie = (x: string, y: string, xName: string, yName: string): PartTie => {
      const [aKey, bKey] = orderedPair(x, y)
      return { id: `${x}|${y}`, aKey, bKey, aName: aKey === x ? xName : yName, bName: bKey === x ? xName : yName, verdict: 'same', byName: 'Dana', at: '2026-11-12T10:00:00Z' }
    }
    const bare = rollKey({ partId: null, partName: '2" 90' })
    const pvc = rollKey({ partId: null, partName: '2" 90 pvc' })
    const joined = reportPartRows(report, tieCanon([tie(bare, pvc, '2" 90', '2" 90 pvc')]))
    expect(joined.map((r) => r.total)).toEqual([174, 300])
    const ties = [tie(bare, pvc, '2" 90', '2" 90 pvc'), tie('id:book-9', pvc, '2 PVC 90 DWV', '2" 90 pvc')]
    const booked = reportPartRows(report, tieCanon(ties), new Map([['id:book-9', '2 PVC 90 DWV']]))
    expect(booked.map((r) => `${r.name} ${r.total}`)).toEqual(['2 PVC 90 DWV 174', '3/4 COPPER TEE 300'])
  })
})
