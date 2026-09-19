import { describe, expect, it } from 'vitest'
import {
  BOARD_SNAPSHOT_MAX_AGE_MS,
  boardSnapshotIsUsable,
  buildBoardSnapshot,
  describeBoardSnapshotAge,
  parseBoardSnapshot,
} from './boardSnapshot'
import type { JobWithDetails } from '../../types/jobWithDetails'

const job = (id: string, status = 'working') => ({ id, status }) as unknown as JobWithDetails

const snap = () => ({
  key: 'u1:all',
  scopes: ['waiting', 'working', 'ready_to_bill', 'billed_all'] as const,
  savedAt: 1_000_000,
  jobs: [job('a'), job('b')],
})

describe('boardSnapshotIsUsable', () => {
  it('paints a same-key board younger than the line that covers every wanted scope', () => {
    expect(BOARD_SNAPSHOT_MAX_AGE_MS).toBe(86_400_000)
    expect(
      boardSnapshotIsUsable({
        snapshot: { ...snap(), scopes: [...snap().scopes] },
        key: 'u1:all',
        wantedScopes: ['ready_to_bill', 'working'],
        now: 1_000_000 + 6 * 3_600_000,
      }),
    ).toBe(true)
  })
  it('refuses another key, a missing scope, a board on or over the line, or one from the future', () => {
    const s = { ...snap(), scopes: [...snap().scopes] }
    const ok = { snapshot: s, key: 'u1:all', wantedScopes: ['working'] as const, now: 1_500_000 }
    expect(boardSnapshotIsUsable({ ...ok, key: 'u1:cust-9' })).toBe(false)
    expect(boardSnapshotIsUsable({ ...ok, snapshot: { ...s, scopes: ['working'] }, wantedScopes: ['ready_to_bill'] })).toBe(false)
    expect(boardSnapshotIsUsable({ ...ok, now: 1_000_000 + BOARD_SNAPSHOT_MAX_AGE_MS })).toBe(false)
    expect(boardSnapshotIsUsable({ ...ok, now: 1_000_000 + BOARD_SNAPSHOT_MAX_AGE_MS - 1 })).toBe(true)
    expect(boardSnapshotIsUsable({ ...ok, now: 999_999 })).toBe(false)
    expect(boardSnapshotIsUsable({ ...ok, snapshot: null })).toBe(false)
    expect(boardSnapshotIsUsable({ ...ok, maxAgeMs: 1_000 })).toBe(false)
  })
  it('never requires the paid scope', () => {
    const s = { ...snap(), scopes: [...snap().scopes] }
    expect(boardSnapshotIsUsable({ snapshot: s, key: 'u1:all', wantedScopes: ['working', 'paid'], now: 1_500_000 })).toBe(true)
  })
})

describe('buildBoardSnapshot', () => {
  it('drops the paid scope and paid rows', () => {
    const built = buildBoardSnapshot({
      key: 'u1:all',
      scopes: ['working', 'paid'],
      jobs: [job('a'), job('p', 'paid'), job('n', null as unknown as string)],
      now: 42,
    })
    expect(built).toEqual({ key: 'u1:all', scopes: ['working'], savedAt: 42, jobs: [job('a'), job('n', null as unknown as string)] })
  })
})

describe('parseBoardSnapshot', () => {
  it('accepts the stored shape and rejects anything off', () => {
    expect(parseBoardSnapshot({ ...snap(), scopes: [...snap().scopes] })).toEqual({ ...snap(), scopes: [...snap().scopes] })
    expect(parseBoardSnapshot(null)).toBeNull()
    expect(parseBoardSnapshot({ ...snap(), key: '' })).toBeNull()
    expect(parseBoardSnapshot({ ...snap(), savedAt: 'yesterday' })).toBeNull()
    expect(parseBoardSnapshot({ ...snap(), scopes: ['everything'] })).toBeNull()
    expect(parseBoardSnapshot({ ...snap(), jobs: [{ noId: true }] })).toBeNull()
    expect(parseBoardSnapshot({ ...snap(), jobs: 'rows' })).toBeNull()
  })
})

describe('describeBoardSnapshotAge', () => {
  it('rounds to the unit a person would say', () => {
    expect(describeBoardSnapshotAge(1_000, 1_000 + 20_000)).toBe('just now')
    expect(describeBoardSnapshotAge(1_000, 1_000 + 4 * 60_000)).toBe('4 min ago')
    expect(describeBoardSnapshotAge(1_000, 1_000 + 6 * 3_600_000)).toBe('6 h ago')
    expect(describeBoardSnapshotAge(1_000, 1_000 + 23.4 * 3_600_000)).toBe('23 h ago')
    expect(describeBoardSnapshotAge(1_000, 1_000 + 23.6 * 3_600_000)).toBe('yesterday')
    expect(describeBoardSnapshotAge(5_000, 1_000)).toBe('just now')
  })
})
