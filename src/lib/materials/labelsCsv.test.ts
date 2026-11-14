import { describe, expect, it } from 'vitest'
import { labelsCsvFileName, labelsCsvRows, labelsCsvText } from './labelsCsv'
import type { Container } from './onSite'

const box = (id: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...extra })

describe('the labels as a CSV (v2.6800)', () => {
  const containers = [
    box('7d759246-8476-4a37-884f-ed1562d5663f', 'B3', 'cage', { locationId: 'p1', where: 'by the north stair' }),
    box('aaaa1111-0000-4000-8000-000000000000', 'A10', 'box'),
    box('bbbb2222-0000-4000-8000-000000000000', 'A2', 'cage', { where: 'has a "lid"' }),
    box('cccc3333-0000-4000-8000-000000000000', 'Unsorted', 'unsorted'),
    box('dddd4444-0000-4000-8000-000000000000', 'D1', 'box', { retiredAt: '2026-11-08T00:00:00Z' }),
  ]
  const places = [{ id: 'p1', name: 'Level 2' }]

  it('lists every live cage and box in stencil order with the dashed code, the typed address and the QR with its scheme', () => {
    const rows = labelsCsvRows(containers, places)
    expect(rows.map((r) => r.stencil)).toEqual(['A2', 'A10', 'B3'])
    expect(rows[2]).toEqual({ stencil: 'B3', kind: 'cage', place: 'Level 2', where: 'by the north stair', code: '7D75-9246', address: 'prts.co/b/7D75-9246', qr: 'HTTPS://PRTS.CO/B/7D759246' })
  })

  it('writes a header and escapes a cell with quotes, CRLF line ends', () => {
    const text = labelsCsvText(labelsCsvRows(containers, places))
    const lines = text.split('\r\n')
    expect(lines[0]).toBe('Stencil,Kind,Place,Where,Code,Address,QR')
    expect(lines[1]).toContain('"has a ""lid"""')
    expect(lines).toHaveLength(5)
    expect(lines[4]).toBe('')
  })

  it('the Stencil cell is what the label prints: the letters and number alone (v2.7195)', () => {
    const rows = labelsCsvRows([box('eeee5555-0000-4000-8000-000000000000', 'R74 3/4 PEX', 'cage'), box('ffff6666-0000-4000-8000-000000000000', 'CONCRETE MIX', 'loose'), box('cccc3333-0000-4000-8000-000000000000', 'Unsorted', 'unsorted')], [])
    expect(rows.map((r) => r.stencil)).toEqual(['CONCRETE MIX', 'R74'])
  })

  it('names the file by the job and the day', () => {
    expect(labelsCsvFileName('Oak Hollow Apartments · Building C', '2026-11-09')).toBe('labels-oak-hollow-apartments-building-c-2026-11-09.csv')
    expect(labelsCsvFileName('', '2026-11-09')).toBe('labels-2026-11-09.csv')
  })
})
