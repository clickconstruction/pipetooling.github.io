import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { AFTER_TAG_WORDS, afterTag, filedWords } from './reader'

describe('the line after a tag: what it did to Follow up, and the press that says otherwise (v2.7032, punch list #324)', () => {
  it('counts the old mail filed and offers Put on Follow up', () => {
    expect(afterTag({ contactId: 'c-dale', lines: 6, filed: 6, state: 'done' })).toEqual({
      words: '6 old mails were filed for the record. Nothing went on Follow up.',
      press: 'putOnFollowUp',
      label: 'Put on Follow up',
      tip: AFTER_TAG_WORDS.putOnFollowUpTip,
    })
    expect(filedWords(1)).toBe('1 old mail was filed for the record. Nothing went on Follow up.')
    // The state did not read: the count still stands.
    expect(afterTag({ contactId: 'c-dale', lines: 2, filed: 2 })?.press).toBe('putOnFollowUp')
  })

  it('says a live conversation is on Follow up and offers No reply needed', () => {
    expect(afterTag({ contactId: 'c-dale', lines: 3, filed: 1, state: 'waiting' })).toMatchObject({ words: 'This conversation is on Follow up.', press: 'noReply', label: 'No reply needed' })
    // Old mail on a thread that was already open: the thread is what the person sees, so the line says it is open.
    expect(afterTag({ contactId: 'c-dale', lines: 2, filed: 2, state: 'waiting' })?.press).toBe('noReply')
  })

  it('says nothing for a thread that is simply done, a snoozed one, a tag that landed on nobody, or an older function', () => {
    expect(afterTag({ contactId: 'c-dale', lines: 3, filed: 1, state: 'done' })).toBeNull()
    expect(afterTag({ contactId: 'c-dale', lines: 0, filed: 0, state: 'done' })).toBeNull()
    expect(afterTag({ contactId: 'c-dale', lines: 2, filed: 2, state: 'snoozed' })).toBeNull()
    expect(afterTag({ contactId: null, lines: 2, filed: 2, state: 'done' })).toBeNull()
    expect(afterTag({ contactId: 'c-dale', lines: 2 })).toBeNull()
  })

  it('writes plain words', () => {
    const words = [filedWords(6), AFTER_TAG_WORDS.onFollowUp, AFTER_TAG_WORDS.putOnFollowUpTip, AFTER_TAG_WORDS.noReplyTip, ...Object.values(AFTER_TAG_WORDS.went), ...Object.values(AFTER_TAG_WORDS.failed)]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
