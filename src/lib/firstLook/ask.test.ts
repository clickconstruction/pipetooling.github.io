import { describe, expect, it } from 'vitest'
import { isAppLine } from '../messages/stageLines'
import { blanksIn, BLANKS } from '../quickReplies/blanks'
import { SHOW_ASK_ID, SHOW_BLANK, showAskLine, showUsLink, slashCallsShow, withAsk } from './ask'

describe('the ask for photos (punch list #319 PR 1)', () => {
  it('the words after a / that call it: two letters or more', () => {
    for (const w of ['sh', 'show', 'photo', 'photos', 'pic', 'video', 'look', 'showing']) expect(slashCallsShow(w)).toBe(true)
    for (const w of ['', 's', 'bill', 'estimate', 'thanks']) expect(slashCallsShow(w)).toBe(false)
  })

  it('the line names them, and leaves {me} and {show} for the box', () => {
    const line = showAskLine('Dana')
    expect(line.id).toBe(SHOW_ASK_ID)
    expect(isAppLine(line)).toBe(true)
    expect(line.shortcut).toBe('show')
    expect(line.text).toBe('Hi Dana, this is {me} with Click Plumbing. So we can price this before we come out, send us a few photos or a short video here: {show} Or reply to this text with the photos.')
    expect(blanksIn(line.text)).toEqual(['me', 'show'])
    expect(line.textEs).toMatch(/^Hola Dana, habla \{me\} de Click Plumbing\./)
    expect(blanksIn(line.textEs ?? '')).toEqual(['me', 'show'])
  })

  it('a number nobody has named is not greeted by a name, so the box never waits on one', () => {
    expect(showAskLine(null).text).toMatch(/^Hi, this is \{me\} with Click Plumbing\./)
    expect(blanksIn(showAskLine(null).text)).toEqual(['me', 'show'])
  })

  it('the blank is one the app fills', () => {
    expect(SHOW_BLANK).toBe('{show}')
    expect(BLANKS.some((b) => b.key === 'show')).toBe(true)
  })

  it('the link is the page for the code, on the app', () => {
    expect(showUsLink('k7m2p9xq4d')).toBe('https://clicktooling.com/show/k7m2p9xq4d')
    expect(showUsLink('k7m2p9xq4d', 'https://my.example.test')).toBe('https://my.example.test/show/k7m2p9xq4d')
  })

  it('an empty box takes the line; words already there keep their place above it', () => {
    expect(withAsk('', 'ASK')).toBe('ASK')
    expect(withAsk('  \n', 'ASK')).toBe('ASK')
    expect(withAsk('Thanks for the call.\n', 'ASK')).toBe('Thanks for the call.\nASK')
  })
})
