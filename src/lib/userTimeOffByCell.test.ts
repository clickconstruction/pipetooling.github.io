import { describe, expect, it } from 'vitest'
import {
  buildUserTimeOffByCell,
  pickUserTimeOffRowForCell,
  userTimeOffCellKey,
  userTimeOffInfoFromRow,
  type UserTimeOffRow,
} from './userTimeOffByCell'
import { NOT_COMING_IN_NOTE } from './notComingInTimeOff'

const baseRow = (overrides: Partial<UserTimeOffRow>): UserTimeOffRow => ({
  id: 'r1',
  user_id: 'u1',
  start_date: '2026-05-18',
  end_date: '2026-05-18',
  kind: 'unpaid',
  note: null,
  ...overrides,
})

describe('userTimeOffCellKey', () => {
  it('joins user id and date with a tab', () => {
    expect(userTimeOffCellKey('u1', '2026-05-18')).toBe('u1\t2026-05-18')
  })
})

describe('pickUserTimeOffRowForCell', () => {
  it('returns null when no rows', () => {
    expect(pickUserTimeOffRowForCell([])).toBeNull()
  })

  it('prefers a Not coming in single-day row over a multi-day PTO range', () => {
    const pto = baseRow({
      id: 'pto',
      start_date: '2026-05-15',
      end_date: '2026-05-22',
      kind: 'pto',
      note: 'Vacation',
    })
    const nci = baseRow({ id: 'nci', note: NOT_COMING_IN_NOTE })
    const picked = pickUserTimeOffRowForCell([pto, nci])
    expect(picked?.id).toBe('nci')
  })

  it('prefers single-day rows over multi-day rows when neither is Not coming in', () => {
    const range = baseRow({
      id: 'range',
      start_date: '2026-05-15',
      end_date: '2026-05-22',
      note: 'Out of town',
    })
    const single = baseRow({ id: 'single', note: 'Sick' })
    const picked = pickUserTimeOffRowForCell([range, single])
    expect(picked?.id).toBe('single')
  })
})

describe('userTimeOffInfoFromRow', () => {
  it('classifies a single-day Not coming in note as not_coming_in variant', () => {
    const info = userTimeOffInfoFromRow(baseRow({ note: NOT_COMING_IN_NOTE }))
    expect(info.variant).toBe('not_coming_in')
    expect(info.label).toBe('Not coming in')
    expect(info.note).toBe(NOT_COMING_IN_NOTE)
  })

  it('classifies a multi-day Not coming in row as plain time_off (range, not the action)', () => {
    const info = userTimeOffInfoFromRow(
      baseRow({ start_date: '2026-05-15', end_date: '2026-05-22', note: NOT_COMING_IN_NOTE }),
    )
    expect(info.variant).toBe('time_off')
    expect(info.label).toBe('Off')
  })

  it('classifies a single-day non-NCI note as time_off variant', () => {
    const info = userTimeOffInfoFromRow(baseRow({ note: 'Vacation' }))
    expect(info.variant).toBe('time_off')
    expect(info.label).toBe('Off')
  })

  it('falls back to time_off when note is null', () => {
    const info = userTimeOffInfoFromRow(baseRow({ note: null }))
    expect(info.variant).toBe('time_off')
    expect(info.note).toBeNull()
  })
})

describe('buildUserTimeOffByCell', () => {
  const dayKeys = [
    '2026-05-17',
    '2026-05-18',
    '2026-05-19',
    '2026-05-20',
    '2026-05-21',
    '2026-05-22',
    '2026-05-23',
  ]

  it('returns an empty map when no rows', () => {
    const map = buildUserTimeOffByCell([], dayKeys)
    expect(map.size).toBe(0)
  })

  it('returns an empty map when no day keys', () => {
    const rows: UserTimeOffRow[] = [baseRow({ note: NOT_COMING_IN_NOTE })]
    const map = buildUserTimeOffByCell(rows, [])
    expect(map.size).toBe(0)
  })

  it('marks each day in a multi-day PTO range', () => {
    const rows: UserTimeOffRow[] = [
      baseRow({
        id: 'pto',
        user_id: 'u1',
        start_date: '2026-05-19',
        end_date: '2026-05-22',
        kind: 'pto',
        note: 'Vacation',
      }),
    ]
    const map = buildUserTimeOffByCell(rows, dayKeys)
    expect(map.has(userTimeOffCellKey('u1', '2026-05-18'))).toBe(false)
    expect(map.has(userTimeOffCellKey('u1', '2026-05-19'))).toBe(true)
    expect(map.has(userTimeOffCellKey('u1', '2026-05-20'))).toBe(true)
    expect(map.has(userTimeOffCellKey('u1', '2026-05-21'))).toBe(true)
    expect(map.has(userTimeOffCellKey('u1', '2026-05-22'))).toBe(true)
    expect(map.has(userTimeOffCellKey('u1', '2026-05-23'))).toBe(false)
    const cell = map.get(userTimeOffCellKey('u1', '2026-05-20'))
    expect(cell?.variant).toBe('time_off')
    expect(cell?.label).toBe('Off')
  })

  it('marks a single-day Not coming in entry as the not_coming_in variant', () => {
    const rows: UserTimeOffRow[] = [
      baseRow({
        id: 'nci',
        user_id: 'u2',
        start_date: '2026-05-20',
        end_date: '2026-05-20',
        note: NOT_COMING_IN_NOTE,
      }),
    ]
    const map = buildUserTimeOffByCell(rows, dayKeys)
    const cell = map.get(userTimeOffCellKey('u2', '2026-05-20'))
    expect(cell?.variant).toBe('not_coming_in')
    expect(cell?.label).toBe('Not coming in')
    expect(map.has(userTimeOffCellKey('u2', '2026-05-19'))).toBe(false)
  })

  it('prefers Not coming in entry when a longer PTO range overlaps the same day', () => {
    const rows: UserTimeOffRow[] = [
      baseRow({
        id: 'pto',
        user_id: 'u3',
        start_date: '2026-05-19',
        end_date: '2026-05-22',
        kind: 'pto',
        note: 'Vacation',
      }),
      baseRow({
        id: 'nci',
        user_id: 'u3',
        start_date: '2026-05-20',
        end_date: '2026-05-20',
        note: NOT_COMING_IN_NOTE,
      }),
    ]
    const map = buildUserTimeOffByCell(rows, dayKeys)
    expect(map.get(userTimeOffCellKey('u3', '2026-05-20'))?.variant).toBe('not_coming_in')
    // Other PTO days remain time_off variant
    expect(map.get(userTimeOffCellKey('u3', '2026-05-21'))?.variant).toBe('time_off')
  })

  it('keeps users isolated', () => {
    const rows: UserTimeOffRow[] = [
      baseRow({ id: 'a', user_id: 'u1', note: NOT_COMING_IN_NOTE }),
      baseRow({ id: 'b', user_id: 'u2', start_date: '2026-05-19', end_date: '2026-05-19' }),
    ]
    const map = buildUserTimeOffByCell(rows, dayKeys)
    expect(map.size).toBe(2)
    expect(map.get(userTimeOffCellKey('u1', '2026-05-18'))?.variant).toBe('not_coming_in')
    expect(map.get(userTimeOffCellKey('u2', '2026-05-19'))?.variant).toBe('time_off')
    expect(map.has(userTimeOffCellKey('u1', '2026-05-19'))).toBe(false)
    expect(map.has(userTimeOffCellKey('u2', '2026-05-18'))).toBe(false)
  })
})
