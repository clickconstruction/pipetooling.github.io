/**
 * The board's moves (v2.5627, punch list #123 PR 2): Working, Done and Billed as Tell the customer moments, with the
 * app's own words in both languages filled by the job alone, the act's row for each, the hints that name the step, and
 * My way with no say on them.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { fillLine } from '../quickReplies/blanks'
import { myWayFor } from './myWay'
import { DEFAULT_LINES, DEFAULT_SCRIPTS, MOMENT_STEP, MOVE_MOMENTS, TELL_WORDS, tellActs, tellFills, tellWords } from './tellCustomer'

const fills = tellFills({ customerName: 'Dana Whitfield', me: 'Rosa Perez', jobName: 'Whitfield water heater', jobAddress: null })

describe('the board’s moves', () => {
  it('has plain words for each move in both languages, and the job alone fills them', () => {
    for (const moment of MOVE_MOMENTS) {
      for (const words of [DEFAULT_LINES[moment].text, DEFAULT_LINES[moment].textEs, DEFAULT_SCRIPTS[moment].text, DEFAULT_SCRIPTS[moment].textEs]) {
        expect(plainWordsFailures(fillLine(words, fills).text), words).toEqual([])
      }
      expect(tellWords(DEFAULT_LINES[moment], fills, 'en').left).toEqual([])
      expect(MOMENT_STEP[moment]).toBe(moment)
    }
    expect(tellWords(DEFAULT_LINES.done, fills, 'en').text).toBe(
      'Dana, this is Rosa with Click Plumbing. The work on Whitfield water heater is done. Your bill follows by email. Text me here with any question.',
    )
    expect(tellWords(DEFAULT_LINES.working, fills, 'es').text).toBe('Dana, le habla Rosa de Click Plumbing. Hoy empezamos el trabajo de Whitfield water heater. Escríbame aquí si tiene alguna pregunta.')
  })

  it('says what each move texts, names the step in the hint, and sends no email', () => {
    expect(tellActs('working', 'Dana', null).rows.map((r) => r.words)).toEqual([
      'Texts Dana that the work has started from the company number. Dana’s answer comes to the office.',
      'Then shows you what went, and offers the call.',
    ])
    expect(tellActs('done', 'Dana', null).rows[0]?.words).toContain('that the work is done')
    expect(tellActs('billed', null, null)).toMatchObject({ primary: 'Send text to the customer', emailOnly: null })
    expect(tellActs('billed', 'Dana', 'no-number').rows[0]?.words).toBe('No text: Dana has no phone number on file. Add one on the customer.')
    expect(TELL_WORDS.editHint(true, 'done')).toBe('The office’s Done line, filled for this job. Change any word.')
    expect(TELL_WORDS.editHint(false, 'billed')).toBe('The app’s own words, since the office has no Billed line yet. Change any word.')
    expect(TELL_WORDS.editHint(false, 'booked')).toBe('The app’s own words, since the office has no Booked line yet. Change any word.')
    expect(TELL_WORDS.noEmail('working')).toBe('No email goes with this text.')
    expect(TELL_WORDS.noEmail('booked')).toBe('No email goes for a booking.')
  })

  it('always asks: My way has no say on a move, and a moved visit still follows the booking’s way', () => {
    expect(myWayFor({ booked: 'send', estimate: 'send' }, 'done')).toBe('ask')
    expect(myWayFor({ booked: 'send', estimate: 'ask' }, 'rescheduled')).toBe('send')
    expect(myWayFor({ booked: 'ask', estimate: 'send' }, 'estimate')).toBe('send')
  })
})
