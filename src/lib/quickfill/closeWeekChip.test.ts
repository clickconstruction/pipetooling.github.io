import { describe, expect, it } from 'vitest'
import {
  CLOSE_WEEK_INERT_TEXT,
  CLOSE_WEEK_STATION_QUEUES,
  canOpenMoneyfill,
  closeWeekChipModel,
  isCloseWeekStation,
  weekCloseOpenedTarget,
} from './closeWeekChip'
import { MONEYFILL_QUEUE_LABELS, type MoneyfillQueueCount, type MoneyfillQueueKey } from '../moneyfillWeekClose'

const WEEK = '2026-08-24'

function q(key: MoneyfillQueueKey, count: number | null, dollars: number | null = null): MoneyfillQueueCount {
  return { key, label: MONEYFILL_QUEUE_LABELS[key], count, dollars }
}

const COUNTS: MoneyfillQueueCount[] = [
  q('bank-transfers', 2, 11_980),
  q('card-charges', 19, 4_312.4),
  q('deposits-unapplied', 17, 90_000),
  q('time-no-job', 0, 0),
  q('pending-approval', 64, 18_240),
  q('supply-invoices', 2, 239.4),
  q('no-pct-report', 3, null),
  q('no-job-total', 1, null),
]

describe('closeWeekChip — station → queue map', () => {
  it('only the four money stations get a chip; every mapped queue key is real', () => {
    expect(Object.keys(CLOSE_WEEK_STATION_QUEUES).sort()).toEqual(['banking-sorting', 'people-hours-new', 'supply-houses', 'unassigned-field-time'])
    for (const keys of Object.values(CLOSE_WEEK_STATION_QUEUES)) {
      for (const k of keys) expect(MONEYFILL_QUEUE_LABELS[k]).toBeTruthy()
    }
    expect(isCloseWeekStation('supply-houses')).toBe(true)
    expect(isCloseWeekStation('schedule')).toBe(false)
    expect(closeWeekChipModel('schedule', COUNTS, WEEK, 'dev')).toBeNull()
  })

  it('mirrors the Moneyfill route gate', () => {
    expect(canOpenMoneyfill('dev')).toBe(true)
    expect(canOpenMoneyfill('controller')).toBe(true)
    expect(canOpenMoneyfill('assistant')).toBe(false)
    expect(canOpenMoneyfill('master_technician')).toBe(false)
    expect(canOpenMoneyfill(null)).toBe(false)
  })
})

describe('closeWeekChipModel', () => {
  it('non-money roles get inert copy — no link into a page that would redirect them', () => {
    const m = closeWeekChipModel('supply-houses', COUNTS, WEEK, 'assistant')
    expect(m).toEqual({ kind: 'inert', text: CLOSE_WEEK_INERT_TEXT, title: expect.stringContaining("today's check") })
    expect(m && 'href' in m).toBe(false)
  })

  it('reads the dollars the close still has open for the station, pinned to the week', () => {
    const m = closeWeekChipModel('supply-houses', COUNTS, WEEK, 'controller')
    expect(m?.kind).toBe('open')
    expect(m?.text).toBe('Close week: $239 open')
    expect(m && 'href' in m ? m.href : null).toBe('/moneyfill?week=2026-08-24')
    expect(m?.title).toContain('Week of Aug 24 – 30')
    expect(m?.title).toContain('(2 items)')
  })

  it('sums a station that feeds two queues (banking sorting: card charges + bank transfers)', () => {
    const m = closeWeekChipModel('banking-sorting', COUNTS, WEEK, 'dev')
    expect(m?.text).toBe('Close week: $16,292 open')
    expect(m?.title).toContain('(21 items)')
  })

  it('count-only queues show the count', () => {
    const m = closeWeekChipModel('people-hours-new', [q('pending-approval', 3, null)], WEEK, 'dev')
    expect(m?.text).toBe('Close week: 3 open')
  })

  it('clear when every mapped queue is at zero; loading and unknown never read as clear', () => {
    expect(closeWeekChipModel('unassigned-field-time', COUNTS, WEEK, 'dev')?.kind).toBe('clear')
    expect(closeWeekChipModel('unassigned-field-time', COUNTS, WEEK, 'dev')?.text).toBe('Close week: clear')
    expect(closeWeekChipModel('unassigned-field-time', null, WEEK, 'dev')?.kind).toBe('loading')
    expect(closeWeekChipModel('supply-houses', [q('supply-invoices', null)], WEEK, 'dev')?.kind).toBe('unknown')
    // A queue missing from the registry is unknown too, not zero.
    expect(closeWeekChipModel('banking-sorting', [q('card-charges', 0, 0)], WEEK, 'dev')?.kind).toBe('unknown')
  })
})

describe('weekCloseOpenedTarget', () => {
  it('names the door and the week', () => {
    expect(weekCloseOpenedTarget('moneyfill-report', WEEK)).toBe('report 2026-08-24')
    expect(weekCloseOpenedTarget('station-chip', WEEK, 'supply-houses')).toBe('#supply-houses 2026-08-24')
  })
})
