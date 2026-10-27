import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DatabaseError } from '../../utils/errorHandling'
import { portalString } from '../gc/portalI18n'
import { PROMISE_MAX_DAYS_AHEAD, promiseDateProblem } from '../../../supabase/functions/_shared/portalPromise'
import {
  knownPortalRefusal,
  PORTAL_KNOWN_REFUSALS,
  portalFailure,
  portalFailureCause,
  portalFailureFromAnswer,
  portalFailureFromError,
  portalFailureFromStatus,
  portalFailureKind,
  type PortalAct,
  type PortalFailureKind,
} from './portalFailure'

const KINDS: PortalFailureKind[] = ['network', 'gone', 'refused']
const ACTS: PortalAct[] = ['open', 'send']
const PHONE = '(512) 360-0599'

describe('portalFailureKind: the class of a thrown value, never its words (v2.5965)', () => {
  it('a rejected fetch is the network, in every engine’s words', () => {
    expect(portalFailureKind(new TypeError('Failed to fetch'))).toBe('network')
    expect(portalFailureKind(new TypeError('Load failed'))).toBe('network')
    expect(portalFailureKind(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('network')
  })

  it('a plain result error from a dead signal is the network too', () => {
    expect(portalFailureKind({ message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' })).toBe('network')
  })

  it('anything else is a refusal: a coded answer, the page’s own bug, a bad body', () => {
    expect(portalFailureKind(new DatabaseError('x', '42501'))).toBe('refused')
    expect(portalFailureKind(new SyntaxError('Unexpected token < in JSON at position 0'))).toBe('refused')
    expect(portalFailureKind(new TypeError('x is not a function'))).toBe('refused')
    expect(portalFailureKind(null)).toBe('refused')
  })
})

describe('the class words', () => {
  it('a lost signal on a send says nothing was sent and offers Try again, never the office’s number', () => {
    const f = portalFailureFromError(new TypeError('Failed to fetch'), 'send', 'en', { phone: PHONE })
    expect(f).toEqual({
      kind: 'network',
      title: 'No connection',
      detail: 'Nothing was sent. Check your signal and try again.',
      message: 'No connection. Nothing was sent. Check your signal and try again.',
      tryAgain: true,
      phone: null,
      known: null,
    })
    expect(portalFailureFromError(new TypeError('Failed to fetch'), 'send', 'es').message).toBe(
      'Sin conexión. No se envió nada. Revise su señal e intente de nuevo.',
    )
  })

  it('a lost signal on a load offers Try again', () => {
    expect(portalFailureFromError(new TypeError('Load failed'), 'open').message).toBe('No connection. Check your signal and try again.')
    expect(portalFailureFromError(new TypeError('Load failed'), 'open').tryAgain).toBe(true)
  })

  it('a refused send asks them to call where the page has the number, and to try later where it has none; never the server’s words', () => {
    const withPhone = portalFailureFromError(new Error('new row violates row-level security policy for table "x"'), 'send', 'en', { phone: PHONE })
    expect(withPhone.message).toBe("We couldn't record that. Please call the office.")
    expect(withPhone.phone).toBe(PHONE)
    expect(withPhone.tryAgain).toBe(false)
    expect(withPhone.message).not.toContain('row-level')
    const noPhone = portalFailureFromStatus(500, 'send')
    expect(noPhone.message).toBe("We couldn't record that. Please try again later.")
    expect(noPhone.phone).toBeNull()
    expect(portalFailureFromStatus(500, 'send', 'es', { phone: PHONE }).message).toBe('No pudimos registrar eso. Llame a la oficina.')
    expect(portalFailureFromStatus(500, 'send', 'es').message).toBe('No pudimos registrar eso. Intente de nuevo más tarde.')
    expect(portalFailureFromStatus(500, 'send', 'en', { phone: '   ' }).message).toBe("We couldn't record that. Please try again later.")
  })

  it('a refused load says the page did not open and offers Try again, since a refused read may be passing', () => {
    const f = portalFailureFromStatus(500, 'open')
    expect(f.message).toBe("We couldn't open this page. Please try again later.")
    expect(f.tryAgain).toBe(true)
    expect(portalFailureFromStatus(500, 'open', 'en', { phone: PHONE }).message).toBe("We couldn't open this page. Please call the office.")
    expect(portalFailureFromStatus(400, 'open').kind).toBe('refused')
  })

  it('a load answered 404 or 410 is a gone link, with no Try again; on a send the same status is a refusal', () => {
    for (const status of [404, 410]) {
      const f = portalFailureFromStatus(status, 'open', 'en', { phone: PHONE })
      expect(f.kind).toBe('gone')
      expect(f.message).toBe('This link is no longer active. Please call the office for a new one.')
      expect(f.tryAgain).toBe(false)
      expect(f.phone).toBe(PHONE)
      expect(portalFailureFromStatus(status, 'send').kind).toBe('refused')
    }
    expect(portalFailureFromStatus(404, 'open', 'es').message).toBe('Este enlace ya no está activo. Llame a la oficina para pedir uno nuevo.')
  })

  it('a page with no language reads English', () => {
    expect(portalFailure('refused', 'send').title).toBe("We couldn't record that")
  })

  it('every class sentence in both languages, with a number and without, keeps the plain-words rules', () => {
    for (const lang of ['en', 'es'] as const)
      for (const kind of KINDS)
        for (const act of ACTS)
          for (const phone of [null, PHONE]) {
            const f = portalFailure(kind, act, lang, { phone })
            expect(plainWordsFailures(f.message), `${lang} ${kind} ${act} ${phone}`).toEqual([])
            expect(f.title.endsWith('.'), 'a heading carries no stop').toBe(false)
          }
  })
})

describe('the sentences our own functions write for the person reading (v2.5965)', () => {
  it('every known sentence maps to its key, in English and in Spanish, on a send', () => {
    expect(PORTAL_KNOWN_REFUSALS.length).toBeGreaterThan(100)
    for (const key of PORTAL_KNOWN_REFUSALS) {
      const { en, es } = portalString(key)
      expect(knownPortalRefusal(en), key).toBe(key)
      expect(knownPortalRefusal(`  ${en}\n`), `${key} after trim`).toBe(key)
      const inEnglish = portalFailureFromAnswer(409, { error: en }, 'send')
      expect(inEnglish.title, key).toBe(en)
      expect(inEnglish).toMatchObject({ kind: 'refused', tryAgain: false, known: key, detail: '' })
      expect(inEnglish.message, key).toBe(en)
      const inSpanish = portalFailureFromAnswer(409, { error: en }, 'send', 'es')
      expect(inSpanish.title, key).toBe(es)
      expect(inSpanish.title, `${key} is translated`).not.toBe(en)
    }
  })

  it('the offer that expired and the change order already answered read as the function wrote them', () => {
    const offer = portalFailureFromAnswer(409, { error: 'This offer has expired — call the office if you still want it.' }, 'send', 'es', { phone: PHONE })
    expect(offer.message).toBe('Esta oferta ya venció. Llame a la oficina si todavía la quiere.')
    expect(offer.detail).toBe('')
    const answered = portalFailureFromAnswer(409, { error: 'That change order is already answered.' }, 'send', 'en', { phone: PHONE })
    expect(answered.title).toBe('That change order is already answered.')
    expect(answered.message).toBe('That change order is already answered. Please call the office.')
    expect(answered.phone).toBe(PHONE)
    expect(portalFailureFromAnswer(409, { error: 'That change order is already answered.' }, 'send').message).toBe('That change order is already answered.')
    expect(portalFailureFromAnswer(409, { error: 'This request is closed' }, 'send', 'en', { phone: PHONE }).message).toBe('This request is closed. Please call the office.')
  })

  it('an unknown sentence, a pass-through or a near match reads exactly the class words', () => {
    for (const error of [
      'duplicate key value violates unique constraint "jobs_ledger_pkey"',
      'Bad request',
      'Missing token',
      'Internal error',
      'That change order is already answered',
      'that change order is already answered.',
      'This offer has expired',
    ]) {
      expect(knownPortalRefusal(error), error).toBeNull()
      expect(portalFailureFromAnswer(409, { error }, 'send', 'en', { phone: PHONE }), error).toEqual(portalFailureFromStatus(409, 'send', 'en', { phone: PHONE }))
      expect(portalFailureFromAnswer(500, { error }, 'open', 'es'), error).toEqual(portalFailureFromStatus(500, 'open', 'es'))
    }
  })

  it('an error that is not a string, or no body at all, reads the class words', () => {
    for (const body of [{ error: { message: 'That change order is already answered.' } }, { error: 42 }, { error: null }, {}, null, 'That change order is already answered.', undefined]) {
      expect(portalFailureFromAnswer(409, body, 'send'), JSON.stringify(body)).toEqual(portalFailureFromStatus(409, 'send'))
    }
    expect(knownPortalRefusal(undefined)).toBeNull()
    expect(knownPortalRefusal(['This review is closed.'])).toBeNull()
  })

  it('the status still decides the class: a dead link’s own sentence keeps the gone link’s presses, a refused load keeps Try again', () => {
    const gone = portalFailureFromAnswer(404, { error: 'This link is no longer active. Please contact our office for a new one.' }, 'open', 'en', { phone: PHONE })
    expect(gone).toMatchObject({ kind: 'gone', tryAgain: false, title: 'This link is no longer active. Please contact our office for a new one.', detail: '', phone: PHONE })
    expect(portalFailureCause(404, { error: 'This link has run out. Ask the office to send you a new one.' }, 'open')).toEqual({ kind: 'gone', known: 'saidLinkRanOut' })
    expect(portalFailureCause(409, { error: 'Not found' }, 'open')).toBe('refused')
    expect(portalFailureFromAnswer(409, { error: 'This contract has already been signed.' }, 'open').tryAgain).toBe(true)
  })

  it('each English sentence is the function’s own, word for word, in a public function’s source', () => {
    const root = resolve(__dirname, '../../../supabase/functions')
    const files = [
      'submit-portal-request', 'customer-portal', 'sub-portal', 'sign-owner-records', 'get-bid-proposal-room', 'sign-bid-room',
      'get-contract-for-signer', 'accept-contract', 'get-estimate-for-customer', 'accept-estimate', 'gc-word-ask', 'get-job-contract',
      'sign-job-contract', 'pay-link', 'submit-sub-portal', 'get-submittal-room', 'submit-submittal-review', 'get-estimate-public-terms',
      'get-rfq-quote-page', 'submit-rfq-quote', 'legal-notify-dispatch',
    ]
      .map((fn) => `${fn}/index.ts`)
      .concat(['gcPortal', 'portalPromise', 'stageAsk', 'clausePaper', 'estimateOptions', 'gcWordAsk', 'subPick', 'submittalReviewActions', 'legalEmails'].map((f) => `_shared/${f}.ts`))
    const literals = new Set<string>()
    for (const file of files) {
      const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.add(node.text)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    // The one sentence built from a constant: the promise's farthest day.
    literals.add(promiseDateProblem('2099-01-01', '2026-10-26') ?? '')
    expect(portalString('saidDateTooFar').en).toBe(`Please pick a date within the next ${PROMISE_MAX_DAYS_AHEAD} days, or call our office.`)
    const missing = PORTAL_KNOWN_REFUSALS.filter((key) => !literals.has(portalString(key).en))
    expect(missing).toEqual([])
  })

  it('the Spanish keeps the plain-words rules (the English is the function’s, quoted as written)', () => {
    const failing = PORTAL_KNOWN_REFUSALS.flatMap((key) => plainWordsFailures(portalString(key).es).map((f) => `${key}: ${f}`))
    expect(failing).toEqual([])
  })
})
