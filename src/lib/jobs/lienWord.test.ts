import { describe, expect, it } from 'vitest'
import { LIEN_WORD_CHANNELS, LIEN_WORD_CHANNEL_WORDS, LIEN_WORD_PRESENT_CHANNELS, defaultWordNote, isLienWordChannel, leaderPresent, presenceLine, wordRecordBlock, wordRecordWords } from './lienWord'

describe('lienWord — the leader’s word and the two “he is here” declarations', () => {
  it('keeps the three remembered channels first and the two presence channels after them', () => {
    expect(LIEN_WORD_CHANNELS).toEqual(['phone', 'in_person', 'text', 'standing_over', 'typing'])
    expect(LIEN_WORD_PRESENT_CHANNELS).toEqual(['standing_over', 'typing'])
    expect(LIEN_WORD_CHANNELS.map((c) => LIEN_WORD_CHANNEL_WORDS[c].pick)).toEqual(['by phone', 'in person', 'by text', 'he is standing over me', 'he is typing it in'])
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
    expect(wordRecordWords({ word_note: 'Robert, today 9:10', word_channel: 'phone' })).toBe('on the leader’s word · Robert, today 9:10 · by phone')
    expect(wordRecordWords({ word_note: '', word_channel: '' })).toBe('on the leader’s word')
    expect(wordRecordWords(null)).toBe('on the leader’s word')
  })

  it('the presence line says who recorded it and what the record means; nothing for a remembered word', () => {
    expect(presenceLine('typing', 'Wendi')).toBe('Recorded by Wendi: the leader typed this in himself, at this desk. It goes to Ready to send on his word; he can pull it back with “Not what I said”.')
    expect(presenceLine('standing_over', '')).toMatch(/^Recorded by the office: the leader was standing here/)
    expect(presenceLine('phone', 'Wendi')).toBe('')
  })

  it('the default note names the leader when the desk knows him', () => {
    expect(defaultWordNote('Robert', 'Sep 24')).toBe('Robert, Sep 24')
    expect(defaultWordNote(null, 'Sep 24')).toBe('the leader, Sep 24')
  })
})
