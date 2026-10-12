/**
 * Messages, cut 8b-i: the customer's page (shape B) for one GC job, from what `customer-portal` sends
 * (`_shared/gcPortalPage.ts`'s `page`, the job's own block, the statement's bills and the card offer) to what each tab
 * draws: Your move, This week and Your people on Home; Money (`moneyStory`); Papers (`customerPapers`); What moved on
 * Schedule. Pure; the page draws it.
 *
 * Your move is interim. It reads the job's own facts (our contract waiting on their signature, the change orders sent,
 * the work ready to accept) through `customerMove`, as two steps laid out like the flow's. 8b-ii replaces it with the
 * customer's flow as `readFlow` reads it (`customerJobSteps`), and adds Where you are, which waits for it.
 *
 * Held for later, each its own piece: After that (the next bill sized from the billing forecast), the trades' waivers
 * and the day they were paid on a pay application's card, the master agreement on Papers, and photos on a card.
 */
import type { PortalGcPage } from '../../../supabase/functions/_shared/gcPortalPage'
import { ymdAddDays } from '../../utils/dateUtils'
import { customerMove, type CustomerMove } from '../flows/customerMove'
import type { PortalStepIn } from '../flows/portalPage'
import { SEED_FLOWS } from '../flows/seed'
import type { CustomerChange } from './moneyLines'
import { moneyStory, type MoneyStory, type PayAppIn } from './moneyStory'
import { CODE_WORDS, pDate, typed, type PageWords, type PortalLang, type PortalWordKey, type TypedLine } from './pageWords'
import { customerPapers, type CustomerContract, type CustomerPapers } from './papers'
import type { PortalBill, PortalGcJob, PortalWaiverRow } from './portalPayload'

export type { PortalGcPage }

const ymd = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)

/** The page block, or null when a field is off: a broken block leaves the job as it read before. */
export function parsePortalGcPage(raw: unknown): PortalGcPage | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const sw = p.switches && typeof p.switches === 'object' ? (p.switches as Record<string, unknown>) : null
  if (!sw || !Array.isArray(p.changes) || !Array.isArray(p.payApps)) return null
  const w = p.week && typeof p.week === 'object' ? (p.week as Record<string, unknown>) : null
  return {
    contract: n(p.contract),
    contractSignedOn: ymd(p.contractSignedOn) ? p.contractSignedOn.slice(0, 10) : null,
    architect: str(p.architect),
    payDays: typeof p.payDays === 'number' ? p.payDays : null,
    changes: p.changes.flatMap((c): PortalGcPage['changes'] => {
      const o = c && typeof c === 'object' ? (c as Record<string, unknown>) : null
      if (!o || typeof o.id !== 'string' || typeof o.number !== 'number') return []
      return [
        {
          id: o.id,
          number: o.number,
          description: str(o.description) ?? '',
          descriptionEs: str(o.descriptionEs),
          price: n(o.price),
          days: n(o.days),
          state: o.state === 'signed' ? 'signed' : 'open',
          signedOn: ymd(o.signedOn) ? o.signedOn.slice(0, 10) : null,
        },
      ]
    }),
    payApps: p.payApps.flatMap((a): PortalGcPage['payApps'] => {
      const o = a && typeof a === 'object' ? (a as Record<string, unknown>) : null
      if (!o || typeof o.id !== 'string' || typeof o.number !== 'number' || !ymd(o.periodTo) || !ymd(o.sentOn)) return []
      return [
        {
          id: o.id,
          number: o.number,
          final: o.final === true,
          periodTo: o.periodTo.slice(0, 10),
          sentOn: o.sentOn.slice(0, 10),
          due: n(o.due),
          certifiedOn: ymd(o.certifiedOn) ? o.certifiedOn.slice(0, 10) : null,
          invoiceId: str(o.invoiceId),
          customerLine: str(o.customerLine),
          customerLineEs: str(o.customerLineEs),
        },
      ]
    }),
    week: w && ymd(w.on) && str(w.line) ? { on: w.on.slice(0, 10), line: str(w.line) ?? '', lineEs: str(w.lineEs), photosUrl: str(w.photosUrl) } : null,
    people: Array.isArray(p.people)
      ? p.people.flatMap((x): PortalGcPage['people'] => {
          const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
          const name = o ? str(o.name) : null
          return o && name && (o.role === 'pm' || o.role === 'super') ? [{ role: o.role, name, phone: str(o.phone) }] : []
        })
      : [],
    moves: Array.isArray(p.moves)
      ? p.moves.flatMap((x): PortalGcPage['moves'] => {
          const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
          return o && str(o.activity) && ymd(o.madeOn) && ymd(o.from) && ymd(o.to) && str(o.reason)
            ? [{ activity: str(o.activity) ?? '', madeOn: o.madeOn.slice(0, 10), from: o.from.slice(0, 10), to: o.to.slice(0, 10), reason: str(o.reason) ?? '' }]
            : []
        })
      : [],
    switches: { photos: sw.photos === true, forecast: sw.forecast === true, spanish: sw.spanish === true },
  }
}

/** The job's change orders as the kernels take them. */
function changesOf(page: PortalGcPage): CustomerChange[] {
  return page.changes.map((c) => ({
    id: c.id,
    number: c.number,
    description: { en: c.description, es: c.descriptionEs } satisfies TypedLine,
    price: c.price,
    days: c.days,
    state: c.state,
    signedOn: c.signedOn,
  }))
}

/** A pay application as Money's card reads it: paid from its bill on the statement, due once certified, else with the architect. */
function payAppOf(a: PortalGcPage['payApps'][number], page: PortalGcPage, bills: readonly PortalBill[]): PayAppIn {
  const base = {
    n: a.number,
    month: a.periodTo,
    covers: a.customerLine ? { en: a.customerLine, es: a.customerLineEs } : null,
    amount: a.due,
    photos: 0,
  }
  const bill = a.invoiceId ? bills.find((b) => b.invoiceId === a.invoiceId) : undefined
  const paidDays = (bill?.payments ?? []).map((p) => p.date).filter((d): d is string => ymd(d)).map((d) => d.slice(0, 10))
  const dueOn = a.certifiedOn && page.payDays !== null ? ymdAddDays(a.certifiedOn, page.payDays) : null
  if (bill && bill.totalPaid >= a.due - 0.5 && paidDays.length) {
    return { ...base, state: 'paid', certifiedBy: a.certifiedOn ? page.architect : null, certifiedOn: a.certifiedOn, dueOn, paidOn: paidDays.reduce((x, y) => (y > x ? y : x)), waivers: 0, tradesPaidOn: null }
  }
  if (a.certifiedOn) return { ...base, state: 'due', certifiedBy: page.architect, certifiedOn: a.certifiedOn, dueOn }
  return { ...base, state: 'architect', architect: page.architect, withArchitectSince: a.sentOn }
}

/** The steps Your move reads until the customer's flow does (8b-ii): our contract, and the change orders. */
export function interimSteps(job: PortalGcJob, page: PortalGcPage, today: string): PortalStepIn[] {
  const seed = SEED_FLOWS.customer.lanes.flatMap((l) => l.steps)
  const named = (id: string, fallback: { en: string; es: string }) => {
    const s = seed.find((x) => x.id === id)
    return s ? { en: s.name, es: s.nameEs } : fallback
  }
  const toSign = job.contract?.state === 'toSign' && !job.contract.priceChanged
  const open = page.changes.some((c) => c.state === 'open')
  return [
    {
      id: 'contract',
      name: named('contract', { en: 'Contract signed', es: 'Contrato firmado' }),
      who: 'them',
      where: toSign ? 'now' : job.contract || page.contractSignedOn ? 'done' : 'notYet',
      papers: [{ id: 'contract', ours: true, mark: toSign ? 'wait' : job.contract || page.contractSignedOn ? 'ok' : 'no' }],
      day: toSign && job.contract?.state === 'toSign' ? { on: job.contract.signBy, late: job.contract.signBy < today } : null,
    },
    {
      id: 'co',
      name: named('co', { en: 'Change orders', es: 'Órdenes de cambio' }),
      who: 'them',
      where: open ? 'now' : 'notYet',
      loop: true,
      aside: true,
      roundNow: open,
      papers: [{ id: 'co', ours: true, mark: open ? 'wait' : 'no' }],
    },
  ]
}

/** Your move on Home: a move from `customerMove`, or the work to accept, whose press opens Papers. */
export type CustomerHomeMove = CustomerMove | { kind: 'accept'; title: string; sub: string; buttons: { label: string; primary: boolean; press: 'papers' }[] }

/** Your move on Home: the first thing we need from them, then the work to accept, else the one line. */
export function homeMove(lang: PortalLang, job: PortalGcJob, page: PortalGcPage, today: string, words: PageWords = CODE_WORDS): CustomerHomeMove {
  const move = customerMove(lang, { off: false, steps: interimSteps(job, page, today), changes: changesOf(page) }, words)
  if (move.kind === 'none' && job.canAccept) {
    return { kind: 'accept', title: words.say(lang, 'acceptTitle'), sub: words.say(lang, 'acceptWhy'), buttons: [{ label: words.say(lang, 'goToPapers'), primary: true, press: 'papers' }] }
  }
  return move
}

const REASON: Record<string, PortalWordKey> = {
  weather: 'reasonWeather',
  'trade before': 'reasonTradeBefore',
  materials: 'reasonMaterials',
  crew: 'reasonCrew',
  customer: 'reasonCustomer',
  plans: 'reasonPlans',
  inspection: 'reasonInspection',
  us: 'reasonUs',
  'change order': 'reasonChangeOrder',
  other: 'reasonOther',
  early: 'reasonEarly',
  recovery: 'reasonRecovery',
}

export interface CustomerPageModel {
  move: CustomerHomeMove
  week: { title: string; line: string; photosUrl: string | null; note: string } | null
  people: { name: string; role: string; phone: string | null }[]
  money: MoneyStory
  papers: CustomerPapers
  moves: { activity: string; when: string; why: string }[]
}

export interface CustomerPageIn {
  job: PortalGcJob
  page: PortalGcPage
  bills: readonly PortalBill[]
  waivers: readonly PortalWaiverRow[]
  /** The card's fee as a percent when the card is offered on this job; null otherwise. */
  cardFeePct: number | null
  /** The office line: our company's name and phone. */
  company: { name: string; phone: string }
  today: string
}

/** Every tab's model for one job, in one language, with the office's words. */
export function customerPageModel(lang: PortalLang, input: CustomerPageIn, opts: { showOlder?: boolean; words?: PageWords } = {}): CustomerPageModel {
  const words = opts.words ?? CODE_WORDS
  const { job, page } = input
  const changes = changesOf(page)
  const apps = page.payApps.map((a) => payAppOf(a, page, input.bills))
  const paid = page.payApps.reduce((sum, a) => {
    const bill = a.invoiceId ? input.bills.find((b) => b.invoiceId === a.invoiceId) : undefined
    return sum + Math.min(bill?.totalPaid ?? 0, a.due)
  }, 0)
  const invoices = new Set(page.payApps.map((a) => a.invoiceId).filter((x): x is string => !!x))
  const contract: CustomerContract | null =
    job.contract?.state === 'toSign'
      ? { state: 'toSign', signBy: job.contract.signBy }
      : job.contract?.state === 'signed'
        ? { state: 'signed', signedOn: job.contract.signedOn, signer: job.contract.signer }
        : page.contractSignedOn
          ? { state: 'signed', signedOn: page.contractSignedOn, signer: null }
          : null
  return {
    move: homeMove(lang, job, page, input.today, words),
    week: page.week
      ? {
          title: `${words.say(lang, 'weekTitle')} · ${pDate(lang, page.week.on)}`,
          line: typed(lang, { en: page.week.line, es: page.week.lineEs }),
          photosUrl: page.week.photosUrl,
          note: words.say(lang, 'everyFriday'),
        }
      : null,
    people: [
      { name: input.company.name, role: words.say(lang, 'roleOffice'), phone: input.company.phone || null },
      ...page.people.map((p) => ({ name: p.name, role: words.say(lang, p.role === 'pm' ? 'rolePm' : 'roleSuper'), phone: p.phone })),
    ],
    money: moneyStory(
      lang,
      {
        contract: page.contract,
        contractSignedOn: page.contractSignedOn,
        billed: page.payApps.reduce((sum, a) => sum + a.due, 0),
        paid,
        changes,
        apps,
        next: null,
        payDays: page.payDays,
        cardFeePct: input.cardFeePct,
      },
      { showOlder: opts.showOlder, words },
    ),
    papers: customerPapers(
      lang,
      {
        agreement: null,
        contract,
        changes,
        arrived: {
          payApps: page.payApps.length,
          waivers: input.waivers.filter((w) => invoices.has(w.invoiceId) && (w.conditional.state === 'signed' || w.unconditional.state === 'signed')).length,
          binder: false,
        },
      },
      words,
    ),
    moves: page.moves.map((m) => ({
      activity: m.activity,
      when: words.say(lang, 'movedFromTo', { from: pDate(lang, m.from), to: pDate(lang, m.to) }),
      why: words.say(lang, REASON[m.reason] ?? 'reasonOther'),
    })),
  }
}
