import { describe, expect, it } from 'vitest'
import {
  boardHref,
  callbackHourFor,
  callbackWords,
  inRun,
  runCallbackNote,
  runCallbackTitle,
  runFromSearch,
  runHeadWords,
  runHref,
  runPosition,
  phoneKey,
  runReceipt,
  runTextNote,
  runTextNumber,
  runTextPlan,
  runTextWords,
  TEXT_NO_CHANNEL,
  TEXT_NO_NUMBER,
} from './callRun'

describe('callRun: the link', () => {
  it('reads the run from the link and writes it back', () => {
    const href = runHref(['a', 'b', 'c'], 'Fire sprinkler', 'p1', 'k1')
    expect(href).toBe('/prospects?tab=follow-up&kind=subs&run=a%2Cb%2Cc&trade=Fire+sprinkler&for=p1&pkg=k1')
    const run = runFromSearch(href.slice(href.indexOf('?')))
    expect(run).toEqual({ ids: ['a', 'b', 'c'], trade: 'Fire sprinkler', projectId: 'p1', packageId: 'k1' })
    expect(runFromSearch('?tab=follow-up&kind=subs')).toBeNull()
    expect(runFromSearch('?run=,,')).toBeNull()
    expect(runFromSearch('?run=a,a,b')!.ids).toEqual(['a', 'b'])
    expect(runHref(['a'], null, null, null)).toBe('/prospects?tab=follow-up&kind=subs&run=a')
    expect(boardHref('p1')).toBe('/prospects?tab=board&kind=subs&for=p1')
    expect(boardHref(null)).toBe('/prospects?tab=board&kind=subs')
  })

  it('says where the caller stands and heads the deck', () => {
    const run = { ids: ['a', 'b', 'c'], trade: 'Fire sprinkler', projectId: 'p1', packageId: null }
    expect(runPosition(run, 'b')).toEqual({ at: 2, of: 3 })
    expect(runPosition(run, 'zz')).toEqual({ at: 0, of: 3 })
    expect(runHeadWords(run, 'Oak Run Clinic', 2, 3)).toBe('Run · Fire sprinkler · for Oak Run Clinic · 2 of 3')
    expect(runHeadWords({ ...run, trade: null }, null, 1, 1)).toBe('Run · 1 of 1')
    expect(inRun(run, 'c')).toBe(true)
    expect(inRun(null, 'c')).toBe(false)
  })
})

describe('callRun: a missed call', () => {
  it('sets the callback for 3 pm while the afternoon is young, else 10 am the next day', () => {
    const morning = new Date(2026, 9, 29, 9, 15)
    const at = callbackHourFor(morning)
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([29, 15, 0])
    expect(callbackWords(at, morning)).toBe('callback set today 3 pm')
    const late = new Date(2026, 9, 29, 16, 5)
    const next = callbackHourFor(late)
    expect([next.getDate(), next.getHours()]).toEqual([30, 10])
    expect(callbackWords(next, late)).toBe('callback set Fri 10 am')
  })

  it('writes the callback as Set callback does, with the run in the note', () => {
    expect(runCallbackTitle('Alamo Sprinkler Co', 'Dana Reyes')).toBe('Call back: Alamo Sprinkler Co - Dana Reyes')
    expect(runCallbackTitle(null, null)).toBe('Call back: Unknown - Unknown')
    expect(runCallbackNote('Fire sprinkler', 'Oak Run Clinic')).toBe('From a run: Fire sprinkler scope on Oak Run Clinic. They did not answer.')
    expect(runCallbackNote(null, null)).toBe('From a run. They did not answer.')
  })

  it('writes the text in the office’s words', () => {
    expect(runTextWords({ caller: 'Marisol', company: 'Click Plumbing', trade: 'Fire sprinkler', projectName: 'Oak Run Clinic' })).toBe(
      'Marisol at Click Plumbing here. We have a set of plans with a fire sprinkler scope on Oak Run Clinic and would like your quote. Call us back when you can.',
    )
    expect(runTextWords({ caller: null, company: 'Click Plumbing', trade: 'HVAC', projectName: null })).toBe(
      'Click Plumbing here. We have a set of plans with a HVAC scope and would like your quote. Call us back when you can.',
    )
    expect(runTextWords({ caller: 'Grace', company: 'Click Plumbing', trade: null, projectName: null })).toContain('a scope in your trade')
  })
})

describe('callRun: the receipt', () => {
  const now = new Date(2026, 9, 29, 11, 0)
  const at = callbackHourFor(now)
  it('says what the run did', () => {
    expect(
      runReceipt(
        [
          { id: 'a', kind: 'bench', asked: true },
          { id: 'b', kind: 'didnt_answer', texted: true },
          { id: 'c', kind: 'didnt_answer' },
        ],
        at,
        now,
      ),
    ).toEqual(['1 will quote and is asked', '2 to call back today 3 pm, 1 texted'])
    expect(runReceipt([{ id: 'a', kind: 'bench' }, { id: 'b', kind: 'bench', asked: true }, { id: 'c', kind: 'answered' }, { id: 'd', kind: 'not_a_fit' }], null, now)).toEqual([
      '2 will quote, 1 asked',
      '1 talked to',
      '1 out of the queue',
    ])
    expect(runReceipt([], null, now)).toEqual(['nothing logged'])
  })
})

describe('callRun: the first text starts the thread (v2.6032)', () => {
  const yes = { ok_to_text: 'yes', contact_name: 'Dana Ruiz', company_name: 'Alamo Sprinkler Co', phone_number: '(210) 555-0113', contact_phone: '210-555-0199' }
  const ch = (id: string, value: string, optedOutAt: string | null = null) => ({ id, kind: 'phone', value, optedOutAt })

  it('keys a number as the spine does', () => {
    expect(phoneKey('(210) 555-0113')).toBe('2105550113')
    expect(phoneKey('+1 210 555 0113')).toBe('2105550113')
    expect(phoneKey('555-01')).toBe('')
    expect(phoneKey(null)).toBe('')
  })

  it('texts the person’s own cell first, else the company line', () => {
    expect(runTextNumber(yes)).toBe('210-555-0199')
    expect(runTextNumber({ ...yes, contact_phone: null })).toBe('(210) 555-0113')
    expect(runTextNumber({ ...yes, contact_phone: '12', phone_number: null })).toBeNull()
  })

  it('holds by the texting rule before anything else', () => {
    expect(runTextPlan({ ...yes, ok_to_text: null }, null)).toMatchObject({ kind: 'hold', reason: 'notAskedToText' })
    expect(runTextPlan({ ...yes, ok_to_text: 'no' }, { contactId: 'c', channels: [ch('x', '210-555-0199')] })).toMatchObject({ kind: 'hold', reason: 'noTexts' })
  })

  it('sends to the number on their thread, the card’s number first', () => {
    const thread = { contactId: 'c', channels: [ch('old', '(512) 555-0100'), ch('cell', '2105550199')] }
    expect(runTextPlan(yes, thread)).toEqual({ kind: 'send', contactId: 'c', channelId: 'cell' })
    expect(runTextPlan({ ...yes, contact_phone: null, phone_number: null }, thread)).toEqual({ kind: 'send', contactId: 'c', channelId: 'old' })
    const stoppedCell = { contactId: 'c', channels: [ch('cell', '210-555-0199', '2026-10-01T00:00:00Z'), ch('line', '(210) 555-0113')] }
    expect(runTextPlan(yes, stoppedCell)).toEqual({ kind: 'send', contactId: 'c', channelId: 'line' })
  })

  it('starts the thread from the card’s number when there is none, then sends', () => {
    expect(runTextPlan(yes, null)).toEqual({ kind: 'start', number: '210-555-0199' })
    const emailOnly = { contactId: 'c', channels: [{ id: 'e', kind: 'email', value: 'dana@alamo.example', optedOutAt: null }] }
    expect(runTextPlan(yes, emailOnly)).toEqual({ kind: 'start', number: '210-555-0199' })
    expect(runTextPlan(yes, { contactId: 'c', channels: [ch('cell', '210-555-0199')] }, true)).toEqual({ kind: 'send', contactId: 'c', channelId: 'cell' })
  })

  it('holds with what to do when the card has no number', () => {
    expect(runTextPlan({ ...yes, contact_phone: null, phone_number: null }, null)).toEqual({ kind: 'hold', reason: 'noNumber', words: TEXT_NO_NUMBER })
  })

  it('holds with a call when their number sent STOP, and starts nothing', () => {
    const stopped = { contactId: 'c', channels: [ch('cell', '210-555-0199', '2026-10-01T00:00:00Z')] }
    expect(runTextPlan(yes, stopped)).toEqual({ kind: 'hold', reason: 'stopped', words: 'Dana Ruiz texted STOP from their number. Call them instead.' })
  })

  it('never starts twice', () => {
    expect(runTextPlan(yes, { contactId: 'c', channels: [] }, true)).toEqual({ kind: 'hold', reason: 'noChannel', words: TEXT_NO_CHANNEL })
  })

  it('notes the text on the card, and the thread it started', () => {
    expect(runTextNote('Hi.', false)).toBe('Text sent: Hi.')
    expect(runTextNote('Hi.', true)).toBe('Text sent: Hi. This first text started their Messages thread.')
  })
})
