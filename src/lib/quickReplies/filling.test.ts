/** Filling a quick reply's blanks on screen, over the residential prototype's lines (v0.8): Dana, a customer, and Luis, the tech. */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BLANK_CHIPS, insertBlank, preview, replyFills, sendWaits } from './filling'

const ON_OUR_WAY = '{first}, this is {me} with Click Plumbing. We are on our way to {address}, about {minutes} minutes out.'
const FOUND = '{first}, here is what we found: {found}. {me} will send you the estimate today.'

describe('the chips under a line’s words', () => {
  it('lists the app’s blanks, then the two the person fills', () => {
    expect(BLANK_CHIPS.map((c) => c.label)).toEqual(['{first}', '{me}', '{address}', '{job}', '{minutes}', '{window}', '{back day}', '{back time}', '{day}', '{tech}', '{link}', '{amount}', '{bill}', '{number}', '{estimate}', '{rate}', '{portal}', '{thing}', '{found}'])
    expect(BLANK_CHIPS.filter((c) => c.theirs).map((c) => c.words)).toEqual(['what you want a photo of, yours to fill', 'what you found, yours to fill'])
  })

  it('puts a blank at the cursor, in place of a selection, with the caret after it', () => {
    expect(insertBlank('Hi , we are here.', 3, 3, 'first')).toEqual({ text: 'Hi {first}, we are here.', caret: 10 })
    expect(insertBlank('Hi NAME, we are here.', 3, 7, 'first')).toEqual({ text: 'Hi {first}, we are here.', caret: 10 })
    expect(insertBlank('Done.', 99, 99, 'me')).toEqual({ text: 'Done.{me}', caret: 9 })
  })
})

describe('the editor’s preview', () => {
  it('fills what it knows and says what the box leaves to the person', () => {
    const fills = replyFills({ first: 'Dana', myName: 'Luis Ortega', jobName: 'Oakridge sewer line' })
    expect(preview(FOUND, fills, 'Dana')).toEqual({
      text: 'Dana, here is what we found: {found}. Luis will send you the estimate today.',
      note: 'As it would go to Dana. Fill {found} in the box before it sends.',
    })
    expect(preview(ON_OUR_WAY, fills, null).note).toBe('As it would go. Fill {address} and {minutes} in the box before it sends.')
    expect(preview('Got it, thank you.', {}, 'Dana')).toEqual({ text: 'Got it, thank you.', note: 'As it would go to Dana.' })
  })
})

describe('the reply box', () => {
  it('fills their first name, yours and the job’s name, and nothing it does not know', () => {
    expect(replyFills({ first: 'Dana', myName: 'Luis Ortega', jobName: ' Oakridge sewer line ' })).toEqual({ first: 'Dana', me: 'Luis', job: 'Oakridge sewer line' })
    expect(replyFills({ first: ' ', myName: null, jobName: null })).toEqual({ first: null, me: null, job: null })
  })

  it('waits while a blank is left, and sends once it is filled', () => {
    expect(sendWaits('Dana, here is what we found: {found}.')).toBe('Fill {found} first. The app does not know it.')
    expect(sendWaits('Dana, could you send a photo of {thing}? We are {minutes} out.')).toBe('Fill {thing} and {minutes} first. The app does not know them.')
    expect(sendWaits('Dana, here is what we found: a cracked clean-out.')).toBeNull()
  })

  it('says it all plainly', () => {
    const sentences = [preview(FOUND, {}, 'Dana').note, sendWaits('{found} {thing}') ?? '']
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})

describe('the bill’s pay page (v2.5628)', () => {
  it('fills {bill} from the job’s newest bill when the box knows it, and leaves it when it does not', () => {
    const line = '{first}, this is {me} with Click Plumbing. Here is a copy of your last bill: {bill}. Let us know if you need any help getting it paid.'
    const withBill = replyFills({ first: 'Dana', myName: 'Tanya Reyes', jobName: 'Oakridge sewer line', billLink: 'https://clicktooling.com/pay/8f3k2q' })
    expect(preview(line, withBill, 'Dana').text).toBe('Dana, this is Tanya with Click Plumbing. Here is a copy of your last bill: https://clicktooling.com/pay/8f3k2q. Let us know if you need any help getting it paid.')
    const without = replyFills({ first: 'Dana', myName: 'Tanya Reyes', jobName: 'Oakridge sewer line' })
    expect(preview(line, without, 'Dana').note).toBe('As it would go to Dana. Fill {bill} in the box before it sends.')
    expect(sendWaits(preview(line, without, 'Dana').text)).toBe('Fill {bill} first. The app does not know it.')
  })
})

describe('the bill a line about money speaks of (#127)', () => {
  const line = '{first}, {amount} is still open on job {number}. You can pay it here: {bill}'

  it('fills {amount}, {number} and {bill} from the same bill, its pay page over the job’s newest', () => {
    const fills = replyFills({
      first: 'Dana',
      myName: 'Rosa',
      jobName: 'Helotes re-pipe',
      billLink: 'https://clicktooling.com/pay/newest',
      paper: { bill: 'https://clicktooling.com/pay/open-one', amount: '$1,440', number: '1312' },
    })
    expect(preview(line, fills, 'Dana').text).toBe('Dana, $1,440 is still open on job 1312. You can pay it here: https://clicktooling.com/pay/open-one')
  })

  it('never pairs an amount with another bill’s page: an open bill with no pay page leaves {bill} to fill', () => {
    const fills = replyFills({ first: 'Dana', myName: 'Rosa', jobName: null, billLink: 'https://clicktooling.com/pay/newest', paper: { bill: null, amount: '$420', number: '1312' } })
    expect(fills.bill).toBeUndefined()
    expect(sendWaits(preview(line, fills, 'Dana').text)).toBe('Fill {bill} first. The app does not know it.')
  })

  it('keeps the job’s newest bill when no paper is known', () => {
    expect(replyFills({ first: 'Dana', myName: 'Rosa', jobName: null, billLink: 'https://clicktooling.com/pay/newest', paper: {} }).bill).toBe('https://clicktooling.com/pay/newest')
  })
})
