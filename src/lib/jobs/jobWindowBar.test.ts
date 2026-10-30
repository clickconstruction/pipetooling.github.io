import { describe, expect, it } from 'vitest'
import { crewJobWindowBar, crewStampOffer, JOB_WINDOW_BAR_MIN_HEIGHT, jobWindowTiles, jobWindowVerb, leavingOpens, tabbedJobWindowBar, viewerOnCrew } from './jobWindowBar'
import { buildJobThreadStampBody } from '../jobThreadNoteStampBody'
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

describe('tabbedJobWindowBar', () => {
  it('draws Status ▾ · the verb (growing) · Note, and no verb slot on a Paid job', () => {
    const row = tabbedJobWindowBar({ label: 'Set % done', tone: 'red', target: 'pct' })
    expect(row.map((b) => [b.key, b.label, b.grow])).toEqual([
      ['status', 'Status ▾', false],
      ['verb', 'Set % done', true],
      ['note', 'Note', false],
    ])
    // Status ▾ and Note open their sheets. Set % done opens the composer's inline editor, so it is a plain press.
    expect(row.map((b) => b.opensDialog)).toEqual([true, false, true])
    expect(tabbedJobWindowBar({ label: 'Mark paid', tone: 'blue', target: 'status' })[1]?.opensDialog).toBe(true)
    expect(tabbedJobWindowBar(null).map((b) => b.key)).toEqual(['status', 'note'])
    expect(JOB_WINDOW_BAR_MIN_HEIGHT).toBeGreaterThanOrEqual(44)
  })
  it('puts the stamp a viewer on the crew is due between the verb and Note, the verb still taking the width', () => {
    const row = tabbedJobWindowBar({ label: 'Set % done', tone: 'red', target: 'pct' }, 'leaving')
    expect(row.map((b) => [b.key, b.label, b.tone, b.grow])).toEqual([
      ['status', 'Status ▾', 'outline', false],
      ['verb', 'Set % done', 'red', true],
      ['leaving', 'Leaving', 'amber', false],
      ['note', 'Note', 'outline', false],
    ])
    // The stamp is a press that writes at once, not a sheet.
    expect(row[2]?.opensDialog).toBe(false)
    // On a Paid job there is no verb, so the stamp takes the width.
    expect(tabbedJobWindowBar(null, 'arrived').map((b) => [b.key, b.tone, b.grow])).toEqual([
      ['status', 'outline', false],
      ['arrived', 'green', true],
      ['note', 'outline', false],
    ])
    // Off the crew: no stamp, the bar as before.
    expect(tabbedJobWindowBar({ label: 'Bill it', tone: 'green', target: 'bill' }, null).map((b) => b.key)).toEqual(['status', 'verb', 'note'])
  })
  it('draws the stamp the same on both bars', () => {
    const tabbed = tabbedJobWindowBar({ label: 'Bill it', tone: 'green', target: 'bill' }, 'arrived')[2]
    const crew = crewJobWindowBar({ stamp: 'arrived', canLeaveReport: false, canNote: false })[0]
    expect([tabbed?.label, tabbed?.tone, tabbed?.opensDialog]).toEqual([crew?.label, crew?.tone, crew?.opensDialog])
  })
})

describe('crewJobWindowBar', () => {
  it('offers the stamp the viewer is due, Leave report and Note, each only while its press can land', () => {
    expect(crewJobWindowBar({ stamp: 'arrived', canLeaveReport: true, canNote: true }).map((b) => [b.key, b.label, b.tone, b.grow])).toEqual([
      ['arrived', 'Arrived', 'green', true],
      ['report', 'Leave report', 'blue', false],
      ['note', 'Note', 'outline', false],
    ])
    expect(crewJobWindowBar({ stamp: 'leaving', canLeaveReport: false, canNote: true }).map((b) => [b.key, b.label, b.tone])).toEqual([
      ['leaving', 'Leaving', 'amber'],
      ['note', 'Note', 'outline'],
    ])
    expect(crewJobWindowBar({ stamp: null, canLeaveReport: false, canNote: false })).toEqual([])
  })
})

describe('crewStampOffer', () => {
  const today = '2026-10-26'
  // A wall-clock time on the day in Chicago (CDT, UTC−5, in October).
  const at = (hhmm: string, day = today) => `${day}T${hhmm}:00-05:00`
  const stamp = (name: string | null, kind: 'arrived' | 'leaving', iso: string, authorName: string | null = name) => ({
    body: buildJobThreadStampBody(name, kind, new Date(iso)),
    created_at: iso,
    authorName,
  })
  it('offers Arrived with no stamp of the viewer today', () => {
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [], todayYmd: today })).toBe('arrived')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [stamp('Luis Ortega', 'arrived', at('08:10', '2026-10-25'))], todayYmd: today })).toBe('arrived')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [stamp('Dana Whitfield', 'arrived', at('08:10'))], todayYmd: today })).toBe('arrived')
  })
  it('offers Leaving once the viewer stamped Arrived today, and Arrived again after Leaving', () => {
    const arrived = stamp('Luis Ortega', 'arrived', at('08:10'))
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [arrived], todayYmd: today })).toBe('leaving')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [stamp('Luis Ortega', 'leaving', at('11:30')), arrived], todayYmd: today })).toBe('arrived')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [stamp('Luis Ortega', 'leaving', at('11:30')), stamp('Luis Ortega', 'arrived', at('13:05'))], todayYmd: today })).toBe('leaving')
  })
  it('knows the viewer by the name the stamp carries when the author is unnamed, and a plain note is not a stamp', () => {
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [stamp('Luis Ortega', 'arrived', at('08:10'), null)], todayYmd: today })).toBe('leaving')
    expect(crewStampOffer({ viewerName: null, notes: [stamp(null, 'arrived', at('08:10'), null)], todayYmd: today })).toBe('leaving')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [{ body: 'Arrived at job, pan set', created_at: at('08:10'), authorName: 'Luis Ortega' }], todayYmd: today })).toBe('arrived')
  })
  it('reads a clock-in as there and a clock-out as gone, the latest mark of the day deciding', () => {
    const session = (clockedInAt: string | null, clockedOutAt: string | null, personName = 'Luis Ortega') => ({ personName, clockedInAt, clockedOutAt })
    // Clocked in through Job Mode with no stamp pressed: the bar offers Leaving.
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [], clockSessions: [session(at('08:00'), null)], todayYmd: today })).toBe('leaving')
    // Clocked out: gone again.
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [], clockSessions: [session(at('08:00'), at('12:00'))], todayYmd: today })).toBe('arrived')
    // Left for lunch with the clock still running: the Leaving stamp is the latest mark, until he clocks in again.
    const lunch = [stamp('Luis Ortega', 'leaving', at('11:30'))]
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: lunch, clockSessions: [session(at('08:00'), null)], todayYmd: today })).toBe('arrived')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: lunch, clockSessions: [session(at('08:00'), at('11:31')), session(at('12:30'), null)], todayYmd: today })).toBe('leaving')
    // Someone else's session, and his own from yesterday, say nothing about today.
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [], clockSessions: [session(at('08:00'), null, 'Dana Whitfield')], todayYmd: today })).toBe('arrived')
    expect(crewStampOffer({ viewerName: 'Luis Ortega', notes: [], clockSessions: [session(at('08:00', '2026-10-25'), null)], todayYmd: today })).toBe('arrived')
  })
})

describe('leavingOpens', () => {
  it('opens the On my way sheet when the day has a next job, else Update Focus', () => {
    expect(leavingOpens({ dayHasNextJob: true })).toBe('on-my-way')
    expect(leavingOpens({ dayHasNextJob: false })).toBe('update-focus')
  })
})
