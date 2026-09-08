import { describe, expect, it } from 'vitest'
import {
  availabilityLabel,
  buildDayStrip,
  cardTargetState,
  dayStripCaption,
  formatLongRange,
  formatShortRange,
  initialBoardYmd,
  intervalsOverlap,
  linkedWithCaption,
  modeBarText,
  PHONE_PEOPLE_VIEW_STORAGE_KEY,
  readPhonePeopleView,
  resolvePhonePeopleView,
  ribbonSpan,
  teamBandCaption,
  timeToMinutes,
  weekdayOfYmd,
  writePhonePeopleView,
  type PhonePlacementMode,
} from './phonePeopleBoard'

function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m }
}

describe('view preference', () => {
  it('is unset until picked, remembers either pick, and survives a broken storage', () => {
    expect(readPhonePeopleView(fakeStorage())).toBeNull()
    const s = fakeStorage()
    writePhonePeopleView(s, 'grid')
    expect(s.map.get(PHONE_PEOPLE_VIEW_STORAGE_KEY)).toBe('grid')
    expect(readPhonePeopleView(s)).toBe('grid')
    writePhonePeopleView(s, 'board')
    expect(readPhonePeopleView(s)).toBe('board')
    expect(readPhonePeopleView(null)).toBeNull()
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readPhonePeopleView(throwing)).toBeNull()
    expect(() => writePhonePeopleView(throwing, 'grid')).not.toThrow()
  })
  it('an explicit pick wins at any width; unset follows the viewport', () => {
    // A phone rotated to landscape (844px) keeps the board it asked for; a portrait tablet can ask for it.
    expect(resolvePhonePeopleView('board', false)).toBe('board')
    expect(resolvePhonePeopleView('grid', true)).toBe('grid')
    expect(resolvePhonePeopleView(null, true)).toBe('board')
    expect(resolvePhonePeopleView(null, false)).toBe('grid')
  })
})

describe('time helpers', () => {
  it('parses HH:MM and HH:MM:SS, rejects junk', () => {
    expect(timeToMinutes('08:00')).toBe(480)
    expect(timeToMinutes('12:30:00')).toBe(750)
    expect(timeToMinutes('')).toBeNull()
    expect(timeToMinutes('noon')).toBeNull()
    expect(timeToMinutes(null)).toBeNull()
  })
  it('prints the short ranges the card uses', () => {
    expect(formatShortRange(480, 720)).toBe('8–12')
    expect(formatShortRange(720, 960)).toBe('12–4')
    expect(formatShortRange(510, 720)).toBe('8:30–12')
    expect(formatShortRange(null, 720)).toBe('—')
    expect(formatLongRange(720, 960)).toBe('12:00 PM–4:00 PM')
    expect(formatLongRange(null, null)).toBe('all day')
  })
  it('overlap is half-open, and the ribbon clamps to 6 AM–6 PM', () => {
    expect(intervalsOverlap(480, 720, 720, 960)).toBe(false)
    expect(intervalsOverlap(480, 721, 720, 960)).toBe(true)
    expect(ribbonSpan(480, 720)).toEqual({ leftPct: (120 / 720) * 100, widthPct: (240 / 720) * 100 })
    expect(ribbonSpan(300, 400)).toEqual({ leftPct: 0, widthPct: (40 / 720) * 100 })
    expect(ribbonSpan(1200, 1300)).toBeNull()
    expect(ribbonSpan(null, 720)).toBeNull()
  })
})

describe('day strip', () => {
  const week = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
  it('names the weekday without timezone drift and captions the counts', () => {
    expect(weekdayOfYmd('2026-09-07')).toBe('Mon')
    expect(weekdayOfYmd('2026-09-13')).toBe('Sun')
    expect(dayStripCaption(undefined)).toBe('—')
    expect(dayStripCaption({ blocks: 1, missingNotes: 0 })).toBe('1 block')
    expect(dayStripCaption({ blocks: 6, missingNotes: 0 })).toBe('6 blocks')
    expect(dayStripCaption({ blocks: 5, missingNotes: 2 })).toBe('5 · 2 no note')
  })
  it('marks today and the selected day', () => {
    const strip = buildDayStrip({ weekYmds: week, todayYmd: '2026-09-08', selectedYmd: '2026-09-09', countsByYmd: new Map([['2026-09-08', { blocks: 5, missingNotes: 2 }]]) })
    expect(strip.map((d) => d.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(strip[1]).toMatchObject({ dayNumber: 8, isToday: true, isSelected: false, caption: '5 · 2 no note' })
    expect(strip[2]).toMatchObject({ dayNumber: 9, isToday: false, isSelected: true, caption: '—' })
  })
  it('opens on the preferred day, else today, else the first day', () => {
    expect(initialBoardYmd({ weekYmds: week, todayYmd: '2026-09-08', preferredYmd: '2026-09-10' })).toBe('2026-09-10')
    expect(initialBoardYmd({ weekYmds: week, todayYmd: '2026-09-08', preferredYmd: '2026-09-20' })).toBe('2026-09-08')
    expect(initialBoardYmd({ weekYmds: week, todayYmd: '2026-09-20' })).toBe('2026-09-07')
  })
})

describe('card target state', () => {
  const copy: PhonePlacementMode = { kind: 'copy', label: 'J927 · Mike Holub', startMinutes: 720, endMinutes: 960, sourceUserIds: new Set(['abraham']), linked: true }
  it('the source tech is not a target', () => {
    const s = cardTargetState({ mode: copy, userId: 'abraham', dayBlocks: [] })
    expect(s.tone).toBe('source')
    expect(s.tappable).toBe(false)
    expect(s.what).toBe('Already on J927 · Mike Holub 12–4')
  })
  it('a free tech says what will land and what else they have', () => {
    const s = cardTargetState({ mode: copy, userId: 'paige', dayBlocks: [{ label: 'J650', startMinutes: 480, endMinutes: 720 }] })
    expect(s).toEqual({ tone: 'free', what: 'Tap to add J927 · Mike Holub · 12–4 here', why: 'Also on J650 8–12', tappable: true })
    expect(cardTargetState({ mode: copy, userId: 'marcus', dayBlocks: [] }).why).toBe('Nothing scheduled this day')
  })
  it('a clash reads busy but stays tappable, with Undo promised', () => {
    const s = cardTargetState({ mode: copy, userId: 'taunya', dayBlocks: [{ label: 'J000 Office', startMinutes: 480, endMinutes: 1020 }] })
    expect(s.tone).toBe('busy')
    expect(s.what).toBe('Busy 8–5 · J000 Office')
    expect(s.tappable).toBe(true)
  })
  it('move says move; not coming in reads busy; multi-cell has its own two states', () => {
    const move: PhonePlacementMode = { ...copy, kind: 'move', sourceUserIds: new Set() }
    expect(cardTargetState({ mode: move, userId: 'paige', dayBlocks: [] }).what).toBe('Tap to move J927 · Mike Holub · 12–4 here')
    expect(cardTargetState({ mode: copy, userId: 'x', dayBlocks: [], notComingIn: true }).what).toBe('Not coming in today')
    const multi: PhonePlacementMode = { kind: 'multi-cell', label: '', startMinutes: null, endMinutes: null, sourceUserIds: new Set() }
    expect(cardTargetState({ mode: multi, userId: 'x', dayBlocks: [] }).what).toBe('Tap to add this tech and day')
    expect(cardTargetState({ mode: multi, userId: 'x', dayBlocks: [], multiSelected: true }).tone).toBe('selected')
  })
  it('multi-cell refuses a tech marked not coming in (like the grid), but still lets a selected one be taken off', () => {
    const multi: PhonePlacementMode = { kind: 'multi-cell', label: '', startMinutes: null, endMinutes: null, sourceUserIds: new Set() }
    const off = cardTargetState({ mode: multi, userId: 'x', dayBlocks: [], notComingIn: true })
    expect(off).toMatchObject({ tone: 'busy', what: 'Not coming in today', tappable: false })
    expect(cardTargetState({ mode: multi, userId: 'x', dayBlocks: [], notComingIn: true, multiSelected: true }).tappable).toBe(true)
  })
  it('a move reads its own cell as "where it is now", not as a clash with itself', () => {
    const move: PhonePlacementMode = { ...copy, kind: 'move', sourceUserIds: new Set() }
    const own = { label: 'J927 · Mike Holub', startMinutes: 720, endMinutes: 960 }
    const source = cardTargetState({ mode: move, userId: 'abraham', dayBlocks: [own], isSourceCell: true })
    expect(source).toMatchObject({ tone: 'source', what: 'Where it is now', tappable: false })
    // Same tech, another day: a plain target.
    expect(cardTargetState({ mode: move, userId: 'abraham', dayBlocks: [] }).tone).toBe('free')
  })
  it('a solo copy does not refuse the source tech (only a linked one does)', () => {
    const solo: PhonePlacementMode = { ...copy, linked: false, sourceUserIds: new Set() }
    expect(cardTargetState({ mode: solo, userId: 'abraham', dayBlocks: [] })).toMatchObject({ tone: 'free', tappable: true })
  })
  it('blocks the viewer cannot see make the day busy, not free', () => {
    const s = cardTargetState({ mode: copy, userId: 'paige', dayBlocks: [], hiddenCount: 2 })
    expect(s.tone).toBe('busy')
    expect(s.what).toBe("Busy · 2 blocks you can't see")
    expect(s.tappable).toBe(true)
    expect(cardTargetState({ mode: copy, userId: 'paige', dayBlocks: [], hiddenCount: 0 }).why).toBe('Nothing scheduled this day')
  })
})

describe('chrome copy', () => {
  it('mode bar wording per mode', () => {
    expect(modeBarText({ kind: 'copy', label: 'J927', startMinutes: 720, endMinutes: 960, sourceUserIds: new Set(), linked: true })).toEqual({ text: 'Copying J927 · 12–4 to…', suffix: 'linked' })
    expect(modeBarText({ kind: 'move', label: 'J927', startMinutes: 720, endMinutes: 960, sourceUserIds: new Set() })).toEqual({ text: 'Moving J927 · 12–4 to…', suffix: null })
    expect(modeBarText({ kind: 'add-job', label: 'J650', startMinutes: null, endMinutes: null, sourceUserIds: new Set() })).toEqual({ text: 'Adding J650 to…', suffix: null })
    expect(modeBarText({ kind: 'linked-apply', label: 'J927', startMinutes: 720, endMinutes: 960, sourceUserIds: new Set(), linked: true, count: 3 }).text).toBe('Copying 3 blocks to… · tap each tech')
    expect(modeBarText({ kind: 'multi-cell', label: '', startMinutes: null, endMinutes: null, sourceUserIds: new Set() }).text).toMatch(/^Tap each tech and day/)
  })
  it('team band, linked-with and availability captions', () => {
    expect(teamBandCaption(1, 1)).toBe('1 person · 1 block')
    expect(teamBandCaption(2, 3)).toBe('2 people · 3 blocks')
    expect(linkedWithCaption(['Abraham', 'Paige'], 'Abraham')).toBe('linked with Paige')
    expect(linkedWithCaption(['Abraham'], 'Abraham')).toBeNull()
    const window = { startMinutes: 720, endMinutes: 960 }
    expect(availabilityLabel({ window, dayBlocks: [] })).toEqual({ text: 'free all day', free: true })
    expect(availabilityLabel({ window, dayBlocks: [{ label: 'J650', startMinutes: 480, endMinutes: 720 }] })).toEqual({ text: 'free 12–4', free: true })
    expect(availabilityLabel({ window, dayBlocks: [{ label: 'Office', startMinutes: 480, endMinutes: 1020 }] })).toEqual({ text: 'busy 8–5', free: false })
  })
})
