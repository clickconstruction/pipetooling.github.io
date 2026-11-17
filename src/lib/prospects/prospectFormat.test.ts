import { describe, expect, it } from 'vitest'
import { formatDateTime } from './prospectFormat'

describe('formatDateTime', () => {
  it('a missing time is a dash', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  it('writes a moment short, the day then the time, in US order', () => {
    const iso = '2026-10-01T15:04:00.000Z'
    // The reader's own zone decides the hour, so the test reads the parts in that zone too.
    const d = new Date(iso)
    const hour12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
    const out = formatDateTime(iso)
    expect(out).toContain(`${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`)
    expect(out).toContain(`${hour12}:04`)
    expect(out).toMatch(/(AM|PM)$/)
  })
})
