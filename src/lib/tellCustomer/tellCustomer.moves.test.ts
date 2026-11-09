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
/** The Billed line (v2.6771) reads the bill too: its amount and its own pay page. */
const billFills = tellFills({ customerName: 'Dana Whitfield', me: 'Rosa Perez', jobName: 'Whitfield water heater', jobAddress: null, bill: { amount: '$1,850.00', link: 'https://my.clickplumbing.com/pay/k7x2m9pq4n' } })

describe('the board’s moves', () => {
  it('has plain words for each move in both languages, and the job alone fills them (the bill its own line)', () => {
    for (const moment of MOVE_MOMENTS) {
      const f = moment === 'billed' ? billFills : fills
      for (const words of [DEFAULT_LINES[moment].text, DEFAULT_LINES[moment].textEs, DEFAULT_SCRIPTS[moment].text, DEFAULT_SCRIPTS[moment].textEs]) {
        expect(plainWordsFailures(fillLine(words, f).text), words).toEqual([])
      }
      expect(tellWords(DEFAULT_LINES[moment], f, 'en').left).toEqual([])
      expect(MOMENT_STEP[moment]).toBe(moment)
    }
    // Text the bill (v2.6771, punch list #291): the opening says who is writing, the link rides last with nothing after it.
    expect(tellWords(DEFAULT_LINES.billed, billFills, 'en').text).toBe(
      'Hi Dana, this is Rosa with Click Plumbing. Your bill for Whitfield water heater is ready, $1,850.00. Text me here with any question. Pay it here: https://my.clickplumbing.com/pay/k7x2m9pq4n',
    )
    expect(tellWords(DEFAULT_LINES.billed, billFills, 'es').text).toBe(
      'Hola Dana, soy Rosa de Click Plumbing. Su factura por Whitfield water heater está lista, $1,850.00. Escríbame aquí con cualquier pregunta. Páguela aquí: https://my.clickplumbing.com/pay/k7x2m9pq4n',
    )
    // The job alone leaves the bill's blanks for the person, and the sheet says so.
    expect(tellWords(DEFAULT_LINES.billed, fills, 'en').left).toEqual(['amount', 'bill'])
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
    expect(TELL_WORDS.editHint(false, 'billed')).toBe('The app’s own Billed line, filled for this bill. Change any word.')
    expect(TELL_WORDS.editHint(true, 'billed')).toBe('The office’s Billed line, filled for this bill. Change any word.')
    expect(tellActs('billed', 'Dana', null).rows[0]?.words).toBe('Texts Dana the bill with its pay link from the company number. Dana’s answer comes to the office.')
    for (const words of [TELL_WORDS.billLinkHint, TELL_WORDS.fromNumber(null)]) expect(plainWordsFailures(words), words).toEqual([])
    expect(TELL_WORDS.fromNumber('(512) 555-0100')).toBe('from the company number (512) 555-0100')
    expect(TELL_WORDS.billSubline('the water heater', '$1,850.00')).toBe('The bill for the water heater · $1,850.00')
    expect(TELL_WORDS.billSubline(null, '$1,850.00')).toBe('The bill · $1,850.00')
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

describe('the bill’s pay page in the sheet (v2.5628)', () => {
  it('fills {bill} from the job’s newest bill, and leaves it so the press holds when the bill has no pay page', () => {
    const line = { text: '{first}, here is a copy of your last bill: {bill}.', textEs: '' }
    const withBill = tellFills({ customerName: 'Dana Whitfield', me: 'Tanya Reyes', jobName: 'Whitfield water heater', jobAddress: null, billLink: 'https://clicktooling.com/pay/8f3k2q' })
    expect(tellWords(line, withBill, 'en')).toEqual({ text: 'Dana, here is a copy of your last bill: https://clicktooling.com/pay/8f3k2q.', left: [] })
    const without = tellFills({ customerName: 'Dana Whitfield', me: 'Tanya Reyes', jobName: 'Whitfield water heater', jobAddress: null, billLink: null })
    expect(tellWords(line, without, 'en').left).toEqual(['bill'])
  })
})
