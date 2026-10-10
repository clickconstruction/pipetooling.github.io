/**
 * The trade portal's writes (P2b-i): what `submit-gc-trade-portal` reads from a request before it calls a
 * `gc_trade_<verb>`, its hourly cap, its refusal keys and Spanish's hold. The words for every key are in
 * `tradePortalPage.test.ts`; the link rule is `gcTradeLink.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sampleStateFromToken } from '../../../supabase/functions/_shared/customerSample'
import {
  FREE_TEXT_KINDS,
  PORTAL_SPANISH_ON as FUNCTION_SPANISH_ON,
  TRADE_HOURLY_CAP,
  TRADE_SQL_ERRORS,
  TRADE_SUBMIT_ERROR_KEYS,
  TRADE_SUBMIT_KINDS,
  isHoneypot,
  overHourlyCap,
  parseTradeSubmit,
  SIGNATURE_PNG_MAX_BYTES,
  signaturePngOf,
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

const CHARGE = '55555555-5555-4555-8555-555555555555'

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
    expect(TRADE_SUBMIT_KINDS).toHaveLength(18)
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

  it('reads a charge’s answer and a change asked for (P4b-i)', () => {
    expect(call('answer_back_charge', { chargeId: CHARGE, agree: false, note: ' We swept before we left. ' })).toEqual({
      rpc: 'gc_trade_answer_back_charge',
      params: { p_charge_id: CHARGE, p_agree: false, p_note: 'We swept before we left.' },
    })
    expect(call('answer_back_charge', { chargeId: CHARGE, agree: true })).toEqual({ rpc: 'gc_trade_answer_back_charge', params: { p_charge_id: CHARGE, p_agree: true, p_note: '' } })
    expect(call('ask_change', { packageId: TRADE, description: ' Hidden rot behind the east wall. ', reason: 'field', amount: 14820, days: 2 })).toEqual({
      rpc: 'gc_trade_ask_change',
      params: { p_package_id: TRADE, p_description: 'Hidden rot behind the east wall.', p_reason: 'field', p_amount: 14820, p_days: 2 },
    })
    // No days is none; no amount goes to the SQL, which says amountNeeded in the company's words.
    expect(call('ask_change', { packageId: TRADE, description: 'Rot', reason: 'owner' })).toEqual({
      rpc: 'gc_trade_ask_change',
      params: { p_package_id: TRADE, p_description: 'Rot', p_reason: 'owner', p_amount: null, p_days: 0 },
    })
  })

  describe('the punch list, a submittal and a question while we build (P5c-2)', () => {
    const ITEM = '77777777-7777-4777-8777-777777777777'
    const SUBMITTAL = '88888888-8888-4888-8888-888888888888'

    it('reads a punch item fixed, a submittal round with its file, and a question with its sheets', () => {
      expect(call('punch_fixed', { itemId: ITEM })).toEqual({ rpc: 'gc_trade_punch_fixed', params: { p_item_id: ITEM } })
      expect(call('submittal_send', { submittalId: SUBMITTAL, fileName: ' panels.pdf ', driveUrl: ' https://drive.google.com/file/d/x ', note: ' Square D. ' })).toEqual({
        rpc: 'gc_trade_submittal_send',
        params: { p_submittal_id: SUBMITTAL, p_file_name: 'panels.pdf', p_drive_url: 'https://drive.google.com/file/d/x', p_note: 'Square D.' },
      })
      expect(call('rfi_ask', { packageId: TRADE, question: ' Recessed panel? ', sheets: ['E-201', ' ', 'E-301'] })).toEqual({
        rpc: 'gc_trade_rfi_ask',
        params: { p_package_id: TRADE, p_question: 'Recessed panel?', p_sheets: ['E-201', 'E-301'] },
      })
    })

    it('leaves a blank file name and no Drive link to the SQL, which says fileNeeded in the company’s words', () => {
      expect(call('submittal_send', { submittalId: SUBMITTAL, fileName: '', driveUrl: '' })).toEqual({
        rpc: 'gc_trade_submittal_send',
        params: { p_submittal_id: SUBMITTAL, p_file_name: '', p_drive_url: null, p_note: '' },
      })
    })

    it('refuses a Drive link that is not https, a file name past 200 characters, and a question that is no trade', () => {
      for (const bad of [
        { kind: 'submittal_send', submittalId: SUBMITTAL, fileName: 'a.pdf', driveUrl: 'http://drive.google.com/x' },
        { kind: 'submittal_send', submittalId: SUBMITTAL, fileName: 'a.pdf', driveUrl: 'javascript:alert(1)' },
        { kind: 'submittal_send', submittalId: SUBMITTAL, fileName: 'x'.repeat(201) },
        { kind: 'punch_fixed', itemId: 'item-1' },
        { kind: 'rfi_ask', packageId: 'pkg', question: 'Q?' },
        { kind: 'rfi_ask', packageId: TRADE, question: 'x'.repeat(2001) },
      ]) {
        expect(parseTradeSubmit({ token: TOKEN, ...bad }), JSON.stringify(bad).slice(0, 80)).toEqual({ ok: false })
      }
    })

    it('says the four keys with their statuses', () => {
      expect(tradeErrorOf({ code: 'P0001', message: 'punchNotOpen' })).toEqual({ key: 'punchNotOpen', status: 409 })
      expect(tradeErrorOf({ code: 'P0001', message: 'notYourMove' })).toEqual({ key: 'notYourMove', status: 409 })
      expect(tradeErrorOf({ code: 'P0001', message: 'jobNotBuilding' })).toEqual({ key: 'jobNotBuilding', status: 409 })
      expect(tradeErrorOf({ code: 'P0001', message: 'fileNeeded' })).toEqual({ key: 'fileNeeded', status: 400 })
    })
  })

  describe('a statement of work signed (P2c-ii)', () => {
    const SOW = '66666666-6666-4666-8666-666666666666'
    // The smallest PNG: its eight magic bytes and an empty IHDR's start, as the pad's data URL would carry it.
    const PNG = `data:image/png;base64,${btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13))}`
    const CONSENT = { version: 2, lang: 'en', audience: 'sub', documentNoun: 'this statement of work', clauseText: 'I agree to sign electronically.' }
    const signCall = { rpc: 'gc_trade_sign_sow', params: { p_sow_id: SOW, p_printed_name: 'Dana Whitfield', p_signature_path: null, p_ip: null, p_user_agent: null } }

    it('reads a typed signature: the name, the consent, no image, and the function fills the rest', () => {
      const parsed = parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: ' Dana Whitfield ', esignConsent: CONSENT })
      expect(parsed).toEqual({ ok: true, token: TOKEN, kind: 'sign_sow', call: signCall, sign: { png: null, consent: CONSENT } })
    })

    it('reads a drawn one as the PNG’s bytes', () => {
      const parsed = parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: 'Dana Whitfield', signaturePngBase64: PNG, esignConsent: CONSENT })
      expect(parsed.ok && parsed.call).toEqual(signCall)
      expect(parsed.ok && [...(parsed.sign?.png ?? [])].slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47])
    })

    it('refuses an image that is not a PNG we keep as a shape the portal never sends', () => {
      for (const bad of ['data:image/jpeg;base64,/9j/4AAQ', 'not base64 at all!', btoa('GIF89a, not a png'), 42]) {
        expect(parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: 'Dana', signaturePngBase64: bad, esignConsent: CONSENT })).toEqual({ ok: false })
      }
      expect(signaturePngOf(`data:image/png;base64,${btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) + 'x'.repeat(SIGNATURE_PNG_MAX_BYTES))}`)).toBeNull()
    })

    it('refuses a signature without the e-sign consent, before any write', () => {
      expect(parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: 'Dana', signaturePngBase64: PNG })).toEqual({ ok: false, key: 'consentNeeded' })
      expect(parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: 'Dana', esignConsent: { ...CONSENT, clauseText: ' ' } })).toEqual({ ok: false, key: 'consentNeeded' })
    })

    it('leaves a blank name to the SQL, and refuses one past its 200 characters or a statement of work that is no id', () => {
      expect(parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: '', esignConsent: CONSENT }).ok).toBe(true)
      expect(parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: SOW, printedName: 'x'.repeat(201), esignConsent: CONSENT })).toEqual({ ok: false })
      expect(parseTradeSubmit({ token: TOKEN, kind: 'sign_sow', sowId: 'sow-1', printedName: 'Dana', esignConsent: CONSENT })).toEqual({ ok: false })
    })

    it('is not under the hourly cap: a second press is alreadySigned', () => {
      expect(FREE_TEXT_KINDS.has('sign_sow')).toBe(false)
      expect(tradeErrorOf({ code: 'P0001', message: 'alreadySigned' })).toEqual({ key: 'alreadySigned', status: 409 })
      expect(tradeErrorOf({ code: 'P0001', message: 'msaFirst' })).toEqual({ key: 'msaFirst', status: 409 })
      expect(tradeErrorOf({ code: 'P0001', message: 'sowNotSent' })).toEqual({ key: 'sowNotSent', status: 409 })
    })
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
      { kind: 'answer_back_charge', chargeId: CHARGE, agree: 'yes' },
      { kind: 'answer_back_charge', chargeId: 'not-a-charge', agree: true },
      { kind: 'answer_back_charge', chargeId: CHARGE, agree: false, note: 'x'.repeat(2001) },
      { kind: 'ask_change', packageId: TRADE, description: 'Rot', reason: 'weather', amount: 100, days: 0 },
      { kind: 'ask_change', packageId: TRADE, description: 'Rot', reason: 'field', amount: '100', days: 0 },
      { kind: 'ask_change', packageId: TRADE, description: 'Rot', reason: 'field', amount: 100, days: 1.5 },
      { kind: 'ask_change', packageId: TRADE, description: 'x'.repeat(2001), reason: 'field', amount: 100, days: 0 },
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
    expect([...FREE_TEXT_KINDS].sort()).toEqual(['add_person', 'ask_change', 'ask_question', 'quote_day', 'rfi_ask', 'submit_quote', 'submittal_send'])
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
    expect(TRADE_SUBMIT_ERROR_KEYS).toEqual(expect.arrayContaining(['badRequest', 'linkOff', 'spanishHeld', 'tooMany', 'consentNeeded', 'failed', 'notYours', 'everyKindNeedsSomeone', 'tooLong', 'alreadySigned']))
  })

  /**
   * Keys a `gc_trade_<verb>` raises before the portal can say them, each with the PR that gives it its
   * status in TRADE_SQL_ERRORS and its words in TRADE_ERROR_WORDS. A lane whose migration adds a trade
   * verb lists its new keys here in the same PR; the PR that maps one takes it off.
   */
  const WAITING: Record<string, string> = {
    // Building's U6a, the trades' draws: a statement of work not signed, a draw waiting, nothing to bill, a split
    // line and a waiver before payment. Its second signature, alreadySigned, is mapped since P2c-ii.
    sowNotSigned: 'P5c-3',
    drawWaiting: 'P5c-3',
    nothingToBill: 'P5c-3',
    splitLine: 'P5c-3',
    notPaidYet: 'P5c-3',
    // Building's U6c, the final pay application (gc_trade_final_pay_app, through gc_final_pay_app_ask): the final
    // sent already, and asked before every line is billed and the work accepted.
    finalSent: 'P5c-3',
    finalNotYet: 'P5c-3',
  }

  /**
   * Every key a trade verb raises, its own and those of the `*_ask` helpers it returns through (P5c-2: U3b-i's
   * gc_punch_fixed_ask and U6c's gc_final_pay_app_ask raise keys the verb itself never names).
   */
  function raisedByTradeVerbs(): { verb: string; key: string }[] {
    const dir = join(process.cwd(), 'supabase', 'migrations')
    const bodies = new Map<string, string>()
    const helpers = new Map<string, string>()
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      const sql = readFileSync(join(dir, f), 'utf8')
      for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(gc_trade_[a-z_]+)\([\s\S]*?\$\$([\s\S]*?)\$\$;/g)) bodies.set(m[1]!, m[2]!)
      for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(gc_[a-z_]+_ask)\([\s\S]*?\$\$([\s\S]*?)\$\$;/g)) helpers.set(m[1]!, m[2]!)
    }
    return [...bodies].flatMap(([verb, body]) => {
      const through = [...new Set([...body.matchAll(/(gc_[a-z_]+_ask)\(/g)].map((m) => m[1]!))].filter((h) => helpers.has(h))
      return [body, ...through.map((h) => helpers.get(h)!)].flatMap((b) => [...b.matchAll(/RAISE EXCEPTION '(\w+)' USING ERRCODE = 'P0001'/g)].map((m) => ({ verb, key: m[1]! })))
    })
  }

  it('reads the keys a verb raises through its *_ask helper (P5c-2)', () => {
    const keysOf = (verb: string) => new Set(raisedByTradeVerbs().filter((r) => r.verb === verb).map((r) => r.key))
    expect(keysOf('gc_trade_punch_fixed').has('punchNotOpen')).toBe(true)
    expect([...keysOf('gc_trade_final_pay_app')].filter((k) => k === 'finalSent' || k === 'finalNotYet').sort()).toEqual(['finalNotYet', 'finalSent'])
  })

  it('maps every key a gc_trade_<verb> raises, as its newest migration defines it, or names the PR that will', () => {
    const raised = raisedByTradeVerbs()
    expect(raised.length).toBeGreaterThan(40)
    const unsaid = raised
      .filter(({ key }) => !Object.prototype.hasOwnProperty.call(TRADE_SQL_ERRORS, key) && !WAITING[key])
      .map(({ verb, key }) => `${verb}: ${key}`)
    expect(unsaid, 'map each key in TRADE_SQL_ERRORS and TRADE_ERROR_WORDS, or list it in WAITING with the PR that will').toEqual([])
  })

  it('takes a key off WAITING once it is mapped', () => {
    expect(Object.keys(WAITING).filter((k) => Object.prototype.hasOwnProperty.call(TRADE_SQL_ERRORS, k))).toEqual([])
  })
})
