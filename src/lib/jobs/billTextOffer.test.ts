/** The offer after the bill goes (v2.6772): the question or the customer's say, the Texted read off the thread, the marks, plain words. */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BILL_TEXT_OFFER_WORDS, billSentMarks, billTextOffer, billTextedAt, carriesBillLink } from './billTextOffer'

const ID = '8f3a2c0a-1111-4111-8111-111111111111'

describe('billTextOffer', () => {
  it('asks with the press, unless the customer asked for email only', () => {
    expect(billTextOffer('Dana', null)).toEqual({ kind: 'ask', ask: 'Text Dana the pay link too? A text is read in minutes. Email waits for the evening.', press: 'Text Dana the bill…' })
    expect(billTextOffer('Dana', 'text')).toMatchObject({ kind: 'ask' })
    expect(billTextOffer('Dana', 'either')).toMatchObject({ kind: 'ask' })
    expect(billTextOffer('Dana', 'email')).toEqual({ kind: 'email-only', words: 'Dana asked for email only.' })
    expect(billTextOffer(null, null)).toMatchObject({ ask: 'Text the customer the pay link too? A text is read in minutes. Email waits for the evening.', press: 'Text the customer the bill…' })
  })
  it('reads plain', () => {
    for (const w of [BILL_TEXT_OFFER_WORDS.ask('Dana'), BILL_TEXT_OFFER_WORDS.emailOnly('Dana'), BILL_TEXT_OFFER_WORDS.leadMade, BILL_TEXT_OFFER_WORDS.leadConverted, BILL_TEXT_OFFER_WORDS.notNow]) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('the Texted read', () => {
  it('knows the bill’s pay page on any host, upper or lower case, and the bill’s other links', () => {
    expect(carriesBillLink(`Pay it here: https://clicktooling.com/pay/${ID}`, ID)).toBe(true)
    expect(carriesBillLink(`Pay it here: https://my.clickplumbing.com/pay/${ID.toUpperCase()}`, ID)).toBe(true)
    expect(carriesBillLink('Pay it here: https://invoice.stripe.com/i/acct_1/test_abc?s=ap', ID, ['https://invoice.stripe.com/i/acct_1/test_abc'])).toBe(true)
    expect(carriesBillLink('Pay it here: https://my.clickplumbing.com/pay/k7x2m9pq4n', ID, ['https://my.clickplumbing.com/pay/k7x2m9pq4n'])).toBe(true)
    expect(carriesBillLink('Pay it here: https://clicktooling.com/pay/22222222-2222-4222-8222-222222222222', ID)).toBe(false)
    expect(carriesBillLink('Your estimate: https://my.clickplumbing.com/e/abc', ID)).toBe(false)
  })
  it('takes the newest text that carries the link, and none as null', () => {
    const texts = [
      { at: '2026-11-09T21:32:00Z', body: `Hi Dana, this is Rosa with Click Plumbing. Pay it here: https://clicktooling.com/pay/${ID}` },
      { at: '2026-11-09T21:40:00Z', body: 'Dana, did the link open for you?' },
      { at: '2026-11-08T15:00:00Z', body: `Here is the bill again: https://clicktooling.com/pay/${ID}` },
    ]
    expect(billTextedAt(texts, ID)).toBe(Date.parse('2026-11-09T21:32:00Z'))
    expect(billTextedAt(texts.slice(1, 2), ID)).toBeNull()
    expect(billTextedAt([], ID)).toBeNull()
  })
  it('the marks read Emailed and Texted, Not texted beside an email alone, and nothing with neither', () => {
    const emailed = Date.parse('2026-11-09T21:30:00Z')
    const texted = Date.parse('2026-11-09T21:32:00Z')
    expect(billSentMarks(emailed, texted)).toBe('Emailed 3:30 PM · Texted 3:32 PM')
    expect(billSentMarks(emailed, null)).toBe('Emailed 3:30 PM · Not texted')
    expect(billSentMarks(null, texted)).toBe('Texted 3:32 PM')
    expect(billSentMarks(null, null)).toBeNull()
  })
})
