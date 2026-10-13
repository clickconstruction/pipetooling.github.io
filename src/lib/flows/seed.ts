/**
 * The flows as the Messages prototype v1.178 draws them: the shape cut 4's SQL seeds into `flows` and
 * `flow_steps`, and the flows the kernels' tests read. The office edits them in Settings → Flows; the
 * step ids stay, since a quick reply, a note or a skip ties to one.
 *
 * Changed from the prototype: the lanes are `once`, `per_job` and `any_time` (`LANE_WORDS` has the
 * words), and the unknown kind's First lane is `once`; `dec` is `fork`; the nudge's how and day are
 * ids (`NUDGE_HOW_WORDS`, `NUDGE_DAY_WORDS`); and four fields are new: `phase` for the boards' tiles,
 * `loopEnds` for when a loop lets the chain move on, `skipOneJob` for the customer's master agreement,
 * `owedWords` for Follow up's We owe them list on our-move steps, and `aside` set on change orders only,
 * as before.
 */
import type { FlowKind } from './facts'
import type { FlowDef, FlowStep } from './state'

type StepInput = Pick<FlowStep, 'id' | 'name' | 'nameEs' | 'phase' | 'who' | 'facts' | 'usual'> & Partial<FlowStep>

const step = (s: StepInput): FlowStep => ({
  seat: null,
  join: 'and',
  papers: [],
  loop: null,
  loopEnds: null,
  fork: false,
  aside: false,
  skipOneJob: false,
  later: null,
  nudge: null,
  owedWords: null,
  ...s,
})

export const SEED_FLOWS: Readonly<Record<FlowKind, FlowDef>> = {
  trade: {
    kind: 'trade',
    lanes: [
      {
        lane: 'once',
        steps: [
          step({ id: 'invited', name: 'Invited', nameEs: 'Invitado', phase: 'setup', who: 'us', seat: 'Robert', facts: ['invite_sent'], papers: ['invitation'], owedWords: 'the invitation', usual: 2 }),
          step({ id: 'portal', name: 'Portal opened', nameEs: 'Portal abierto', phase: 'setup', who: 'them', facts: ['portal_opened'], nudge: { days: 3, how: 'text', send: 'app', dayFact: null }, usual: 1 }),
          step({ id: 'papers', name: 'Papers in', nameEs: 'Documentos recibidos', phase: 'setup', who: 'them', facts: ['w9_signed', 'coi_current'], papers: ['w9', 'coi'], nudge: { days: 5, how: 'call', send: 'ask', dayFact: null }, usual: 3 }),
          step({ id: 'msa', name: 'MSA signed', nameEs: 'Acuerdo firmado', phase: 'setup', who: 'them', facts: ['msa_signed'], papers: ['msa'], nudge: { days: 3, how: 'text', send: 'ask', dayFact: null }, usual: 4 }),
        ],
      },
      {
        lane: 'per_job',
        steps: [
          step({
            id: 'ask', name: 'Asked to quote', nameEs: 'Cotización pedida', phase: 'pricing', who: 'them',
            later: { en: 'When a job of yours comes up.', es: 'Cuando surja un trabajo para usted.' },
            loop: 'each ask', loopEnds: 'rounds', facts: ['quote_in', 'quote_declined'], join: 'or', papers: ['quote'],
            nudge: { days: 7, how: 'text', send: 'ask', dayFact: 'promised' }, usual: 6,
          }),
          step({
            id: 'compare', name: 'Compared', nameEs: 'Comparado', phase: 'pricing', who: 'us', seat: 'Robert', fork: true,
            later: { en: 'After your quote is in.', es: 'Después de recibir su cotización.' },
            facts: ['carried', 'not_carried'], join: 'or', owedWords: 'our decision on their quote', usual: 2,
          }),
          step({
            id: 'sow', name: 'Statement of work', nameEs: 'Alcance de trabajo', phase: 'building', who: 'them',
            later: { en: 'If we carry your quote.', es: 'Si llevamos su cotización.' },
            facts: ['sow_signed'], papers: ['sow'], nudge: { days: 3, how: 'text', send: 'ask', dayFact: null }, usual: 5,
          }),
          step({
            id: 'draws', name: 'Draws', nameEs: 'Pagos parciales', phase: 'building', who: 'both',
            later: { en: 'Monthly, once you are on site.', es: 'Cada mes, una vez en obra.' },
            loop: 'each draw', loopEnds: 'next', facts: ['draw_requested', 'draw_paid'], papers: ['waiver'], usual: 12,
          }),
          step({
            id: 'closeout', name: 'Closeout', nameEs: 'Cierre', phase: 'building', who: 'them',
            later: { en: 'At the end of your work.', es: 'Al terminar su trabajo.' },
            facts: ['final_waiver'], papers: ['final_waiver'], nudge: { days: 7, how: 'email', send: 'ask', dayFact: null }, usual: 9,
          }),
        ],
      },
    ],
  },
  customer: {
    kind: 'customer',
    lanes: [
      {
        lane: 'once',
        steps: [
          step({
            id: 'agreement', name: 'Master agreement', nameEs: 'Acuerdo marco', phase: 'setup', who: 'them', skipOneJob: true,
            later: { en: 'Repeat customers only.', es: 'Solo para clientes recurrentes.' },
            facts: ['msa_signed'], papers: ['msa'], nudge: { days: 5, how: 'call', send: 'ask', dayFact: null }, usual: 10,
          }),
        ],
      },
      {
        lane: 'per_job',
        steps: [
          step({
            id: 'asked', name: 'Asked us', nameEs: 'Nos consultó', phase: 'pricing', who: 'them',
            later: { en: 'When you ask, or your plans come in.', es: 'Cuando nos consulte, o lleguen sus planos.' },
            facts: ['asked_us'], usual: 1,
          }),
          step({
            id: 'bid', name: 'Our bid', nameEs: 'Nuestra oferta', phase: 'pricing', who: 'us', seat: 'Rosa',
            later: { en: 'Within two weeks of your plans.', es: 'Dentro de dos semanas de recibir sus planos.' },
            facts: ['bid_sent'], papers: ['bid'], owedWords: 'our bid', usual: 9,
          }),
          step({
            id: 'yes', name: 'Said yes', nameEs: 'Aceptó', phase: 'pricing', who: 'them', fork: true,
            facts: ['said_yes', 'declined'], join: 'or', nudge: { days: 5, how: 'call', send: 'ask', dayFact: null }, usual: 6,
          }),
          step({
            id: 'contract', name: 'Contract signed', nameEs: 'Contrato firmado', phase: 'pricing', who: 'them',
            later: { en: 'Once you say yes.', es: 'Cuando acepte.' },
            facts: ['contract_signed'], papers: ['contract'], nudge: { days: 3, how: 'text', send: 'ask', dayFact: null }, usual: 4,
          }),
          step({
            id: 'start', name: 'Start date', nameEs: 'Fecha de inicio', phase: 'building', who: 'us', seat: 'Rosa',
            later: { en: 'Once the contract is signed.', es: 'Cuando el contrato esté firmado.' },
            facts: ['start_sent'], papers: ['schedule'], owedWords: 'the start date', usual: 3,
          }),
          step({
            id: 'onsite', name: 'On site', nameEs: 'En obra', phase: 'building', who: 'us', seat: 'Rosa',
            later: { en: 'After your start date.', es: 'Después de su fecha de inicio.' },
            facts: ['started'], owedWords: 'the day we are on site', usual: 10,
          }),
          step({
            id: 'payapp', name: 'Pay application', nameEs: 'Solicitud de pago', phase: 'building', who: 'both',
            later: { en: 'Once a month, from the first month on site.', es: 'Una vez al mes, desde el primer mes en obra.' },
            loop: 'each month', loopEnds: 'next', facts: ['payapp_paid'], papers: ['payapp'],
            nudge: { days: 5, how: 'text', send: 'ask', dayFact: 'pay_by' }, usual: 21,
          }),
          step({
            id: 'close', name: 'Closeout', nameEs: 'Cierre', phase: 'building', who: 'us', seat: 'Rosa',
            later: { en: 'When the work is done and you accept it.', es: 'Cuando la obra termine y usted la acepte.' },
            facts: ['closed'], owedWords: 'the closeout papers', usual: 14,
          }),
          step({
            id: 'warranty', name: 'Warranty', nameEs: 'Garantía', phase: 'building', who: 'us', seat: 'Rosa',
            later: { en: 'A year from closeout.', es: 'Un año desde el cierre.' },
            facts: ['warranty_over'], owedWords: 'the warranty papers', usual: 365,
          }),
          step({
            id: 'co', name: 'Change orders', nameEs: 'Órdenes de cambio', phase: 'building', who: 'them', aside: true,
            later: { en: 'Only when something changes.', es: 'Solo cuando algo cambie.' },
            loop: 'each change', loopEnds: 'rounds', facts: ['co_answered'], papers: ['co'],
            nudge: { days: 3, how: 'text', send: 'ask', dayFact: null }, usual: 4,
          }),
        ],
      },
    ],
  },
  arch: {
    kind: 'arch',
    lanes: [
      {
        lane: 'per_job',
        steps: [
          step({ id: 'plans', name: 'Plans in', nameEs: 'Planos recibidos', phase: 'building', who: 'them', facts: ['plans_in'], papers: ['plans'], usual: 2 }),
          step({
            id: 'questions', name: 'Questions', nameEs: 'Preguntas', phase: 'building', who: 'them',
            loop: 'each question', loopEnds: 'rounds', facts: ['question_answered'],
            nudge: { days: 0, how: 'email', send: 'ask', dayFact: 'questions_close' }, usual: 3,
          }),
          step({ id: 'addenda', name: 'Addenda', nameEs: 'Adendas', phase: 'building', who: 'them', loop: 'each addendum', loopEnds: 'rounds', facts: ['addendum_filed', 'addendum_sent'], papers: ['addendum'], usual: 1 }),
          step({
            id: 'submittals', name: 'Submittals', nameEs: 'Sometimientos', phase: 'building', who: 'them',
            loop: 'each submittal', loopEnds: 'next', facts: ['submittal_reviewed'], papers: ['submittal'],
            nudge: { days: 10, how: 'email', send: 'ask', dayFact: null }, usual: 8,
          }),
          step({
            id: 'certify', name: 'Certify pay apps', nameEs: 'Certificar pagos', phase: 'building', who: 'them',
            loop: 'each pay app', loopEnds: 'next', facts: ['certified'], papers: ['certificate'],
            nudge: { days: 3, how: 'email', send: 'ask', dayFact: null }, usual: 4,
          }),
        ],
      },
    ],
  },
  // A residential customer's and a sub's flows have no steps yet (RESIDENTIAL_BUILD_PLAN.md R4 and R8).
  residential: { kind: 'residential', lanes: [] },
  sub: { kind: 'sub', lanes: [] },
  unknown: {
    kind: 'unknown',
    lanes: [
      { lane: 'once', steps: [step({ id: 'who', name: 'Who is this?', nameEs: '¿Quién es?', phase: 'setup', who: 'us', seat: 'Rosa', facts: ['named'], usual: 0 })] },
    ],
  },
}
