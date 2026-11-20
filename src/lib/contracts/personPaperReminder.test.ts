import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  afterReminder,
  nextReminderAt,
  paperReminderLine,
  paperRemindersOn,
  paperReminderWords,
  paperTakesReminders,
  PERSON_PAPER_MAX_REMINDERS,
  PERSON_PAPER_REMINDER_DAYS,
  PERSON_PAPER_REMINDERS_KEY,
  reminderHold,
  reminderIntro,
  reminderPatchOnSend,
  reminderSubject,
  reminderSwitchPatch,
  reminderSwitchWords,
} from '../../../supabase/functions/_shared/personPaperReminder'

const NOW = Date.UTC(2026, 10, 20, 15, 0, 0)
const IN_THREE_DAYS = '2026-11-23T15:00:00.000Z'
const person = { doc_type: 'agreement', person_name: 'Dana Whitfield' }

describe('which paper takes reminders', () => {
  it('is an agreement filed under a person', () => {
    expect(paperTakesReminders(person)).toBe(true)
    expect(paperTakesReminders({ doc_type: null, person_name: 'Dana Whitfield' })).toBe(true)
  })

  it('is never a trade company’s paper, an outside party’s, an hours statement or a paper with no name', () => {
    expect(paperTakesReminders({ doc_type: 'agreement', person_name: 'gc-company:5b0f1d1e-0000-4000-8000-000000000001' })).toBe(false)
    expect(paperTakesReminders({ doc_type: 'agreement', person_name: 'party:5b0f1d1e-0000-4000-8000-000000000002' })).toBe(false)
    expect(paperTakesReminders({ doc_type: 'hours_statement', person_name: 'Dana Whitfield' })).toBe(false)
    expect(paperTakesReminders({ doc_type: 'w9', person_name: 'Dana Whitfield' })).toBe(false)
    expect(paperTakesReminders({ doc_type: 'agreement', person_name: '  ' })).toBe(false)
  })
})

describe('the Settings switch', () => {
  it('is on at 1 and off at anything else, so it ships off', () => {
    expect(paperRemindersOn('1')).toBe(true)
    expect(paperRemindersOn(' 1 ')).toBe(true)
    for (const v of ['0', '', null, undefined, 'true', 'on']) expect(paperRemindersOn(v)).toBe(false)
  })

  it('is the key the migration seeds off', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261120060000_person_paper_reminders.sql'), 'utf8')
    expect(sql).toContain(`VALUES ('${PERSON_PAPER_REMINDERS_KEY}', '0')`)
    expect(sql).toContain(`reminder_count BETWEEN 0 AND ${PERSON_PAPER_MAX_REMINDERS}`)
  })
})

describe('what a send writes', () => {
  const send = (over: Partial<Parameters<typeof reminderPatchOnSend>[0]> = {}) =>
    reminderPatchOnSend({ mode: 'email', switchOn: true, row: { ...person, reminders_enabled: true }, signerEmail: 'dana@example.com', nowMs: NOW, ...over })

  it('starts the count again and sets the first reminder three days out', () => {
    expect(PERSON_PAPER_REMINDER_DAYS).toBe(3)
    expect(nextReminderAt(NOW)).toBe(IN_THREE_DAYS)
    expect(send()).toEqual({ reminder_count: 0, next_reminder_at: IN_THREE_DAYS })
  })

  it('sets none while the Settings switch is off, so turning it on reaches no paper already out', () => {
    expect(send({ switchOn: false })).toEqual({ reminder_count: 0, next_reminder_at: null })
  })

  it('sets none for a paper whose own switch is off, or with no address', () => {
    expect(send({ row: { ...person, reminders_enabled: false } })).toEqual({ reminder_count: 0, next_reminder_at: null })
    expect(send({ signerEmail: '' })).toEqual({ reminder_count: 0, next_reminder_at: null })
  })

  it('stops the reminders when a link is handed over, and keeps the count', () => {
    expect(send({ mode: 'link', signerEmail: '' })).toEqual({ next_reminder_at: null })
  })

  it('writes nothing on a paper that takes none', () => {
    expect(send({ row: { doc_type: 'agreement', person_name: 'party:5b0f1d1e-0000-4000-8000-000000000002' } })).toEqual({})
    expect(send({ mode: 'link', row: { doc_type: 'hours_statement', person_name: 'Dana Whitfield' } })).toEqual({})
  })
})

describe('the timed function’s check', () => {
  const due = { ...person, status: 'sent', signer_email: 'dana@example.com', reminders_enabled: true, reminder_count: 1, next_reminder_at: '2026-11-20T00:00:00.000Z' }

  it('lets a due paper go', () => {
    expect(reminderHold(due)).toBeNull()
  })

  it('holds each paper it must not remind, with its reason', () => {
    expect(reminderHold({ ...due, status: 'signed' })).toBe('not_waiting')
    expect(reminderHold({ ...due, doc_type: 'hours_statement' })).toBe('kind')
    expect(reminderHold({ ...due, reminders_enabled: false })).toBe('off')
    expect(reminderHold({ ...due, signer_email: null })).toBe('no_address')
    expect(reminderHold({ ...due, signer_email: 'not an address' })).toBe('no_address')
    expect(reminderHold({ ...due, reminder_count: 3 })).toBe('all_sent')
  })

  it('counts a reminder and sets the next, and the third clears it', () => {
    expect(afterReminder(0, NOW)).toEqual({ reminder_count: 1, next_reminder_at: IN_THREE_DAYS, last_reminded_at: '2026-11-20T15:00:00.000Z' })
    expect(afterReminder(2, NOW)).toEqual({ reminder_count: 3, next_reminder_at: null, last_reminded_at: '2026-11-20T15:00:00.000Z' })
  })
})

describe('the reminder’s words', () => {
  it('names the paper and the company in the subject', () => {
    expect(reminderSubject('Subcontractor Agreement', 'Click Plumbing and Electrical')).toBe('Reminder: please sign Subcontractor Agreement · Click Plumbing and Electrical')
    expect(reminderSubject('  ', 'Click Plumbing and Electrical')).toBe('Reminder: please sign your agreement · Click Plumbing and Electrical')
  })

  it('says the link is new and the one before is ended', () => {
    expect(reminderIntro(1)).toContain('This email carries a new link. The link in our earlier email no longer works.')
    expect(reminderIntro(1)).not.toContain('last reminder')
  })

  it('says so on the last one', () => {
    expect(reminderIntro(3)).toContain('This is the last reminder we will send.')
  })
})

describe('the line on Documents → Agreements', () => {
  const day = () => 'Mon, Nov 23'
  const waiting = { ...person, status: 'sent', signer_email: 'dana@example.com', reminders_enabled: true, reminder_count: 0, next_reminder_at: null as string | null }

  it('says nothing while the switch is off and no reminder was ever set', () => {
    expect(paperReminderLine(waiting, false)).toEqual({ kind: 'none' })
    expect(paperReminderLine({ ...waiting, next_reminder_at: IN_THREE_DAYS }, false)).toEqual({ kind: 'none' })
    expect(paperReminderWords({ kind: 'none' }, day)).toBe('')
  })

  it('says nothing for a signed paper or one that takes none', () => {
    expect(paperReminderLine({ ...waiting, status: 'signed', next_reminder_at: IN_THREE_DAYS }, true)).toEqual({ kind: 'none' })
    expect(paperReminderLine({ ...waiting, person_name: 'party:5b0f1d1e-0000-4000-8000-000000000002', next_reminder_at: IN_THREE_DAYS }, true)).toEqual({ kind: 'none' })
  })

  it('counts what went and names the next day', () => {
    const line = paperReminderLine({ ...waiting, reminder_count: 1, next_reminder_at: IN_THREE_DAYS }, true)
    expect(line).toEqual({ kind: 'on', sent: 1, nextAt: IN_THREE_DAYS })
    expect(paperReminderWords(line, day)).toBe('1 of 3 reminders sent · next Mon, Nov 23')
  })

  it('reads off for a paper turned off, and may be turned on when it has an address and the switch is on', () => {
    expect(paperReminderLine({ ...waiting, reminders_enabled: false, reminder_count: 1 }, true)).toEqual({ kind: 'off', sent: 1, canTurnOn: true })
    expect(paperReminderLine({ ...waiting, reminders_enabled: false, reminder_count: 1 }, false)).toEqual({ kind: 'off', sent: 1, canTurnOn: false })
    expect(paperReminderLine({ ...waiting, signer_email: null }, true)).toEqual({ kind: 'off', sent: 0, canTurnOn: false })
    expect(paperReminderWords({ kind: 'off', sent: 1, canTurnOn: true }, day)).toBe('Reminders off · 1 of 3 sent')
    expect(paperReminderWords({ kind: 'off', sent: 0, canTurnOn: true }, day)).toBe('Reminders off')
  })

  it('reads all sent after the third', () => {
    const line = paperReminderLine({ ...waiting, reminder_count: 3 }, true)
    expect(line).toEqual({ kind: 'all_sent', sent: 3 })
    expect(paperReminderWords(line, day)).toBe('All 3 reminders sent')
  })

  it('writes the paper’s own switch, and says what happens next', () => {
    expect(reminderSwitchPatch(false, NOW)).toEqual({ reminders_enabled: false, next_reminder_at: null })
    expect(reminderSwitchPatch(true, NOW)).toEqual({ reminders_enabled: true, next_reminder_at: IN_THREE_DAYS })
    expect(reminderSwitchWords(false, 'Dana Whitfield')).toBe('Reminders are off for this paper. Dana Whitfield gets no more.')
    expect(reminderSwitchWords(true, '')).toBe('Reminders are on. this person gets the next one in 3 days.')
  })
})
