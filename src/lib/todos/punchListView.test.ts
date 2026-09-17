import { describe, it, expect } from 'vitest'
import {
  countPicks,
  rowVisible,
  groupRows,
  nextPick,
  withPick,
  linkChips,
  versionSegments,
  parseLocalPicks,
  picksFromRows,
  byLine,
  historyHref,
  folderHref,
  mockupHref,
  waitingOnMockupCount,
  mockupStateLabel,
  type PickMap,
} from './punchListView'
import type { BoardItem } from './todoBoard'

const row = (over: Partial<BoardItem>): BoardItem => ({
  slug: 'gc-on-notice',
  group: 'close',
  name: 'Put a GC on notice',
  file: 'to-dos/gc-on-notice/README.md',
  pointer: false,
  summary: 's',
  next: 'n',
  size: 'XS',
  blocker: 'A live run.',
  ver: 'v2.3469 · 3470',
  mockups: ['to-dos/gc-on-notice/mockup.html'],
  artifacts: [{ label: 'design canvas', url: 'https://claude.ai/artifact/AbC123' }],
  mockup: 'has',
  mockupNote: '',
  ...over,
})

const A = row({})
const B = row({ slug: 'day-book', group: 'ready', file: 'to-dos/day-book/README.md', mockups: [] })
const FLAT = row({ slug: 'next-up', group: 'gated', file: 'to-dos/next-up.md', pointer: true, mockups: [], artifacts: [] })
const picks: PickMap = { 'gc-on-notice': { pick: 'do', note: '', at: '', by: '', byName: '' } }

describe('counts and filters', () => {
  it('counts open items only, by pick', () => {
    expect(countPicks([A, B, FLAT], picks)).toEqual({ all: 2, unsorted: 1, do: 1, later: 0, drop: 0 })
  })

  it('a standing list shows only under All; picks drive the rest', () => {
    expect(rowVisible(FLAT, picks, 'all')).toBe(true)
    expect(rowVisible(FLAT, picks, 'unsorted')).toBe(false)
    expect(rowVisible(A, picks, 'do')).toBe(true)
    expect(rowVisible(A, picks, 'unsorted')).toBe(false)
    expect(rowVisible(B, picks, 'unsorted')).toBe(true)
    expect(rowVisible(B, picks, 'later')).toBe(false)
  })

  it('the waiting-on-mock-up toggle narrows to rows without one, and counts them', () => {
    const waiting = row({ slug: 'w', mockups: [], mockup: 'waiting' })
    const none = row({ slug: 'n', mockups: [], mockup: 'not-required', mockupNote: 'a live test' })
    expect(waitingOnMockupCount([A, waiting, none, FLAT])).toBe(1)
    expect(rowVisible(A, picks, 'all', true)).toBe(false)
    expect(rowVisible(waiting, picks, 'all', true)).toBe(true)
    expect(rowVisible(waiting, picks, 'do', true)).toBe(false)
    expect(mockupStateLabel(waiting)).toBe('waiting on a mock-up')
    expect(mockupStateLabel(none)).toBe('mock-up not required — a live test')
    expect(mockupStateLabel(A)).toBe('')
  })

  it('groups in readiness order and drops empty groups', () => {
    expect(groupRows([A, B, FLAT]).map((g) => [g.group, g.items.length])).toEqual([
      ['ready', 1],
      ['close', 1],
      ['gated', 1],
    ])
  })

  it('a pick toggles off when clicked again', () => {
    expect(nextPick('', 'do')).toBe('do')
    expect(nextPick('do', 'do')).toBe('')
    expect(nextPick('do', 'later')).toBe('later')
  })

  it('withPick keeps the other field and stamps the time', () => {
    const r1 = withPick(undefined, { pick: 'do' }, '2026-09-17T10:00:00Z')
    expect(r1).toEqual({ pick: 'do', note: '', at: '2026-09-17T10:00:00Z', by: '', byName: '' })
    const r2 = withPick(r1, { note: 'start Monday' }, '2026-09-17T11:00:00Z', 'u1', 'Robert')
    expect(r2).toEqual({ pick: 'do', note: 'start Monday', at: '2026-09-17T11:00:00Z', by: 'u1', byName: 'Robert' })
  })
})

describe('links', () => {
  it('mock-ups are served at their repo path; history and folder point at GitHub', () => {
    expect(mockupHref('to-dos/gc-on-notice/mockup.html')).toBe('/to-dos/gc-on-notice/mockup.html')
    expect(historyHref(A)).toBe('https://github.com/clickconstruction/pipetooling.github.io/commits/main/to-dos/gc-on-notice')
    expect(historyHref(FLAT)).toBe('https://github.com/clickconstruction/pipetooling.github.io/commits/main/to-dos/next-up.md')
    expect(folderHref(A)).toBe('https://github.com/clickconstruction/pipetooling.github.io/tree/main/to-dos/gc-on-notice')
    expect(folderHref(FLAT)).toBeNull()
  })

  it('the chips: mock-ups, artifacts, history, then folder for a folder to-do', () => {
    expect(linkChips(A).map((c) => `${c.kind}:${c.label}`)).toEqual([
      'mockup:mockup',
      'artifact:design canvas',
      'history:history',
      'folder:folder',
    ])
    expect(linkChips(FLAT).map((c) => c.kind)).toEqual(['history'])
  })

  it('splits a version chip so each v2.NNNN links and the rest stays text', () => {
    expect(versionSegments('hook v2.3434 · hide for me v2.3524')).toEqual([
      { text: 'hook ', version: null },
      { text: 'v2.3434', version: 'v2.3434' },
      { text: ' · hide for me ', version: null },
      { text: 'v2.3524', version: 'v2.3524' },
    ])
    expect(versionSegments('standing')).toEqual([{ text: 'standing', version: null }])
  })
})

describe('shared picks', () => {
  it('reads rows with the name joined; an unknown pick reads as none', () => {
    const rows = [
      { slug: 'a', pick: 'later', note: 'after the deploy', updated_at: '2026-09-17T14:00:00Z', updated_by: 'u1', users: { name: 'Robert' } },
      { slug: 'b', pick: 'x', note: '', updated_at: '2026-09-17T14:00:00Z', updated_by: null, users: null },
    ]
    expect(picksFromRows(rows)).toEqual({
      a: { pick: 'later', note: 'after the deploy', at: '2026-09-17T14:00:00Z', by: 'u1', byName: 'Robert' },
      b: { pick: '', note: '', at: '2026-09-17T14:00:00Z', by: '', byName: '' },
    })
  })

  it('the by-line names the person and the day, or says nothing when nothing was picked', () => {
    expect(byLine(undefined)).toBe('')
    expect(byLine({ pick: '', note: '', at: '', by: '', byName: '' })).toBe('')
    expect(byLine({ pick: 'do', note: '', at: '2026-09-17T14:00:00Z', by: 'u1', byName: 'Robert' }, 'en-US')).toBe('Robert · Sep 17')
    expect(byLine({ pick: 'do', note: '', at: '2026-09-17T14:00:00Z', by: 'u1', byName: '' }, 'en-US')).toBe('Someone · Sep 17')
    expect(byLine({ pick: '', note: 'a note', at: '', by: '', byName: '' })).toBe('this device')
  })
})

describe('local picks', () => {
  it('reads what the old board wrote and ignores junk', () => {
    const raw = JSON.stringify({ a: { pick: 'do', note: 'x', at: 't' }, b: { pick: 'nope' }, c: 3 })
    expect(parseLocalPicks(raw)).toEqual({
      a: { pick: 'do', note: 'x', at: 't', by: '', byName: '' },
      b: { pick: '', note: '', at: '', by: '', byName: '' },
    })
    expect(parseLocalPicks(null)).toEqual({})
    expect(parseLocalPicks('{')).toEqual({})
  })
})
