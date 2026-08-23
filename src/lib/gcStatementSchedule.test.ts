import { describe, expect, it } from 'vitest'
import { buildGcStatementRequestInsert, describePendingGcStatementSend } from './gcStatementSchedule'

const base = {
  requestedBy: 'user-1',
  toEmail: 'ap@knight.com',
  byDevelopment: false,
  entityId: 'gc-1',
  entityName: 'Knight Contracting',
  includeCollections: false,
  sendDateYmd: '2026-08-10',
  sendTimeHm: '07:00',
  repeatWeekly: true,
}
const now = new Date('2026-08-06T12:00:00Z')

describe('buildGcStatementRequestInsert', () => {
  it('carries cc_emails when given, null when empty (v2.2160)', () => {
    const withCc = buildGcStatementRequestInsert({ ...base, ccEmails: ['malachi@click.com'] }, now)
    if (!withCc.ok) throw new Error(withCc.error)
    expect(withCc.row.cc_emails).toEqual(['malachi@click.com'])
    const none = buildGcStatementRequestInsert({ ...base, ccEmails: [] }, now)
    if (!none.ok) throw new Error(none.error)
    expect(none.row.cc_emails).toBeNull()
  })

  it('builds a single-GC row with the entity on gc_customer_id', () => {
    const res = buildGcStatementRequestInsert(base, now)
    if (!res.ok) throw new Error(res.error)
    expect(res.row.gc_customer_id).toBe('gc-1')
    expect(res.row.development_id).toBeNull()
    expect(res.row.group_by).toBe('gc')
    expect(res.row.repeat_weekly).toBe(true)
    // 07:00 Central on Aug 10 (CDT, UTC-5) = 12:00Z
    expect(res.sendAtIso).toBe('2026-08-10T12:00:00.000Z')
  })

  it('development grouping routes the entity to development_id', () => {
    const res = buildGcStatementRequestInsert({ ...base, byDevelopment: true, entityId: 'dev-9' }, now)
    if (!res.ok) throw new Error(res.error)
    expect(res.row.development_id).toBe('dev-9')
    expect(res.row.gc_customer_id).toBeNull()
    expect(res.row.group_by).toBe('development')
  })

  it('null entity = whole report: both entity columns null', () => {
    const res = buildGcStatementRequestInsert({ ...base, entityId: null, entityName: 'All GCs' }, now)
    if (!res.ok) throw new Error(res.error)
    expect(res.row.gc_customer_id).toBeNull()
    expect(res.row.development_id).toBeNull()
    expect(res.row.entity_name).toBe('All GCs')
  })

  it('rejects a bad email, a bad date, and a past time', () => {
    expect(buildGcStatementRequestInsert({ ...base, toEmail: 'nope' }, now).ok).toBe(false)
    expect(buildGcStatementRequestInsert({ ...base, sendDateYmd: 'tomorrow' }, now).ok).toBe(false)
    const past = buildGcStatementRequestInsert({ ...base, sendDateYmd: '2026-08-01' }, now)
    expect(past.ok).toBe(false)
    if (!past.ok) expect(past.error).toContain('future')
  })

  it('a mismatched entity dimension is nulled, never sent to the wrong column', () => {
    // byDevelopment=false with an entity id always lands on gc_customer_id —
    // the table CHECK would reject a development id under group_by 'gc'.
    const res = buildGcStatementRequestInsert({ ...base, byDevelopment: false }, now)
    if (!res.ok) throw new Error(res.error)
    expect(res.row.development_id).toBeNull()
  })
})

describe('describePendingGcStatementSend', () => {
  it('labels entity and destination', () => {
    expect(describePendingGcStatementSend({ entity_name: 'Knight Contracting', sent_to: 'ap@knight.com' })).toBe(
      'Knight Contracting → ap@knight.com',
    )
    expect(describePendingGcStatementSend({ entity_name: '  ', sent_to: 'x@y.co' })).toBe('Statement → x@y.co')
  })
})
