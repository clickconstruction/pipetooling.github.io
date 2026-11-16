import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LIEN_REMINDER_HOLDS, lienReminderOutcome, lienReminderPlan, lienReminderWords, type LienReminderPaper } from './lienLeaderReminder'

const paper = (kind: LienReminderPaper['kind'], label: string, over: Partial<LienReminderPaper> = {}): LienReminderPaper => ({ kind, label, itemId: `i-${label}`, dueYmd: '2026-11-16', ...over })

describe('lienReminderPlan', () => {
  it('a notice is a message of its own, a retainage notice too, and the affidavits share one; a paper with no item stays out with the reason', () => {
    const plan = lienReminderPlan([paper('notice', '891'), paper('affidavit', '804'), paper('notice', '922'), paper('affidavit', '650', { dueYmd: null }), paper('retainage', '700'), paper('notice', '710', { itemId: null })])
    expect(plan.notices.map((p) => p.label)).toEqual(['891', '922', '700'])
    expect(plan.affidavits).toEqual([{ itemId: 'i-804', dueYmd: '2026-11-16', label: '804' }, { itemId: 'i-650', dueYmd: null, label: '650' }])
    expect(plan.held).toEqual([{ label: '710', reason: LIEN_REMINDER_HOLDS.noItem }])
    expect(plan.ready).toBe(5)
    // v2.7478: a retainage notice is sent with its own item and its own day, as a notice is.
    expect(plan.notices[2]).toEqual({ itemId: 'i-700', dueYmd: '2026-11-16', label: '700' })
    expect(lienReminderPlan([paper('retainage', '700', { itemId: null })]).held).toEqual([{ label: '700', reason: LIEN_REMINDER_HOLDS.noItem }])
  })

  it('nothing waiting is nothing to send', () => {
    expect(lienReminderPlan([])).toEqual({ notices: [], affidavits: [], held: [], ready: 0 })
  })
})

describe('lienReminderWords', () => {
  const plan = lienReminderPlan([paper('notice', '891 · ZZ Marlow'), paper('notice', '922 · ZZ Oak'), paper('affidavit', '804 · ZZ Locks')])

  it('the press names the leader and the count; the window says who gets what, and that nothing changes', () => {
    const w = lienReminderWords(plan, 'Malachi Stone')
    expect(w.button).toBe('Remind Malachi of 3 papers')
    expect(w.dead).toBe(false)
    expect(w.title).toBe('Remind Malachi of 3 papers?')
    expect(w.confirmLabel).toBe('Remind Malachi')
    expect(w.message).toBe('891 · ZZ Marlow, 922 · ZZ Oak, 804 · ZZ Locks. Malachi gets one message for each of the 2 notices. Malachi gets one message for the affidavit. It goes to Malachi’s phone, or by email. Nothing on the papers changes.')
  })

  it('one paper, and no name: it reads the leader', () => {
    const one = lienReminderWords(lienReminderPlan([paper('notice', '891')]), null)
    expect(one.button).toBe('Remind the leader of 1 paper')
    expect(one.title).toBe('Remind the leader of 1 paper?')
    expect(one.message).toBe('891. The leader gets one message for the notice. It goes to the leader’s phone, or by email. Nothing on the papers changes.')
    expect(lienReminderWords(lienReminderPlan([paper('affidavit', 'a'), paper('affidavit', 'b')]), 'sam').message).toContain('Sam gets one message for the 2 affidavits.')
  })

  it('what stays out is named with its reason, and with nothing ready the press is dead', () => {
    const held = lienReminderWords(lienReminderPlan([paper('notice', '891'), paper('retainage', '700', { itemId: null })]), 'Sam')
    expect(held.message.endsWith('1 stays out: 700 has no paper on the desk to point at.')).toBe(true)
    // A retainage notice on the desk is reminded of, one message as a notice's (v2.7478).
    const both = lienReminderWords(lienReminderPlan([paper('notice', '891'), paper('retainage', '700')]), 'Sam')
    expect(both.button).toBe('Remind Sam of 2 papers')
    expect(both.message).toBe('891, 700. Sam gets one message for each of the 2 notices. It goes to Sam’s phone, or by email. Nothing on the papers changes.')
    const none = lienReminderWords(lienReminderPlan([paper('retainage', '700', { itemId: null })]), 'Sam')
    expect(none.button).toBe('Remind Sam')
    expect(none.dead).toBe(true)
  })

  it('once sent this session the press says when, and is dead until the page is read again', () => {
    const w = lienReminderWords(plan, 'Malachi', '2:14 PM')
    expect(w.button).toBe('Reminded at 2:14 PM')
    expect(w.dead).toBe(true)
  })

  it('the window’s own sentences keep to plain words', () => {
    const w = lienReminderWords(lienReminderPlan([paper('notice', 'a'), paper('notice', 'b'), paper('affidavit', 'c')]), 'Malachi')
    // The list of jobs is the rows' own names; the sentences after it are ours.
    const ours = w.message.slice(w.message.indexOf('Malachi gets'))
    expect(plainWordsFailures(ours)).toEqual([])
    expect(plainWordsFailures(w.title)).toEqual([])
  })
})

describe('lienReminderOutcome', () => {
  it('says what was sent', () => {
    expect(lienReminderOutcome({ done: 3, failed: [] }, 'Malachi')).toEqual({ line: 'Malachi was reminded of 3 papers.', tone: 'success' })
    expect(lienReminderOutcome({ done: 1, failed: [] }, null)).toEqual({ line: 'The leader was reminded of 1 paper.', tone: 'success' })
  })

  it('keeps going past a reminder that fails and names it with its reason', () => {
    expect(lienReminderOutcome({ done: 2, failed: [{ label: '891', reason: 'The message could not be sent.' }] }, 'Malachi')).toEqual({ line: 'Malachi was reminded of 2 papers. 1 reminder did not send: 891 (The message could not be sent.).', tone: 'warning' })
    expect(lienReminderOutcome({ done: 0, failed: [{ label: '891', reason: 'offline' }, { label: 'the affidavits', reason: 'offline' }] }, 'Malachi')).toEqual({ line: 'Malachi was not reminded. 2 reminders did not send: 891 (offline), the affidavits (offline).', tone: 'error' })
  })
})
