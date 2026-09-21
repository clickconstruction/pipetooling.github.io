import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  QUICK_ADD_DEFAULT_DAILY_CEILING,
  QUICK_ADD_ROLES,
  QUICK_ADD_SENTENCES,
  canUseQuickAdd,
  quickAddAgoLabel,
  quickAddButtonLabel,
  quickAddNote,
  tapQuickAddCell,
  isQuickAddLength,
  quickAddCeilingSentence,
  quickAddClash,
  quickAddEntryLine,
  quickAddRefusal,
  quickAddWindow,
  stepQuickAddMinutes,
  weeklyQuickAddLine,
  type QuickAddDraft,
} from './quickTimeAdd'

const MIGRATION = readFileSync('supabase/migrations/20260921042405_clock_sessions_quick_add.sql', 'utf8')
const MIN = 60_000
// 2026-09-21 19:50 on a plain UTC clock: the kernel takes its calendar from `dayOf`.
const NOW = Date.UTC(2026, 8, 21, 19, 50, 30)
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const formatTime = (ms: number) => new Date(ms).toISOString().slice(11, 16)
const draft = (over: Partial<QuickAddDraft> = {}): QuickAddDraft => ({ minutes: 10, note: 'Call with Acme', endedAtMs: NOW, nowMs: NOW, dayOf, formatTime, sessions: [], dayTotalMinutes: 0, ...over })

describe('quickTimeAdd — the kernel says what the database says', () => {
  it('uses the RPC’s own sentences, word for word', () => {
    const sql = MIGRATION.replace(/''/g, "'")
    for (const sentence of Object.values(QUICK_ADD_SENTENCES)) expect(sql).toContain(sentence)
    // the two built sentences, by their fixed halves
    expect(sql).toContain('You already have hours % – %. Pick an end time outside that, or edit that day on My Time.')
    expect(sql).toContain('That would be % minutes of quick adds today (the most is %). If you are working a stretch, clock in instead.')
  })

  it('agrees with the RPC on who, how long, and the default ceiling', () => {
    expect(MIGRATION).toContain(`v_user.role NOT IN (${QUICK_ADD_ROLES.map((r) => `'${r}'`).join(', ')})`)
    expect(MIGRATION).toContain('p_minutes NOT IN (5, 10, 15, 20, 25, 30)')
    expect(MIGRATION).toContain(`VALUES ('quick_add_daily_ceiling_minutes', ${QUICK_ADD_DEFAULT_DAILY_CEILING})`)
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    // the CHECK is added NOT VALID then validated, so the busiest table is never scanned under ACCESS EXCLUSIVE
    expect(MIGRATION).toMatch(/NOT VALID;[\s\S]*VALIDATE CONSTRAINT clock_sessions_quick_add_minutes_check/)
  })
})

describe('quickTimeAdd — the stepper and the door', () => {
  it('+5 and −5 move in fives, stop at 0 and at 30', () => {
    expect(stepQuickAddMinutes(0, 1)).toBe(5)
    expect(stepQuickAddMinutes(5, 1)).toBe(10)
    expect(stepQuickAddMinutes(30, 1)).toBe(30)
    expect(stepQuickAddMinutes(0, -1)).toBe(0)
    expect(stepQuickAddMinutes(7, 1)).toBe(10) // a stray value snaps to the grid first
    expect(stepQuickAddMinutes(Number.NaN, 1)).toBe(5)
    expect([5, 10, 15, 20, 25, 30].every(isQuickAddLength)).toBe(true)
    expect([0, 7, 35, 10.5, -5].some(isQuickAddLength)).toBe(false)
  })

  it('is for hourly office roles, off the clock', () => {
    const me = { role: 'assistant', isSalary: false, recordsHoursButSalary: false, readOnly: false, clockedIn: false }
    expect(canUseQuickAdd(me)).toBe(true)
    expect(canUseQuickAdd({ ...me, role: 'estimator' })).toBe(true)
    expect(canUseQuickAdd({ ...me, role: 'helpers' })).toBe(false)
    expect(canUseQuickAdd({ ...me, role: 'master_technician' })).toBe(false) // owner call 1's default
    expect(canUseQuickAdd({ ...me, role: null })).toBe(false)
    expect(canUseQuickAdd({ ...me, clockedIn: true })).toBe(false) // that time is already counting
    expect(canUseQuickAdd({ ...me, readOnly: true })).toBe(false)
    expect(canUseQuickAdd({ ...me, isSalary: true })).toBe(false)
    expect(canUseQuickAdd({ ...me, isSalary: true, recordsHoursButSalary: true })).toBe(true) // they punch like anyone
  })
})

describe('quickTimeAdd — the composer', () => {
  it('a cell jumps there; the lit last cell steps back, so the bar needs no −5', () => {
    expect(tapQuickAddCell(0, 10)).toBe(10)
    expect(tapQuickAddCell(10, 25)).toBe(25)
    expect(tapQuickAddCell(25, 10)).toBe(10)
    expect(tapQuickAddCell(10, 10)).toBe(5)
    expect(tapQuickAddCell(5, 5)).toBe(0)
    expect(tapQuickAddCell(10, 7)).toBe(10) // not a cell
  })

  it('writes the note as kind — words, and the button says the number back', () => {
    expect(quickAddNote('Call', '  Acme,   the Oak St invoice ')).toBe('Call — Acme, the Oak St invoice')
    expect(quickAddNote('Email', 'x'.repeat(500))).toHaveLength(200)
    expect(quickAddButtonLabel(0, 'anything')).toBe('Add time')
    expect(quickAddButtonLabel(10, '')).toBe('Add 10 min — say what it was')
    expect(quickAddButtonLabel(10, ' ab ')).toBe('Add 10 min — say what it was')
    expect(quickAddButtonLabel(10, 'Acme')).toBe('Add 10 min')
    expect([0, 15, 60, 120].map(quickAddAgoLabel)).toEqual(['just now', '15 min ago', '1 h ago', '2 h ago'])
  })
})

describe('quickTimeAdd — the window and what it refuses', () => {
  it('ends on the minute it was said to end and starts that many minutes before', () => {
    const w = quickAddWindow(NOW, 10)
    expect(formatTime(w.endMs)).toBe('19:50')
    expect(formatTime(w.startMs)).toBe('19:40')
    expect(quickAddEntryLine(10, NOW, formatTime)).toBe('Adds 19:40 – 19:50 today · 10 min · Office')
    expect(quickAddEntryLine(0, NOW, formatTime)).toBeNull()
  })

  it('passes a clean draft, and refuses in the RPC’s order', () => {
    expect(quickAddRefusal(draft())).toBeNull()
    expect(quickAddRefusal(draft({ minutes: 7 }))).toBe(QUICK_ADD_SENTENCES.shape)
    expect(quickAddRefusal(draft({ minutes: 7, note: '' }))).toBe(QUICK_ADD_SENTENCES.shape) // length before note
    expect(quickAddRefusal(draft({ note: '  a ' }))).toBe(QUICK_ADD_SENTENCES.note)
  })

  it('is for today: not the future, not yesterday, not a window that starts yesterday', () => {
    expect(quickAddRefusal(draft({ endedAtMs: NOW + 5 * MIN }))).toBe(QUICK_ADD_SENTENCES.today)
    expect(quickAddRefusal(draft({ endedAtMs: NOW - 24 * 60 * MIN }))).toBe(QUICK_ADD_SENTENCES.today)
    const justAfterMidnight = Date.UTC(2026, 8, 21, 0, 4)
    expect(quickAddRefusal(draft({ nowMs: justAfterMidnight, endedAtMs: justAfterMidnight, minutes: 10 }))).toBe(QUICK_ADD_SENTENCES.today)
    expect(quickAddRefusal(draft({ endedAtMs: NOW + 30_000 }))).toBeNull() // a clock a few seconds fast is not the future
  })

  it('never lands on hours already there, and names them', () => {
    const shift = { clockedInMs: Date.UTC(2026, 8, 21, 8, 2), clockedOutMs: Date.UTC(2026, 8, 21, 16, 31) }
    expect(quickAddRefusal(draft({ sessions: [shift] }))).toBeNull() // 19:40–19:50 is clear of 08:02–16:31
    const overlapping = draft({ sessions: [shift], endedAtMs: Date.UTC(2026, 8, 21, 16, 35) })
    expect(quickAddRefusal(overlapping)).toBe('You already have hours 08:02 – 16:31. Pick an end time outside that, or edit that day on My Time.')
    // touching end-to-start is not an overlap
    expect(quickAddRefusal(draft({ sessions: [shift], endedAtMs: Date.UTC(2026, 8, 21, 16, 41) }))).toBeNull()
    // a rejected or revoked session is not in the way
    expect(quickAddClash(quickAddWindow(Date.UTC(2026, 8, 21, 16, 35), 10), [{ ...shift, rejected: true }])).toBeNull()
    // an open session means the time is already counting
    expect(quickAddRefusal(draft({ sessions: [{ clockedInMs: NOW - 20 * MIN, clockedOutMs: null }] }))).toBe(QUICK_ADD_SENTENCES.clockedIn)
  })

  it('holds the daily ceiling, this one included', () => {
    expect(quickAddRefusal(draft({ dayTotalMinutes: 110 }))).toBeNull() // 120 exactly
    expect(quickAddRefusal(draft({ dayTotalMinutes: 115 }))).toBe(quickAddCeilingSentence(125, 120))
    expect(quickAddRefusal(draft({ dayTotalMinutes: 35, dailyCeilingMinutes: 40 }))).toBe('That would be 45 minutes of quick adds today (the most is 40). If you are working a stretch, clock in instead.')
  })
})

describe('quickTimeAdd — the approver’s weekly line', () => {
  it('totals live quick adds only', () => {
    expect(weeklyQuickAddLine([])).toBeNull()
    expect(weeklyQuickAddLine([{ quickAddMinutes: null }])).toBeNull()
    expect(weeklyQuickAddLine([{ quickAddMinutes: 10 }])).toBe('10 m across 1 entry')
    expect(weeklyQuickAddLine([{ quickAddMinutes: 30 }, { quickAddMinutes: 30 }, { quickAddMinutes: 5 }, { quickAddMinutes: 20, rejected: true }, { quickAddMinutes: null }])).toBe('1 h 05 m across 3 entries')
  })
})
