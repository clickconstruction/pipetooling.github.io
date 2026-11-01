import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { cleanHiddenLabels, hiddenLabelProblem, MY_MAIL_CARD_WORDS, MY_MAIL_HIDDEN_MAX, MY_MAIL_LABEL_MAX, withHiddenLabel, withoutHiddenLabel } from './settingCard'

describe('the labels a person leaves out', () => {
  it('keeps them as my_mail_set does: trimmed, no blank, once each whatever the case, in order', () => {
    expect(cleanHiddenLabels([' Personal ', '', 'Receipts', 'personal', '  '])).toEqual(['Personal', 'Receipts'])
  })

  it('adds one at the end and shows one again, whatever its case', () => {
    expect(withHiddenLabel(['Personal'], ' Receipts ')).toEqual(['Personal', 'Receipts'])
    expect(withHiddenLabel(['Personal'], 'PERSONAL')).toEqual(['Personal'])
    expect(withHiddenLabel(['Personal'], '   ')).toEqual(['Personal'])
    expect(withoutHiddenLabel(['Personal', 'Receipts'], 'personal')).toEqual(['Receipts'])
  })

  it('says why a label cannot be left out', () => {
    expect(hiddenLabelProblem([], 'Personal')).toBeNull()
    expect(hiddenLabelProblem([], ' ')).toBeNull()
    expect(hiddenLabelProblem(['Personal'], 'personal')).toBe('Personal is left out already.')
    expect(hiddenLabelProblem([], 'Inbox')).toBe('Inbox and Sent are what this tab reads.')
    expect(hiddenLabelProblem([], 'SENT')).toBe('Inbox and Sent are what this tab reads.')
    expect(hiddenLabelProblem([], 'Drafts')).toBe('Drafts, Spam and Trash are never read.')
    expect(hiddenLabelProblem([], 'trash')).toBe('Drafts, Spam and Trash are never read.')
    expect(hiddenLabelProblem([], 'x'.repeat(MY_MAIL_LABEL_MAX + 1))).toBe('A Gmail label is 225 characters at most.')
    const full = Array.from({ length: MY_MAIL_HIDDEN_MAX }, (_, i) => `Label ${i}`)
    expect(hiddenLabelProblem(full, 'One more')).toBe('Leave out twenty labels at most.')
    expect(withHiddenLabel(full, 'One more')).toEqual(full)
  })
})

describe('the card’s words', () => {
  it('names the person’s own address when it is known', () => {
    expect(MY_MAIL_CARD_WORDS.reads(' marisol@clickplumbing.example ')).toBe('Reads marisol@clickplumbing.example, your Inbox and Sent, live. Nothing is kept until you tag a conversation.')
    expect(MY_MAIL_CARD_WORDS.reads('')).toBe('Reads your own Inbox and Sent, live. Nothing is kept until you tag a conversation.')
    expect(MY_MAIL_CARD_WORDS.gmailLabel).toBe('Nothing writes to your Gmail except the label Tagged in ClickTooling on a tagged mail.')
  })

  it('keeps every sentence in plain words', () => {
    const w = MY_MAIL_CARD_WORDS
    for (const text of [w.reads('marisol@clickplumbing.example'), w.tag, w.untag, w.never, w.gmailLabel, w.onlyYou, w.wait, w.tooMany, w.tooLong, w.readAnyway, w.neverAnyway, w.already('Personal'), w.notSaved, w.notRead]) {
      expect(plainWordsFailures(text)).toEqual([])
    }
  })
})
