/**
 * The trade portal page's reads (P1b-ii-b): the function's answer, the plans' links, the messages as they went and
 * the home's words, through the sample `gc-trade-portal` answers for the sample token.
 */
import { describe, expect, it } from 'vitest'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { TRADE_SUBMIT_ERROR_KEYS } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { portalAsks } from './portal'
import { PORTAL_SPANISH_ON, portalShownLang, portalString } from './portalI18n'
import { askChips, askWhen, pastWords, portalHomeGroups, readTradePortalAnswer, replyByEmailWords, sentMessages, setDriveUrl, TRADE_ERROR_WORDS, tradeErrorWords, tradePortalPath, tradePortalUrl } from './tradePortalPage'
import { tradePortalState } from './tradePortalState'

const TODAY = '2026-10-08'
const slice = gcTradePortalSample(TODAY)
const { state, partnerId } = tradePortalState(slice, TODAY)

describe('the function’s answer', () => {
  it('reads a slice it can draw, and says whether it is the sample', () => {
    const a = readTradePortalAnswer(true, { today: TODAY, slice, sample: true })
    expect(a.kind === 'ready' && [a.today, a.sample, a.slice.company.name]).toEqual([TODAY, true, 'Sample Electric Co.'])
    const b = readTradePortalAnswer(true, { today: TODAY, slice })
    expect(b.kind === 'ready' && b.sample).toBe(false)
  })

  it('turns every refusal into a key the page says in the company’s language', () => {
    expect(readTradePortalAnswer(false, { error: 'linkOff' })).toEqual({ kind: 'error', key: 'linkOff' })
    expect(readTradePortalAnswer(false, { error: 'badRequest' })).toEqual({ kind: 'error', key: 'linkBad' })
    expect(readTradePortalAnswer(false, { error: 'failed' })).toEqual({ kind: 'error', key: 'linkFailed' })
    expect(readTradePortalAnswer(false, null)).toEqual({ kind: 'error', key: 'linkFailed' })
  })

  it('refuses a shape it cannot draw rather than drawing half a page', () => {
    expect(readTradePortalAnswer(true, { today: TODAY })).toEqual({ kind: 'error', key: 'linkFailed' })
    expect(readTradePortalAnswer(true, { today: TODAY, slice: { ...slice, invites: null } })).toEqual({ kind: 'error', key: 'linkFailed' })
    expect(readTradePortalAnswer(true, { today: TODAY, slice: { ...slice, company: [] } })).toEqual({ kind: 'error', key: 'linkFailed' })
  })

  it('opens a company’s link at /t/', () => {
    expect(tradePortalPath('abc 1')).toBe('/t/abc%201')
    expect(tradePortalUrl('https://clicktooling.com', 'abc')).toBe('https://clicktooling.com/t/abc')
  })
})

describe('the plans’ links and the messages we sent', () => {
  it('opens a set’s Drive link by its number, and nothing that is not an https link', () => {
    expect(setDriveUrl(slice, ID.project, 1)).toBe('https://drive.google.com/drive/folders/sample')
    expect(setDriveUrl(slice, ID.project, 7)).toBe('')
    expect(setDriveUrl({ ...slice, sets: [{ project_id: 'p', rev: 0, drive_url: 'javascript:alert(1)' }] }, 'p', 0)).toBe('')
  })

  it('lists the messages newest first, keeping a titled list and dropping empty lines', () => {
    const messages = sentMessages({
      ...slice,
      messages: [
        ...slice.messages,
        { id: 'm-new', subject: 'Plans changed', sent_on: '2026-10-07', lines: ['', 'A new set.', { title: 'It touches:', items: ['Lighting', ' '] }, { items: [] }], to_names: ['Dana Ortiz', ''] },
      ],
    })
    expect(messages.map((m) => m.id)).toEqual(['m-new', ID.message])
    expect(messages[0]).toEqual({ id: 'm-new', on: '2026-10-07', subject: 'Plans changed', lines: ['A new set.', { title: 'It touches:', items: ['Lighting'] }], to: ['Dana Ortiz'] })
    expect(messages[1]?.lines[2]).toEqual({ items: ['Service and gear', 'Panels and feeders'] })
  })
})

describe('the home’s words', () => {
  const { jobs, bidding, past } = portalHomeGroups(portalAsks(state, partnerId))

  it('puts the open ask under Asked to quote and the passed one under Before', () => {
    expect([jobs.length, bidding.map((a) => a.project.name), past.map((a) => a.project.name)]).toEqual([0, ['Sample Retail Shell'], ['Sample Clinic Finish Out']])
    expect(pastWords(past[0]!, 'en')).toBe('you passed')
  })

  it('says when the quote is due and what needs a look', () => {
    const ask = bidding[0]!
    expect(askWhen(ask, TODAY, 'en')).toBe('Due Mon Oct 19, 11 days left.')
    expect(askChips(ask, 'en')).toEqual([{ tone: 'grey', words: 'no quote yet' }])
    expect(askWhen(ask, '2026-10-19', 'en')).toBe('Due today, Mon Oct 19.')
    expect(askWhen(ask, '2026-10-21', 'en')).toBe('Was due Mon Oct 19.')
  })

  it('tells the company who to email its own quote file to until files come', () => {
    expect(replyByEmailWords(bidding[0]!.project, 'en')).toBe('Have your own quote file? Email it to Avery Lin (avery@example.com).')
    expect(replyByEmailWords(past[0]!.project, 'en')).toBe('Have your own quote file? Email it to Click Construction.')
  })

  it('holds Spanish until a native speaker reads it', () => {
    expect(PORTAL_SPANISH_ON).toBe(false)
    expect([portalShownLang('es'), portalShownLang('en')]).toEqual(['en', 'en'])
  })
})

describe('the words for every refusal a press can get (P2b-i)', () => {
  it('has words in both languages for every key submit-gc-trade-portal can answer', () => {
    for (const key of TRADE_SUBMIT_ERROR_KEYS) {
      const words = portalString(TRADE_ERROR_WORDS[key])
      expect([key, words.en.trim() !== '', words.es.trim() !== '']).toEqual([key, true, true])
      expect(tradeErrorWords(key, 'en'), key).not.toMatch(/[{}]/)
      expect(tradeErrorWords(key, 'es'), key).not.toMatch(/[{}]/)
    }
  })

  it('says each in the company’s words, and an unknown key as did not save', () => {
    expect(tradeErrorWords('tooMany', 'en')).toBe('That is a lot at once. Give us an hour, or call our office.')
    expect(tradeErrorWords('projectLost', 'en')).toBe('Click Construction did not win this project, so nothing more is needed on it.')
    expect(tradeErrorWords('openFirst', 'es')).toBe('Primero abra los planos.')
    expect(tradeErrorWords('somethingNew', 'en')).toBe('That did not save. Try again in a minute.')
  })
})
