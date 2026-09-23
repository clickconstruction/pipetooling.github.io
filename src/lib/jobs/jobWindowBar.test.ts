import { describe, expect, it } from 'vitest'
import { jobWindowTiles, jobWindowVerb, viewerOnCrew } from './jobWindowBar'
import type { EditJobBillingBar } from './editJobBillingBar'

const bar = (over: Partial<EditJobBillingBar> = {}): EditJobBillingBar => ({
  hasBar: true,
  total: 2000,
  paid: 0,
  billedUnpaid: 0,
  draft: 0,
  remaining: 2000,
  paidFrac: 0,
  billedFrac: 0,
  draftFrac: 0,
  ...over,
})

describe('jobWindowVerb', () => {
  it('offers the gap the row flagged first', () => {
    expect(jobWindowVerb({ status: 'working', chip: { label: 'set % done', tone: 'red', action: 'pct', title: '' }, bar: bar() })).toEqual({ label: 'Set % done', tone: 'red', target: 'pct' })
    expect(jobWindowVerb({ status: 'working', chip: { label: 'draw 2 ready', tone: 'green', action: 'bill-stage', title: '' }, bar: bar() })).toEqual({ label: 'Bill it', tone: 'green', target: 'bill' })
  })
  it('sends a waiting draft bill before a status move', () => {
    expect(jobWindowVerb({ status: 'ready_to_bill', chip: null, bar: bar({ draft: 500 }) })).toEqual({ label: 'Send bill…', tone: 'blue', target: 'bill' })
  })
  it('falls back to the stage’s forward move', () => {
    expect(jobWindowVerb({ status: 'waiting', chip: null, bar: bar() })?.label).toBe('Move to Working')
    expect(jobWindowVerb({ status: 'working', chip: null, bar: bar() })).toEqual({ label: 'Ready to bill', tone: 'blue', target: 'status' })
    expect(jobWindowVerb({ status: 'working', chip: { label: '$400 done, not billed', tone: 'green', action: 'advance', title: '' }, bar: bar() })?.tone).toBe('green')
    expect(jobWindowVerb({ status: 'ready_to_bill', chip: null, bar: bar() })).toEqual({ label: 'Bill it', tone: 'blue', target: 'bill' })
    expect(jobWindowVerb({ status: 'billed', chip: null, bar: bar() })).toEqual({ label: 'Mark paid', tone: 'blue', target: 'status' })
    expect(jobWindowVerb({ status: 'paid', chip: null, bar: bar() })).toBeNull()
  })
})

describe('viewerOnCrew', () => {
  it('is true for a team member or a block assignee, false otherwise', () => {
    expect(viewerOnCrew('u1', ['u1'], [])).toBe(true)
    expect(viewerOnCrew('u2', ['u1'], new Set(['u2']))).toBe(true)
    expect(viewerOnCrew('u3', ['u1'], ['u2'])).toBe(false)
    expect(viewerOnCrew(null, ['u1'], ['u1'])).toBe(false)
  })
})

describe('jobWindowTiles', () => {
  it('prints the three numbers, dashes for nothing', () => {
    expect(jobWindowTiles(bar())).toEqual({ total: '$2,000', billed: '—', paid: '—' })
    expect(jobWindowTiles(bar({ paid: 214, billedUnpaid: 1000 }))).toEqual({ total: '$2,000', billed: '$1,214', paid: '$214' })
  })
})
