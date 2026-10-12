/**
 * The Messages prototype's demo people (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178:
 * `contacts`, `FLOWS`, `FLOW_STATE`, `PAPERS`, `PORTAL_INFO`), as the reads of cut 8's kernels will hand them over, at
 * the prototype's clock, Fri Oct 2, 2026. Made-up people, companies and jobs; never a live row. The tests of
 * `flows/portalPage.ts`, `flows/customerMove.ts`, `portal/moneyStory.ts`, `portal/papers.ts` and `portal/readiness.ts`
 * read them.
 *
 * Where the prototype's own state is a quirk of the demo, these hold what the real read gives instead:
 * - A job shows on a trade's page once they are asked on it, as main's trade portal reads only their invites. Greg's
 *   Pad B (not asked yet) and Tom's Boerne (not asked yet) are left out, and Bill's page has only the job he quoted.
 * - A step of rounds with a round open is on now. Jonah's questions and his certificate are open while the addendum
 *   is too; the prototype marked only one step of his on now.
 * - Elena's job is Stone Oak Pharmacy, the one being built since Sep 14 that her money and her on-site day describe.
 */

import type { PortalLaneIn, PortalPageIn, PortalStepIn, PortalStepWhere, PortalWho } from '../flows/portalPage'
import type { CustomerChange } from './moneyLines'
import type { MoneyStoryIn } from './moneyStory'
import type { CustomerPapersIn } from './papers'
import type { Bilingual, TypedLine } from './pageWords'

export const DEMO_TODAY = '2026-10-02'
export const DEMO_COMPANY = 'Click Construction'
export const DEMO_PHONE = '(210) 555-0100'

function step(id: string, name: Bilingual, who: PortalWho, where: PortalStepWhere, more: Partial<PortalStepIn> = {}): PortalStepIn {
  return { id, name, who, where, ...more }
}

const t = (en: string, es: string): TypedLine => ({ en, es })

// The trade partner flow (FLOWS.trade)
const INVITED = { en: 'Invited', es: 'Invitado' }
const PORTAL = { en: 'Portal opened', es: 'Portal abierto' }
const PAPERS_IN = { en: 'Papers in', es: 'Documentos recibidos' }
const MSA = { en: 'MSA signed', es: 'Acuerdo firmado' }
const ASK = { en: 'Asked to quote', es: 'Cotización pedida' }
const COMPARE = { en: 'Compared', es: 'Comparado' }
const SOW = { en: 'Statement of work', es: 'Alcance de trabajo' }
const DRAWS = { en: 'Draws', es: 'Pagos parciales' }
const CLOSEOUT = { en: 'Closeout', es: 'Cierre' }
const LATER = {
  ask: { en: 'When a job of yours comes up.', es: 'Cuando surja un trabajo para usted.' },
  compare: { en: 'After your quote is in.', es: 'Después de recibir su cotización.' },
  sow: { en: 'If we carry your quote.', es: 'Si llevamos su cotización.' },
  draws: { en: 'Monthly, once you are on site.', es: 'Cada mes, una vez en obra.' },
  closeout: { en: 'At the end of your work.', es: 'Al terminar su trabajo.' },
}

function tradeJob(where: Partial<Record<'ask' | 'compare' | 'sow' | 'draws' | 'closeout', PortalStepWhere>>, more: Partial<Record<string, Partial<PortalStepIn>>> = {}): PortalStepIn[] {
  return [
    step('ask', ASK, 'them', where.ask ?? 'notYet', { loop: true, later: LATER.ask, papers: [{ id: 'quote', ours: false, mark: 'no' }], ...more.ask }),
    step('compare', COMPARE, 'us', where.compare ?? 'notYet', { decision: true, later: LATER.compare, ...more.compare }),
    step('sow', SOW, 'them', where.sow ?? 'notYet', { later: LATER.sow, papers: [{ id: 'sow', ours: true, mark: 'no' }], ...more.sow }),
    step('draws', DRAWS, 'both', where.draws ?? 'notYet', { loop: true, later: LATER.draws, papers: [{ id: 'waiver', ours: false, mark: 'no' }], ...more.draws }),
    step('closeout', CLOSEOUT, 'them', where.closeout ?? 'notYet', { later: LATER.closeout, papers: [{ id: 'final_waiver', ours: false, mark: 'no' }], ...more.closeout }),
  ]
}

/** Greg Paulk, Hillside Excavation: his certificate ran out Sep 30, and his Boerne quote is two days late. */
export const GREG: PortalPageIn = {
  company: DEMO_COMPANY,
  phone: DEMO_PHONE,
  off: false,
  lanes: [
    {
      lane: 'once',
      steps: [
        step('invited', INVITED, 'us', 'done', { doneOn: '2026-09-08', papers: [{ id: 'invitation', ours: true, mark: 'ok' }] }),
        step('portal', PORTAL, 'them', 'done', { doneOn: '2026-09-09' }),
        step('papers', PAPERS_IN, 'them', 'lapsed', {
          doneOn: '2026-09-12',
          papers: [
            { id: 'w9', ours: false, mark: 'ok' },
            { id: 'coi', ours: false, mark: 'bad' },
          ],
        }),
        step('msa', MSA, 'them', 'done', { doneOn: '2026-09-14', papers: [{ id: 'msa', ours: true, mark: 'ok' }] }),
      ],
    },
    {
      lane: 'perJob',
      jobs: [
        {
          name: 'Boerne Retail Shell',
          steps: tradeJob({ ask: 'now' }, { ask: { roundNow: true, day: { on: '2026-09-30', late: true }, papers: [{ id: 'quote', ours: false, mark: 'wait' }] } }),
        },
        {
          name: 'Stone Oak Pharmacy',
          steps: tradeJob(
            { ask: 'done', compare: 'done', sow: 'done', draws: 'now' },
            { draws: { roundNow: true, day: { on: '2026-10-19', late: false }, month: '2026-10-01' }, sow: { papers: [{ id: 'sow', ours: true, mark: 'ok' }] } },
          ),
        },
      ],
    },
  ],
}

/** Bill Sorrell, Tejas Power: everything in, his Boerne quote came Sep 29, and we are comparing. */
export const BILL: PortalPageIn = {
  company: DEMO_COMPANY,
  phone: DEMO_PHONE,
  off: false,
  lanes: [
    {
      lane: 'once',
      steps: [
        step('invited', INVITED, 'us', 'done', { doneOn: '2026-09-08', papers: [{ id: 'invitation', ours: true, mark: 'ok' }] }),
        step('portal', PORTAL, 'them', 'done', { doneOn: '2026-09-08' }),
        step('papers', PAPERS_IN, 'them', 'done', {
          doneOn: '2026-09-09',
          papers: [
            { id: 'w9', ours: false, mark: 'ok' },
            { id: 'coi', ours: false, mark: 'ok' },
          ],
        }),
        step('msa', MSA, 'them', 'done', { doneOn: '2026-09-10', papers: [{ id: 'msa', ours: true, mark: 'ok' }] }),
      ],
    },
    {
      lane: 'perJob',
      jobs: [{ name: 'Boerne Retail Shell', steps: tradeJob({ ask: 'done', compare: 'now' }, { ask: { doneOn: '2026-09-29', papers: [{ id: 'quote', ours: false, mark: 'ok' }] } }) }],
    },
  ],
}

/** Tom Riddle, Bexar Steel Erectors: his W-9 is in, his certificate is not, and no job is asked of him yet. */
export const TOM: PortalPageIn = {
  company: DEMO_COMPANY,
  phone: DEMO_PHONE,
  off: false,
  lanes: [
    {
      lane: 'once',
      steps: [
        step('invited', INVITED, 'us', 'done', { doneOn: '2026-09-25', papers: [{ id: 'invitation', ours: true, mark: 'ok' }] }),
        step('portal', PORTAL, 'them', 'done', { doneOn: '2026-09-28' }),
        step('papers', PAPERS_IN, 'them', 'now', {
          papers: [
            { id: 'w9', ours: false, mark: 'ok' },
            { id: 'coi', ours: false, mark: 'no' },
          ],
        }),
        step('msa', MSA, 'them', 'notYet', { papers: [{ id: 'msa', ours: true, mark: 'no' }] }),
      ],
    },
    { lane: 'perJob', jobs: [] },
  ],
}

/** Jonah Vale, Marsh & Vale Architects: a question closes Monday, Addendum 2 is filed and not sent, pay app 4 waits on him. */
export const JONAH: PortalPageIn = {
  company: DEMO_COMPANY,
  phone: DEMO_PHONE,
  off: false,
  lanes: [
    {
      lane: 'perJob',
      jobs: [
        {
          name: 'Boerne Retail Shell',
          steps: [
            step('plans', { en: 'Plans in', es: 'Planos recibidos' }, 'them', 'done', { doneOn: '2026-09-15', papers: [{ id: 'plans', ours: false, mark: 'ok' }] }),
            step('questions', { en: 'Questions', es: 'Preguntas' }, 'them', 'now', { loop: true, roundNow: true, day: { on: '2026-10-05', late: false } }),
            step('addenda', { en: 'Addenda', es: 'Adendas' }, 'them', 'now', { loop: true, roundNow: true, papers: [{ id: 'addendum', ours: false, mark: 'ok' }] }),
            step('submittals', { en: 'Submittals', es: 'Documentos para aprobación' }, 'them', 'notYet', { loop: true, papers: [{ id: 'submittal', ours: false, mark: 'no' }] }),
            step('certify', { en: 'Certify pay apps', es: 'Certificar pagos' }, 'them', 'now', { loop: true, roundNow: true, papers: [{ id: 'certificate', ours: false, mark: 'no' }] }),
          ],
        },
      ],
    },
  ],
}

// The customer flow (FLOWS.customer)
const AGREEMENT = { en: 'Master agreement', es: 'Acuerdo marco' }
const C = {
  asked: { en: 'Asked us', es: 'Nos consultó' },
  bid: { en: 'Our bid', es: 'Nuestra oferta' },
  yes: { en: 'Said yes', es: 'Aceptó' },
  contract: { en: 'Contract signed', es: 'Contrato firmado' },
  start: { en: 'Start date', es: 'Fecha de inicio' },
  onsite: { en: 'On site', es: 'En obra' },
  payapp: { en: 'Pay application', es: 'Solicitud de pago' },
  close: { en: 'Closeout', es: 'Cierre' },
  warranty: { en: 'Warranty', es: 'Garantía' },
  co: { en: 'Change orders', es: 'Órdenes de cambio' },
}
const CL = {
  agreement: { en: 'Repeat customers only.', es: 'Solo para clientes recurrentes.' },
  asked: { en: 'When you ask, or your plans come in.', es: 'Cuando nos consulte, o lleguen sus planos.' },
  bid: { en: 'Within two weeks of your plans.', es: 'Dentro de dos semanas de recibir sus planos.' },
  contract: { en: 'Once you say yes.', es: 'Cuando acepte.' },
  start: { en: 'Once the contract is signed.', es: 'Cuando el contrato esté firmado.' },
  onsite: { en: 'After your start date.', es: 'Después de su fecha de inicio.' },
  payapp: { en: 'Once a month, from the first month on site.', es: 'Una vez al mes, desde el primer mes en obra.' },
  close: { en: 'When the work is done and you accept it.', es: 'Cuando la obra termine y usted la acepte.' },
  warranty: { en: 'A year from closeout.', es: 'Un año desde el cierre.' },
  co: { en: 'Only when something changes.', es: 'Solo cuando algo cambie.' },
}

type CustomerStepsWhere = Partial<Record<'agreement' | 'asked' | 'bid' | 'yes' | 'contract' | 'start' | 'onsite' | 'payapp' | 'close' | 'warranty' | 'co', PortalStepWhere>>

function customerSteps(where: CustomerStepsWhere, more: Partial<Record<string, Partial<PortalStepIn>>> = {}): { once: PortalStepIn[]; perJob: PortalStepIn[] } {
  const s = (id: keyof typeof C, who: PortalWho, extra: Partial<PortalStepIn>) => step(id, C[id], who, where[id] ?? 'notYet', { later: CL[id as keyof typeof CL] ?? null, ...extra, ...more[id] })
  return {
    once: [step('agreement', AGREEMENT, 'them', where.agreement ?? 'notYet', { later: CL.agreement, papers: [{ id: 'msa', ours: true, mark: 'no' }], ...more.agreement })],
    perJob: [
      s('asked', 'them', {}),
      s('bid', 'us', { papers: [{ id: 'bid', ours: true, mark: 'ok' }] }),
      step('yes', C.yes, 'them', where.yes ?? 'notYet', { decision: true, ...more.yes }),
      s('contract', 'them', { papers: [{ id: 'contract', ours: true, mark: 'no' }] }),
      s('start', 'us', { papers: [{ id: 'schedule', ours: true, mark: 'no' }] }),
      s('onsite', 'us', {}),
      s('payapp', 'both', { loop: true, papers: [{ id: 'payapp', ours: true, mark: 'no' }] }),
      s('close', 'us', {}),
      s('warranty', 'us', {}),
      s('co', 'them', { loop: true, aside: true, papers: [{ id: 'co', ours: true, mark: 'no' }] }),
    ],
  }
}

/** Dr. Priya Raman, Helotes Dental Office: one job, the contract signed Sep 19, we owe her the start date by Mon Oct 5. */
export const PRIYA_STEPS = customerSteps(
  { agreement: 'skipped', asked: 'done', bid: 'done', yes: 'done', contract: 'done', start: 'now', co: 'now' },
  {
    asked: { doneOn: '2026-09-01' },
    bid: { doneOn: '2026-09-10' },
    yes: { doneOn: '2026-09-18' },
    contract: { doneOn: '2026-09-19', papers: [{ id: 'contract', ours: true, mark: 'ok' }] },
    start: { owedBy: '2026-10-05' },
    co: { roundNow: true, papers: [{ id: 'co', ours: true, mark: 'wait' }] },
  },
)

export const PRIYA_CHANGES: CustomerChange[] = [
  { id: 'co-priya-1', number: 1, description: t('exam 2 cabinets', 'gabinetes del consultorio 2'), price: 6300, days: 0, state: 'signed', signedOn: '2026-09-28' },
  { id: 'co-priya-2', number: 2, description: t('a sink in exam 3', 'un lavabo en el consultorio 3'), price: 2150, days: 0, state: 'open' },
]

export const PRIYA_MONEY: MoneyStoryIn = {
  contract: 412000,
  contractSignedOn: '2026-09-19',
  billed: 0,
  paid: 0,
  changes: PRIYA_CHANGES,
  apps: [],
  next: { n: 1, month: '2026-10-01', bill: 70000, aboutOn: '2026-11-05' },
  payDays: 30,
  cardFeePct: 3,
}

export const PRIYA_PAPERS: CustomerPapersIn = {
  agreement: null,
  contract: { state: 'signed', signedOn: '2026-09-19', signer: 'Dr. Priya Raman' },
  changes: PRIYA_CHANGES,
  arrived: { payApps: 0, waivers: 0, binder: false },
}

/** Elena Marchetti, Cibolo Creek Partners: a repeat customer, pay app 4 with her architect, three paid on time. */
export const ELENA_STEPS = customerSteps(
  { agreement: 'done', asked: 'done', bid: 'done', yes: 'done', contract: 'done', start: 'done', onsite: 'done', payapp: 'now' },
  {
    agreement: { doneOn: '2026-08-04', papers: [{ id: 'msa', ours: true, mark: 'ok' }] },
    asked: { doneOn: '2026-08-11' },
    bid: { doneOn: '2026-08-20' },
    yes: { doneOn: '2026-08-28' },
    contract: { doneOn: '2026-09-02', papers: [{ id: 'contract', ours: true, mark: 'ok' }] },
    start: { doneOn: '2026-09-08', papers: [{ id: 'schedule', ours: true, mark: 'ok' }] },
    onsite: { doneOn: '2026-09-14' },
    payapp: { roundNow: true, waitingOn: { who: 'architect', forCertificate: true }, papers: [{ id: 'payapp', ours: true, mark: 'ok' }] },
  },
)

export const ELENA_CHANGES: CustomerChange[] = [
  { id: 'co-elena-1', number: 1, description: t('storefront glass', 'vidrio de fachada'), price: 11200, days: 0, state: 'signed', signedOn: '2026-09-18' },
  { id: 'co-elena-2', number: 2, description: t('roof curbs', 'bases de techo'), price: 7250, days: 0, state: 'signed', signedOn: '2026-09-24' },
]

export const ELENA_MONEY: MoneyStoryIn = {
  contract: 1284000,
  contractSignedOn: '2026-06-03',
  billed: 486200,
  paid: 445000,
  changes: ELENA_CHANGES,
  apps: [
    {
      n: 4,
      month: '2026-09-01',
      covers: t('Roof deck, rough-in started, storefront glass', 'Cubierta del techo, instalación interna iniciada, vidrio de fachada'),
      amount: 41200,
      photos: 3,
      state: 'architect',
      architect: 'Jonah Vale',
      withArchitectSince: '2026-09-29',
    },
    {
      n: 3,
      month: '2026-08-01',
      covers: t('Slab, underground plumbing, framing to 40%', 'Losa, plomería subterránea, estructura al 40%'),
      amount: 118600,
      photos: 3,
      state: 'paid',
      certifiedBy: 'Jonah Vale',
      certifiedOn: '2026-09-22',
      dueOn: '2026-10-22',
      paidOn: '2026-09-25',
      waivers: 6,
      tradesPaidOn: '2026-09-28',
    },
    {
      n: 2,
      month: '2026-07-01',
      covers: t('Site work, utilities, foundations', 'Obra civil, servicios, cimentaciones'),
      amount: 164400,
      photos: 0,
      state: 'paid',
      certifiedBy: 'Jonah Vale',
      certifiedOn: '2026-08-24',
      dueOn: '2026-09-23',
      paidOn: '2026-08-28',
      waivers: 4,
      tradesPaidOn: '2026-08-31',
    },
    {
      n: 1,
      month: '2026-06-01',
      covers: t('Mobilization, demolition, grading', 'Movilización, demolición, nivelación'),
      amount: 162000,
      photos: 0,
      state: 'paid',
      certifiedBy: 'Jonah Vale',
      certifiedOn: '2026-07-27',
      dueOn: '2026-08-26',
      paidOn: '2026-07-31',
      waivers: 3,
      tradesPaidOn: '2026-08-03',
    },
  ],
  next: { n: 5, month: '2026-10-01', bill: 130000, aboutOn: '2026-11-05' },
  payDays: 30,
  cardFeePct: 3,
}

export const ELENA_PAPERS: CustomerPapersIn = {
  agreement: { signedOn: '2026-08-04' },
  contract: { state: 'signed', signedOn: '2026-09-02', signer: 'Elena Marchetti' },
  changes: ELENA_CHANGES,
  arrived: { payApps: 4, waivers: 13, binder: false },
}

/** Marcus Bell, Bell Family Dental: declined our bid Tue Sep 29 and went with another plumber. Off the flow. */
export const MARCUS_STEPS = customerSteps(
  { agreement: 'skipped', asked: 'done', bid: 'done', yes: 'done' },
  { asked: { doneOn: '2026-09-14' }, bid: { doneOn: '2026-09-21' }, yes: { doneOn: '2026-09-29' } },
)

/** The week, the schedule and the people on each customer's page (PORTAL_INFO's week, schedule, moved and people). */
export const PRIYA_PAGE = {
  week: { on: '2026-10-02', photos: 3, line: t('Permits are in. Plumbing is being awarded. The slab pour is set for the week of Oct 12.', 'Los permisos están. Se está adjudicando la plomería. El vaciado de la losa queda para la semana del 12 de oct.') },
  schedule: {
    milestones: [{ name: t('Start', 'Inicio') }, { name: t('Dry in', 'Cerrado al clima') }, { name: t('Finish', 'Entrega') }],
    moves: [] as { name: TypedLine; why: TypedLine | null }[],
  },
  people: [
    { name: 'Rosa', role: t('office · (210) 555-0100', 'oficina · (210) 555-0100') },
    { name: 'Robert', role: t('project manager', 'gerente de proyecto') },
    { name: 'Wendi', role: t('on site', 'en obra') },
  ],
}

export const ELENA_PAGE = {
  week: { on: '2026-10-02', photos: 0, line: t('The roof deck is on. Rough-in starts Monday. The parking lot pour moved a week for the rain.', 'La cubierta del techo está puesta. La instalación interna empieza el lunes. El vaciado del estacionamiento se movió una semana por la lluvia.') },
  schedule: {
    milestones: [{ name: t('Start', 'Inicio') }, { name: t('Dry in', 'Cerrado al clima') }, { name: t('Finish', 'Entrega') }],
    moves: [{ name: t('Parking lot pour', 'Vaciado del estacionamiento'), why: t('rain', 'lluvia') }],
  },
  people: PRIYA_PAGE.people,
}

/** All the lanes of a customer, flattened in the flow's order, for `customerMove`. */
export function customerFlow(steps: { once: PortalStepIn[]; perJob: PortalStepIn[] }): PortalStepIn[] {
  return [...steps.once, ...steps.perJob]
}

/** The trade pages by name, for the tests that walk every demo person. */
export const TRADE_PAGES: Record<string, PortalPageIn> = { greg: GREG, bill: BILL, tom: TOM, jonah: JONAH }

/** A lane list's every step, for the tests that check a reading for each. */
export function everyStep(lanes: PortalLaneIn[]): PortalStepIn[] {
  return lanes.flatMap((l) => (l.lane === 'perJob' ? l.jobs.flatMap((j) => j.steps) : l.steps))
}
