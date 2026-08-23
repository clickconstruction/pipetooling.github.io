import { describe, expect, it } from 'vitest'
import { groupReportsByDay, reportDayLabel, reportPreviewLines, reportTimeLabel } from './reportsFeed'

const now = new Date(2026, 7, 23, 15, 0) // Aug 23, 2026 local

describe('reportDayLabel', () => {
  it('uses day rules', () => {
    expect(reportDayLabel(new Date(2026, 7, 23, 9).toISOString(), now)).toBe('Today')
    expect(reportDayLabel(new Date(2026, 7, 22, 23).toISOString(), now)).toBe('Yesterday')
    expect(reportDayLabel(new Date(2026, 7, 18, 12).toISOString(), now)).toMatch(/Aug 18/)
    expect(reportDayLabel(new Date(2025, 7, 18, 12).toISOString(), now)).toMatch(/2025/)
    expect(reportDayLabel('garbage', now)).toBe('')
  })
})

describe('reportTimeLabel', () => {
  it('formats a short lowercase time', () => {
    expect(reportTimeLabel(new Date(2026, 7, 23, 14, 40).toISOString())).toMatch(/2:40/)
  })
})

describe('groupReportsByDay', () => {
  it('buckets consecutive rows under one day header, preserving order', () => {
    const rows = [
      { id: 'a', created_at: new Date(2026, 7, 23, 14).toISOString() },
      { id: 'b', created_at: new Date(2026, 7, 23, 9).toISOString() },
      { id: 'c', created_at: new Date(2026, 7, 22, 17).toISOString() },
    ]
    const g = groupReportsByDay(rows, now)
    expect(g.map((x) => x.label)).toEqual(['Today', 'Yesterday'])
    expect(g[0]!.rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('reportPreviewLines', () => {
  it('takes the first non-empty fields, clips long values, and names signatures', () => {
    const lines = reportPreviewLines({ Empty: '  ', 'Work done': 'x'.repeat(200), Signature: 'data:image/png;base64,abc', More: 'y' }, 2)
    expect(lines.map((l) => l.label)).toEqual(['Work done', 'Signature'])
    expect(lines[0]!.value.endsWith('…')).toBe(true)
    expect(lines[0]!.value.length).toBeLessThanOrEqual(90)
    expect(lines[1]!.value).toBe('✍ signed')
    expect(reportPreviewLines(null)).toEqual([])
  })
})
