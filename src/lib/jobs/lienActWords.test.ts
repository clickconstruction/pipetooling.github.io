import { describe, expect, it } from 'vitest'
import { lienActFor, lienDayGuessSentence, lienRowTip, type LienActPaper } from './lienActWords'
import type { LienNextUpAction } from './lienNextUp'
import { plainWordsFailures } from '../plainWords'

const ACTIONS: LienNextUpAction[] = ['find_owner', 'draft', 'approve', 'sign', 'confirm_pen', 'send', 'send_run', 'add_tracking', 'record_mailing', 'review_hold', 'letter_two', 'courtesy', 'promise', 'note_missed', 'fix_property', 'send_notice', 'draft_late', 'file_affidavit', 'record_service', 'mail_needs_you']
const PAPERS: LienActPaper[] = ['notice', 'affidavit', 'retainage']

describe('lienActFor (v2.7043, punch list #325): the next act on the lien path', () => {
  it('names the step a person takes, on the paper it is taken on', () => {
    expect(lienActFor({ paper: 'notice', action: 'find_owner' })?.words).toBe('Find the owner')
    expect(lienActFor({ paper: 'notice', action: 'draft' })?.words).toBe('Draft the notice')
    expect(lienActFor({ paper: 'affidavit', action: 'draft' })?.words).toBe('Draft the affidavit')
    expect(lienActFor({ paper: 'retainage', action: 'draft' })?.words).toBe('Draft the retainage notice')
    expect(lienActFor({ paper: 'notice', action: 'sign' })?.words).toBe('Sign the notice')
    expect(lienActFor({ paper: 'notice', action: 'send' })?.words).toBe('Send the notice')
    expect(lienActFor({ paper: 'notice', action: 'send_run' })?.words).toBe('Send the notice')
    expect(lienActFor({ paper: 'notice', action: 'add_tracking' })?.words).toBe('Record the mailing')
    expect(lienActFor({ paper: 'notice', action: 'review_hold' })?.words).toBe('Review the hold')
    expect(lienActFor({ paper: 'affidavit', action: 'file_affidavit' })?.words).toBe('File the affidavit')
    expect(lienActFor({ paper: 'affidavit', action: 'record_service' })?.words).toBe('Serve the affidavit')
    expect(lienActFor({ paper: 'affidavit', action: 'send_notice' })?.words).toBe('Send the late notice')
    expect(lienActFor({ paper: 'notice', action: 'draft_late' })?.words).toBe('Draft the late notice')
  })

  it('an approval is the leader’s act on his own screen and a wait, by name, on everyone else’s', () => {
    expect(lienActFor({ paper: 'notice', action: 'approve', yours: true })?.words).toBe('Approve the notice')
    expect(lienActFor({ paper: 'affidavit', action: 'approve', waitingOn: 'Marisol' })).toMatchObject({ words: 'Waiting on Marisol', why: 'The affidavit is drafted and waits on Marisol to approve it.' })
    expect(lienActFor({ paper: 'notice', action: 'approve' })?.words).toBe('Waiting on the leader')
  })

  it('an affidavit held by its property facts names the one fact, or the record when several are missing', () => {
    const gate = (missing: Parameters<typeof lienActFor>[0]['missing']) => lienActFor({ paper: 'affidavit', action: 'fix_property', missing })!
    expect(gate(['homestead_answer']).words).toBe('Answer the homestead question')
    expect(gate(['contractor']).words).toBe('Add the GC’s address')
    expect(gate(['owner']).words).toBe('Find the owner')
    expect(gate(['legal']).words).toBe('Add the legal description')
    expect(gate(['notice']).words).toBe('Send the late notice')
    expect(gate(['owner', 'legal']).words).toBe('Fix the property record')
    expect(gate([]).words).toBe('Fix the property record')
    expect(gate(['homestead', 'legal'])).toMatchObject({ words: 'Homestead, ask the attorney', dated: true })
    // No lien attaches to public property: no day to race, and a line saying who to ask. It wins over every other gate.
    expect(gate(['public_owner', 'legal'])).toMatchObject({ words: 'Public property, no lien', dated: false, under: 'Ask the attorney about the bond' })
  })

  it('a reminder, a closed window and a returned envelope are not steps toward a legal day', () => {
    for (const action of ['letter_two', 'courtesy', 'promise', 'note_missed', 'mail_needs_you'] as const) expect(lienActFor({ paper: 'notice', action })).toBeNull()
  })

  it('every word a first-timer reads here passes the plain-words rules, on every paper and move', () => {
    for (const paper of PAPERS)
      for (const action of ACTIONS)
        for (const over of [{}, { yours: true }, { waitingOn: 'Marisol' }, { missing: ['public_owner' as const] }, { missing: ['homestead' as const] }, { missing: ['homestead_answer' as const] }, { missing: ['contractor' as const] }, { missing: ['owner' as const] }, { missing: ['legal' as const] }, { missing: ['notice' as const] }]) {
          const act = lienActFor({ paper, action, ...over })
          if (!act) continue
          expect(plainWordsFailures(act.words), act.words).toEqual([])
          expect(plainWordsFailures(act.under), act.under).toEqual([])
          for (const guess of ['', lienDayGuessSentence({ kindAssumed: true, datedFromCreation: false }), lienDayGuessSentence({ kindAssumed: false, datedFromCreation: true })]) {
            const tip = lienRowTip({ why: act.why, dayWords: act.dated ? 'Nov 16' : '', guess })
            expect(plainWordsFailures(tip), tip).toEqual([])
          }
        }
  })

  it('the tip is where the paper stands, the day, the press, and the guess only when there is one', () => {
    expect(lienRowTip({ why: 'The affidavit is approved and ready to file.', dayWords: 'Nov 16' })).toBe('The affidavit is approved and ready to file. The last day is Nov 16. Press to open the Lien window.')
    expect(lienRowTip({ why: 'The lien affidavit is on file. The money is still owed.', dayWords: '' })).toBe('The lien affidavit is on file. The money is still owed. Press to open the Lien window.')
    expect(lienDayGuessSentence({ kindAssumed: false, datedFromCreation: false })).toBe('')
  })
})
