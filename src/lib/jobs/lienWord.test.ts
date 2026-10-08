import { describe, expect, it } from 'vitest'
import { LIEN_WORD_CHANNELS, LIEN_WORD_CHANNEL_WORDS, LIEN_WORD_PRESENT_CHANNELS, defaultWordNote, isLienWordChannel, leaderPresent, presenceLine, wordRecordBlock, wordRecordPreview, wordRecordWords } from './lienWord'

describe('lienWord — the leader’s word and the two “he is here” declarations', () => {
  it('keeps the three remembered channels first and the two presence channels after them', () => {
    expect(LIEN_WORD_CHANNELS).toEqual(['phone', 'in_person', 'text', 'standing_over', 'typing'])
    expect(LIEN_WORD_PRESENT_CHANNELS).toEqual(['standing_over', 'typing'])
    expect(LIEN_WORD_CHANNELS.map((c) => LIEN_WORD_CHANNEL_WORDS[c].pick)).toEqual(['by phone', 'in person', 'by text', 'standing over me', 'typing it in'])
  })

  it('only the two presence channels mean the leader is at the desk', () => {
    expect(LIEN_WORD_CHANNELS.filter(leaderPresent)).toEqual(['standing_over', 'typing'])
    expect(leaderPresent('in_person')).toBe(false)
    expect(leaderPresent(null)).toBe(false)
    expect(isLienWordChannel('typing')).toBe(true)
    expect(isLienWordChannel('email')).toBe(false)
  })

  it('a claim over the balance refuses a remembered word and takes a present leader', () => {
    expect(wordRecordBlock('leader', 'phone')).toMatch(/set by hand over the balance/)
    expect(wordRecordBlock('leader', 'in_person')).not.toBe('')
    expect(wordRecordBlock('leader', 'standing_over')).toBe('')
    expect(wordRecordBlock('leader', 'typing')).toBe('')
    expect(wordRecordBlock('look', 'phone')).toBe('')
    expect(wordRecordBlock(null, 'phone')).toBe('')
  })

  it('the record line names the note and how it was given', () => {
    expect(wordRecordWords({ word_note: 'Robert, Sep 24', word_channel: 'standing_over' })).toBe('on the leader’s word · Robert, Sep 24 · standing over the desk')
    // The desk knows the master (v2.4856): his first name takes the leader's place.
    expect(wordRecordWords({ word_note: 'Malachi Whites, Oct 7', word_channel: 'standing_over' }, 'Malachi Whites')).toBe('on Malachi’s word · Malachi Whites, Oct 7 · standing over the desk')
    expect(wordRecordWords({ word_note: '', word_channel: '' }, '  ')).toBe('on the leader’s word')
    expect(wordRecordWords({ word_note: 'Robert, today 9:10', word_channel: 'phone' })).toBe('on the leader’s word · Robert, today 9:10 · by phone')
    expect(wordRecordWords({ word_note: '', word_channel: '' })).toBe('on the leader’s word')
    expect(wordRecordWords(null)).toBe('on the leader’s word')
  })

  it('the presence line says who recorded it and what the record means; nothing for a remembered word', () => {
    expect(presenceLine('typing', 'Wendi')).toBe('Recorded by Wendi. He can pull it back with “Not what I said”.')
    expect(presenceLine('standing_over', '', 'Malachi Whites')).toBe('Recorded by the office. Malachi can pull it back with “Not what I said”.')
    expect(presenceLine('phone', 'Wendi')).toBe('')
  })

  it('the default note names the leader when the desk knows him', () => {
    expect(defaultWordNote('Robert', 'Sep 24')).toBe('Robert, Sep 24')
    expect(defaultWordNote(null, 'Sep 24')).toBe('the leader, Sep 24')
  })
})

describe('the preview of the record (v2.4856)', () => {
  it('says the same words the desk draws afterwards, in every place they land, and that the paper is untouched', () => {
    const p = wordRecordPreview({ leaderName: 'Malachi Whites', note: 'Malachi Whites, October 7, 2026', channel: 'standing_over', recorderName: 'Taunya', jobLabel: '878 · Take 5- Seguin', gcName: 'Southern Post Construction', amountWords: '$38,625' })
    expect(p.ready).toBe('On Malachi’s word · Malachi Whites, October 7, 2026 · standing over the desk')
    expect(p.strip).toBe('Sent on your word: 878 · Take 5- Seguin')
    expect(p.row).toBe('878 · Take 5- Seguin · GC Southern Post Construction · $38,625 · on Malachi’s word · Malachi Whites, October 7, 2026 · standing over the desk')
    expect(p.record).toContain('Recorded by Taunya: Malachi was at the desk and said to send it.')
    expect(p.paper).toContain('The notice itself does not change.')
    // A remembered word names how it came; no master known falls back to the leader.
    const q = wordRecordPreview({ note: 'Robert, Sep 24', channel: 'phone', recorderName: '', jobLabel: '650' })
    expect(q.ready).toBe('On the leader’s word · Robert, Sep 24 · by phone')
    expect(q.record).toContain("Recorded by the office from the leader's word, given by phone.")
  })

  it('the presence chips no longer say “he is”', () => {
    expect(LIEN_WORD_CHANNEL_WORDS.standing_over.pick).toBe('standing over me')
    expect(LIEN_WORD_CHANNEL_WORDS.typing.pick).toBe('typing it in')
  })
})
