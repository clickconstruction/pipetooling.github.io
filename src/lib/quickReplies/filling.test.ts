/** Filling a quick reply's blanks on screen, over the residential prototype's lines (v0.8): Dana, a customer, and Luis, the tech. */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BLANK_CHIPS, insertBlank, preview, replyFills, sendWaits } from './filling'

const ON_OUR_WAY = '{first}, this is {me} with Click Plumbing. We are on our way to {address}, about {minutes} minutes out.'
const FOUND = '{first}, here is what we found: {found}. {me} will send you the estimate today.'

describe('the chips under a line’s words', () => {
  it('lists the app’s blanks, then the two the person fills', () => {
    expect(BLANK_CHIPS.map((c) => c.label)).toEqual(['{first}', '{me}', '{address}', '{job}', '{minutes}', '{window}', '{back day}', '{back time}', '{day}', '{tech}', '{link}', '{amount}', '{thing}', '{found}'])
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
