/**
 * The trade portal's writes (P2b-i): what `submit-gc-trade-portal` reads from a request before it calls a
 * `gc_trade_<verb>`, its hourly cap, its refusal keys and Spanish's hold. The words for every key are in
 * `tradePortalPage.test.ts`; the link rule is `gcTradeLink.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { sampleStateFromToken } from '../../../supabase/functions/_shared/customerSample'
import {
  FREE_TEXT_KINDS,
  PORTAL_SPANISH_ON as FUNCTION_SPANISH_ON,
  TRADE_HOURLY_CAP,
  TRADE_SUBMIT_ERROR_KEYS,
  TRADE_SUBMIT_KINDS,
  isHoneypot,
  overHourlyCap,
  parseTradeSubmit,
  spanishHeld,
  tradeErrorOf,
} from '../../../supabase/functions/_shared/gcTradeSubmit'
import { PORTAL_SPANISH_ON } from './portalI18n'

const TOKEN = '0123456789abcdef0123456789abcdef'
const ASK = '11111111-1111-4111-8111-111111111111'
const LINE = '22222222-2222-4222-8222-222222222222'
const PERSON = '33333333-3333-4333-8333-333333333333'
const TRADE = '44444444-4444-4444-8444-444444444444'

const call = (kind: string, fields: Record<string, unknown> = {}) => {
  const parsed = parseTradeSubmit({ token: TOKEN, kind, ...fields })
  return parsed.ok ? parsed.call : null
}

describe('each kind, read into its verb', () => {
  it('reads every kind the portal sends', () => {
    expect(call('got_it')).toEqual({ rpc: 'gc_trade_got_it', params: {} })
    expect(call('set_lang', { lang: 'es' })).toEqual({ rpc: 'gc_trade_set_lang', params: { p_lang: 'es' } })
    expect(call('add_person', { name: ' Ana ', email: 'ana@example.com', role: 'Estimator', gets: ['pay', 'bogus', 'quotes', 'pay'] })).toEqual({
      rpc: 'gc_trade_add_person',
      params: { p_name: 'Ana', p_email: 'ana@example.com', p_role: 'Estimator', p_gets: ['quotes', 'pay'] },
    })
    expect(call('remove_person', { personId: PERSON })).toEqual({ rpc: 'gc_trade_remove_person', params: { p_person_id: PERSON } })
    expect(call('set_gets', { personId: null, gets: ['job'] })).toEqual({ rpc: 'gc_trade_set_gets', params: { p_person_id: null, p_gets: ['job'] } })
    expect(call('open_plans', { inviteId: ASK })).toEqual({ rpc: 'gc_trade_open_plans', params: { p_invite_id: ASK } })
    expect(call('quote_day', { inviteId: ASK, by: '2026-10-12' })).toEqual({ rpc: 'gc_trade_quote_day', params: { p_invite_id: ASK, p_by: '2026-10-12' } })
    expect(call('confirm_quote', { inviteId: ASK })?.rpc).toBe('gc_trade_confirm_quote')
    expect(call('answer_lines', { inviteId: ASK, answers: { [LINE]: 'no' } })).toEqual({ rpc: 'gc_trade_answer_lines', params: { p_invite_id: ASK, p_answers: { [LINE]: 'no' } } })
    expect(call('decline', { inviteId: ASK })?.rpc).toBe('gc_trade_decline')
    expect(call('ask_question', { packageId: TRADE, text: ' Which panel? ', sheets: ['E-101', ' '] })).toEqual({
      rpc: 'gc_trade_ask_question',
      params: { p_package_id: TRADE, p_text: 'Which panel?', p_sheets: ['E-101'] },
    })
    expect(TRADE_SUBMIT_KINDS).toHaveLength(12)
  })

  it('reads a quote as the form builds it, and leaves what the numbers mean to the SQL', () => {
    expect(
      call('submit_quote', {
        inviteId: ASK,
        quote: {
          amount: 64200,
          includes: { [LINE]: 'yes' },
          note: ' Copper ',
          goodForDays: 30,
          alternates: [{ label: 'LED fixtures', amount: -1200 }],
          sov: [{ label: 'Rough', amount: 64200 }],
          exclusions: [{ name: 'Permits', said: 'permits and fees', unitPrice: { amount: 85, unit: 'each' } }],
          exclusionsAnswered: ['Permits'],
        },
      }),
    ).toEqual({
      rpc: 'gc_trade_submit_quote',
      params: {
        p_invite_id: ASK,
        q: {
          amount: 64200,
          includes: { [LINE]: 'yes' },
          note: 'Copper',
          goodForDays: 30,
          alternates: [{ label: 'LED fixtures', amount: -1200 }],
          sov: [{ label: 'Rough', amount: 64200 }],
          exclusions: [{ name: 'Permits', said: 'permits and fees', unitPrice: { amount: 85, unit: 'each' } }],
          exclusionsAnswered: ['Permits'],
        },
      },
    })
    // No amount reaches the SQL as null, which answers amountNeeded in the company's words.
    expect(call('submit_quote', { inviteId: ASK, quote: {} })).toEqual({ rpc: 'gc_trade_submit_quote', params: { p_invite_id: ASK, q: { amount: null, includes: {}, note: '', alternates: [] } } })
  })

  it('refuses a shape the portal never sends', () => {
    const bad = [
      { kind: 'drop_table' },
      { kind: 'open_plans', inviteId: 'not-a-uuid' },
      { kind: 'open_plans' },
      { kind: 'set_lang', lang: 'fr' },
      { kind: 'quote_day', inviteId: ASK, by: '12/10/2026' },
      { kind: 'quote_day', inviteId: ASK, by: '2026-13-45' },
      { kind: 'add_person', name: 'x'.repeat(121), email: 'a@b.co', gets: ['job'] },
      { kind: 'ask_question', packageId: TRADE, text: 'x'.repeat(2001) },
      { kind: 'ask_question', packageId: TRADE, text: 'Q', sheets: 'E-101' },
      { kind: 'answer_lines', inviteId: ASK, answers: { [LINE]: 'unclear' } },
      { kind: 'answer_lines', inviteId: ASK, answers: { 'not-a-line': 'yes' } },
      { kind: 'submit_quote', inviteId: ASK, quote: { amount: '64200' } },
      { kind: 'submit_quote', inviteId: ASK, quote: { amount: 1, sov: [{ label: 'Rough', amount: 'lots' }] } },
      { kind: 'submit_quote', inviteId: ASK, quote: { amount: 1, alternates: 'none' } },
      { kind: 'submit_quote', inviteId: ASK, quote: { amount: 1, exclusions: [{ name: '' }] } },
    ]
    for (const fields of bad) expect(parseTradeSubmit({ token: TOKEN, ...fields }), JSON.stringify(fields).slice(0, 80)).toEqual({ ok: false })
    expect(parseTradeSubmit(null)).toEqual({ ok: false })
    expect(parseTradeSubmit({ kind: 'got_it' })).toEqual({ ok: false })
  })
})

describe('before the verb', () => {
  it('answers a filled honeypot as if it worked, and knows the sample token', () => {
    expect([isHoneypot({ website: 'http://spam' }), isHoneypot({ website: ' ' }), isHoneypot({})]).toEqual([true, false, false])
    const sample = parseTradeSubmit({ token: 'sample', kind: 'got_it' })
    expect(sample.ok && sampleStateFromToken(sample.token)).toBe('live')
  })

  it('holds Spanish with the same flag the page reads', () => {
    expect(FUNCTION_SPANISH_ON).toBe(PORTAL_SPANISH_ON)
    expect([spanishHeld(call('set_lang', { lang: 'es' })!), spanishHeld(call('set_lang', { lang: 'en' })!)]).toEqual([!PORTAL_SPANISH_ON, false])
  })

  it('caps free-text writes at ten an hour, and only the free-text kinds', () => {
    expect(TRADE_HOURLY_CAP).toBe(10)
    expect(overHourlyCap([3, 2, 1, 3])).toBe(false)
    expect(overHourlyCap([4, 2, 1, 3])).toBe(true)
    expect(overHourlyCap([null, undefined, 10, 0])).toBe(true)
    expect([...FREE_TEXT_KINDS].sort()).toEqual(['add_person', 'ask_question', 'quote_day', 'submit_quote'])
  })
})

describe('the verb’s refusals', () => {
  it('passes a known key through with its status', () => {
    expect(tradeErrorOf({ code: 'P0001', message: 'notYours' })).toEqual({ key: 'notYours', status: 409 })
    expect(tradeErrorOf({ code: 'P0001', message: 'questionsClosed' })).toEqual({ key: 'questionsClosed', status: 409 })
    expect(tradeErrorOf({ code: 'P0001', message: 'sovMustAdd' })).toEqual({ key: 'sovMustAdd', status: 400 })
    expect(tradeErrorOf({ code: 'P0001', message: 'notFound' })).toEqual({ key: 'notFound', status: 404 })
  })

  it('answers failed for anything it does not know, never the raw message', () => {
    expect(tradeErrorOf({ code: 'P0001', message: 'We lost this bid.' })).toEqual({ key: 'failed', status: 500 })
    expect(tradeErrorOf({ code: '22P02', message: 'invalid input syntax' })).toEqual({ key: 'failed', status: 500 })
    expect(tradeErrorOf({ code: 'P0001', message: 'toString' })).toEqual({ key: 'failed', status: 500 })
    expect(tradeErrorOf(null)).toEqual({ key: 'failed', status: 500 })
  })

  it('lists every key once, the function’s and the SQL’s', () => {
    expect(new Set(TRADE_SUBMIT_ERROR_KEYS).size).toBe(TRADE_SUBMIT_ERROR_KEYS.length)
    expect(TRADE_SUBMIT_ERROR_KEYS).toEqual(expect.arrayContaining(['badRequest', 'linkOff', 'spanishHeld', 'tooMany', 'failed', 'notYours', 'everyKindNeedsSomeone', 'tooLong']))
  })
})
