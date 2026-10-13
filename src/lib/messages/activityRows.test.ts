import { describe, expect, it } from 'vitest'
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import {
  activityCounts,
  JOB_ACTIVITY_SWITCH_KEY,
  switchState,
  threadRowMatches,
  threadWithActivity,
  tiedJobs,
  type ThreadActivityRow,
} from './activityRows'
import type { ThreadMessage } from './thread'

/** A Chicago wall time in October 2026 (CDT, five hours behind UTC). */
const cdt = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00-05:00`).toISOString()

// Dana Whitfield, the prototype's screen 8: the sewer line (1312) and the water heater (1298), plus a third job of
// hers (1340) that no line of hers points at. Made-up rows.
const SEWER = 'pipeline:job-1312'
const HEATER = 'pipeline:job-1298'
const KITCHEN = 'pipeline:job-1340'

const line = (
  id: string,
  ymd: string,
  hm: string,
  jobId: string | null,
  channel: ThreadMessage['channel'],
  direction: ThreadMessage['direction'],
  who: string,
): ThreadMessage => ({ id, contactId: 'dana', jobId, channel, direction, at: cdt(ymd, hm), who, body: id })

const LINES: ThreadMessage[] = [
  line('on our way', '2026-10-05', '09:02', SEWER, 'text', 'out', 'Luis'),
  line('gate code', '2026-10-05', '09:04', SEWER, 'text', 'in', 'Dana'),
  line('what we found', '2026-10-05', '11:12', SEWER, 'text', 'out', 'Luis'),
  line('estimate email', '2026-10-06', '14:20', SEWER, 'email', 'out', 'Rosa'),
  line('can you do Thursday', '2026-10-06', '16:05', SEWER, 'text', 'in', 'Dana'),
  line('heater quote stands', '2026-10-06', '16:30', HEATER, 'email', 'out', 'Rosa'),
  line('approved', '2026-10-07', '08:14', SEWER, 'portal', 'in', 'Dana'),
  line('voicemail', '2026-10-08', '14:14', null, 'voicemail', 'in', 'Dana'),
  line('invoice email', '2026-10-09', '10:03', SEWER, 'email', 'out', 'the app'),
]

const clockIn = (key: string, ymd: string, inHm: string, outHm: string): JobThreadActivityItem => ({
  kind: 'clock_session',
  clock: {
    dedupeKey: `cs:${key}`,
    sortAt: cdt(ymd, inHm),
    personName: 'Luis',
    clockedInAt: cdt(ymd, inHm),
    clockedOutAt: cdt(ymd, outHm),
    durationHours: null,
    status: 'pending',
    note: '',
  },
})

const event = (
  key: string,
  type: 'status_change' | 'invoice_created',
  ymd: string,
  hm: string,
  summary: string,
  financial: boolean,
): JobThreadActivityItem => ({
  kind: 'event',
  event: { dedupeKey: `ev:${key}`, type, occurredAt: cdt(ymd, hm), actorName: null, summary, financial },
})

const CLOCK = clockIn('1312', '2026-10-05', '09:41', '12:30')
const REPORT: JobThreadActivityItem = {
  kind: 'report',
  report: {
    id: 'r1',
    template_name: 'Status Report',
    job_display_name: 'Oakridge sewer line',
    created_at: cdt('2026-10-05', '11:07'),
    created_by_name: 'Luis',
  },
}
const WORKING = event('status', 'status_change', '2026-10-07', '08:15', 'Waiting → Working', false)
const INVOICE = event('invoice', 'invoice_created', '2026-10-09', '10:02', 'Invoice 1312 created · $4,850', true)
const HEATER_NOTE: JobThreadActivityItem = {
  kind: 'note',
  note: { id: 'n1', body: 'Water heater goes on the same visit.', created_at: cdt('2026-10-07', '08:20'), author: { name: 'Rosa' } },
}
const KITCHEN_CLOCK = clockIn('1340', '2026-10-08', '08:00', '11:00')

/** Out of time order, as the job panel's per-job lists and a loader's pages can arrive. */
const ACTIVITY: Record<string, JobThreadActivityItem[]> = {
  [SEWER]: [INVOICE, WORKING, CLOCK, REPORT],
  [HEATER]: [HEATER_NOTE],
  [KITCHEN]: [KITCHEN_CLOCK],
}

/** A row in one word: the line's id, or the activity row's kind and job. */
const label = (r: ThreadActivityRow) =>
  r.kind === 'line' ? r.message.id : `${r.item.kind === 'event' ? r.item.event.summary : r.item.kind} on ${r.jobId}`

describe('threadWithActivity', () => {
  it('merges her lines with the clock, the report, the status and the invoice of the jobs her lines are tied to', () => {
    const rows = threadWithActivity([...LINES].reverse(), ACTIVITY, { on: true })
    expect(rows.map(label)).toEqual([
      'on our way',
      'gate code',
      `clock_session on ${SEWER}`,
      `report on ${SEWER}`,
      'what we found',
      'estimate email',
      'can you do Thursday',
      'heater quote stands',
      'approved',
      `Waiting → Working on ${SEWER}`,
      `note on ${HEATER}`,
      'voicemail',
      `Invoice 1312 created · $4,850 on ${SEWER}`,
      'invoice email',
    ])
  })

  it('says which job every row is on, and a line with no job is on her alone', () => {
    const rows = threadWithActivity(LINES, ACTIVITY, { on: true })
    expect(rows.find((r) => r.kind === 'activity' && r.item.kind === 'note')?.jobId).toBe(HEATER)
    expect(rows.find((r) => r.kind === 'line' && r.message.id === 'voicemail')?.jobId).toBeNull()
    expect(rows.filter((r) => r.kind === 'activity').every((r) => r.jobId === SEWER || r.jobId === HEATER)).toBe(true)
  })

  it('off returns her lines alone, oldest first', () => {
    const rows = threadWithActivity([...LINES].reverse(), ACTIVITY, { on: false })
    expect(rows.map(label)).toEqual(LINES.map((m) => m.id))
  })

  it('leaves out a third job of hers that no line points at', () => {
    expect(tiedJobs(LINES)).toEqual([SEWER, HEATER])
    const rows = threadWithActivity(LINES, ACTIVITY, { on: true })
    expect(rows.some((r) => r.jobId === KITCHEN)).toBe(false)
    expect(rows.some((r) => r.kind === 'activity' && r.item === KITCHEN_CLOCK)).toBe(false)
  })

  it('drops the invoice at the tech’s door and keeps her lines, the invoice email among them', () => {
    const rows = threadWithActivity(LINES, ACTIVITY, { on: true, noMoney: true })
    expect(rows.map(label)).not.toContain(`Invoice 1312 created · $4,850 on ${SEWER}`)
    expect(rows.map(label)).toContain(`Waiting → Working on ${SEWER}`)
    expect(rows.filter((r) => r.kind === 'line')).toHaveLength(LINES.length)
  })

  it('drops a financial event outside the billing bucket too', () => {
    const paidStatus = event('paid', 'status_change', '2026-10-09', '11:00', 'Ready to Bill → Paid', true)
    const rows = threadWithActivity(LINES, { [SEWER]: [paidStatus, WORKING] }, { on: true, noMoney: true })
    expect(rows.filter((r) => r.kind === 'activity').map(label)).toEqual([`Waiting → Working on ${SEWER}`])
  })

  it('keeps the line first when a line and a row come at the same moment', () => {
    const sameMinute = event('same', 'status_change', '2026-10-07', '08:14', 'Waiting → Working', false)
    const rows = threadWithActivity(LINES, { [SEWER]: [sameMinute] }, { on: true })
    const i = rows.findIndex((r) => r.kind === 'line' && r.message.id === 'approved')
    expect(rows[i + 1]?.kind).toBe('activity')
  })

  it('brings nothing for a tied job the caller has no activity for', () => {
    const rows = threadWithActivity(LINES, {}, { on: true })
    expect(rows.map(label)).toEqual(LINES.map((m) => m.id))
  })
})

describe('activityCounts', () => {
  it('counts by bucket and her lines alone', () => {
    const counts = activityCounts(threadWithActivity(LINES, ACTIVITY, { on: true }))
    expect(counts).toEqual({ all: 14, lines: 9, notes: 1, reports: 1, status: 1, billing: 1, crew: 1 })
  })

  it('counts nothing of the jobs with the switch off, and no billing at the tech’s door', () => {
    expect(activityCounts(threadWithActivity(LINES, ACTIVITY, { on: false }))).toEqual({
      all: 9,
      lines: 9,
      notes: 0,
      reports: 0,
      status: 0,
      billing: 0,
      crew: 0,
    })
    expect(activityCounts(threadWithActivity(LINES, ACTIVITY, { on: true, noMoney: true })).billing).toBe(0)
  })

  it('matches what each filter shows', () => {
    const rows = threadWithActivity(LINES, ACTIVITY, { on: true })
    const counts = activityCounts(rows)
    for (const f of ['all', 'lines', 'notes', 'reports', 'status', 'billing', 'crew'] as const) {
      expect(rows.filter((r) => threadRowMatches(r, f))).toHaveLength(counts[f])
    }
    expect(rows.filter((r) => threadRowMatches(r, 'notes')).map(label)).toEqual([`note on ${HEATER}`])
  })
})

describe('switchState', () => {
  const memory = () => {
    const kept = new Map<string, string>()
    return {
      kept,
      read: (k: string) => kept.get(k) ?? null,
      write: (k: string, v: string) => void kept.set(k, v),
    }
  }

  it('is on for the office and off on the phone until pressed', () => {
    const s = memory()
    expect(switchState(s.read, s.write, 'office').on).toBe(true)
    expect(switchState(s.read, s.write, 'phone').on).toBe(false)
  })

  it('keeps a press on this computer, one key per door', () => {
    const s = memory()
    expect(switchState(s.read, s.write, 'office').set(false)).toBe(false)
    expect(s.kept.get(JOB_ACTIVITY_SWITCH_KEY.office)).toBe('0')
    expect(switchState(s.read, s.write, 'office').on).toBe(false)
    expect(switchState(s.read, s.write, 'phone').on).toBe(false)
    switchState(s.read, s.write, 'phone').set(true)
    expect(switchState(s.read, s.write, 'phone').on).toBe(true)
    expect(switchState(s.read, s.write, 'office').on).toBe(false)
  })

  it('reads the door’s default when the storage throws or holds something else', () => {
    const refuse = () => {
      throw new Error('private window')
    }
    expect(switchState(refuse, refuse, 'office').on).toBe(true)
    expect(switchState(refuse, refuse, 'phone').on).toBe(false)
    expect(switchState(refuse, refuse, 'phone').set(true)).toBe(true)
    expect(switchState(() => 'yes', () => {}, 'phone').on).toBe(false)
  })
})
