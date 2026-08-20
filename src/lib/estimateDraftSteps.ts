import { formatSignedCentsUsd } from './estimateChangeOrder'

/**
 * Estimate/CO draft editor step rail (owner-approved plan, rail-v2):
 * the numbered guide is a map, a checklist, and the send-gate explainer.
 * Steps 1–N-1 are regions OF the customer's document in the customer's
 * reading order ("paper" group); Delivery is the one "backstage" step the
 * customer never sees. This kernel owns the step list per doc kind, each
 * step's live state, and the "N steps left" send-gate sentence — the rail,
 * the mobile strip, and the Send button all read this one function.
 *
 * Send gating deliberately mirrors TODAY'S rule (a selected customer with a
 * deliverable email) — the rail suggests, it does not add new hard blocks.
 * A zero-net document instead asks for confirmation at send time.
 */

export type EstimateDraftStepKey = 'customer' | 'change' | 'cost' | 'paper_extras' | 'delivery'

export type EstimateDraftStepStatus = 'done' | 'attention' | 'optional'

export type EstimateDraftStep = {
  key: EstimateDraftStepKey
  /** 1-based display number, contiguous per doc kind. */
  number: number
  label: string
  /** One-line live status under the label ("no lines yet", "net $2,450.00"). */
  sublabel: string
  status: EstimateDraftStepStatus
  /** 'paper' renders on the customer document; 'backstage' below it. */
  group: 'paper' | 'backstage'
}

export type EstimateDraftStepsInput = {
  isCO: boolean
  customerSelected: boolean
  /** CRM email or the send-override — what the accept link needs. */
  customerEmailPresent: boolean
  /** CO narrative "Description of change" has text (ignored for estimates). */
  changeDescriptionFilled: boolean
  lineCount: number
  /** Signed total of the lines (net change for COs, total for estimates). */
  totalCents: number
  termsFilled: boolean
  attachmentFilled: boolean
  /** People receiving the acceptance email (Notify me counts). */
  notifyCount: number
}

export type EstimateDraftSendGate = {
  /** Mirrors today's hard rule: customer selected + email present. */
  ready: boolean
  /** Short tokens for every attention step, in step order. */
  remaining: string[]
  /** "2 steps left: cost lines · delivery" / "Ready — …" */
  sentence: string
  /** Send should confirm first: document totals $0. */
  confirmZeroNet: boolean
}

export type EstimateDraftStepsResult = {
  steps: EstimateDraftStep[]
  sendGate: EstimateDraftSendGate
}

/** Short token per step for the send-gate sentence. */
const REMAINING_TOKENS: Record<EstimateDraftStepKey, string> = {
  customer: 'customer',
  change: 'the change',
  cost: 'cost lines',
  paper_extras: 'extras',
  delivery: 'delivery',
}

export function computeEstimateDraftSteps(input: EstimateDraftStepsInput): EstimateDraftStepsResult {
  const steps: EstimateDraftStep[] = []

  const customerDone = input.customerSelected && input.customerEmailPresent
  steps.push({
    key: 'customer',
    number: 0,
    label: 'Customer',
    sublabel: !input.customerSelected
      ? 'pick a customer'
      : !input.customerEmailPresent
        ? 'email needed for the accept link'
        : 'ready',
    status: customerDone ? 'done' : 'attention',
    group: 'paper',
  })

  if (input.isCO) {
    steps.push({
      key: 'change',
      number: 0,
      label: 'The change',
      sublabel: input.changeDescriptionFilled ? 'described' : 'describe what is changing',
      status: input.changeDescriptionFilled ? 'done' : 'attention',
      group: 'paper',
    })
  }

  const costLabel = input.isCO ? 'Impact on cost' : 'Line items'
  steps.push({
    key: 'cost',
    number: 0,
    label: costLabel,
    sublabel:
      input.lineCount === 0
        ? 'no lines yet'
        : input.isCO
          ? `net ${formatSignedCentsUsd(input.totalCents)}`
          : `total ${formatSignedCentsUsd(input.totalCents)}`,
    status: input.lineCount === 0 ? 'attention' : 'done',
    group: 'paper',
  })

  const extrasTouched = input.termsFilled || input.attachmentFilled
  steps.push({
    key: 'paper_extras',
    number: 0,
    label: 'Terms & attachments',
    sublabel: extrasTouched
      ? [input.termsFilled ? 'terms' : null, input.attachmentFilled ? 'attachment' : null]
          .filter(Boolean)
          .join(' · ')
      : 'optional',
    status: extrasTouched ? 'done' : 'optional',
    group: 'paper',
  })

  steps.push({
    key: 'delivery',
    number: 0,
    label: 'Delivery',
    sublabel: input.notifyCount === 0 ? 'no one notified' : `${input.notifyCount} notified`,
    status: input.notifyCount === 0 ? 'attention' : 'done',
    group: 'backstage',
  })

  steps.forEach((s, i) => {
    s.number = i + 1
  })

  const attention = steps.filter((s) => s.status === 'attention')
  const ready = customerDone
  const confirmZeroNet = input.totalCents === 0

  let sentence: string
  if (attention.length > 0) {
    const tokens = attention.map((s) => REMAINING_TOKENS[s.key])
    sentence = `${attention.length} step${attention.length === 1 ? '' : 's'} left: ${tokens.join(' · ')}`
  } else if (confirmZeroNet) {
    sentence = input.isCO ? 'Ready — net change is $0.00' : 'Ready — total is $0.00'
  } else {
    sentence = input.isCO ? "Ready — this is exactly what they'll sign." : "Ready — this is exactly what they'll see."
  }

  return {
    steps,
    sendGate: {
      ready,
      remaining: attention.map((s) => REMAINING_TOKENS[s.key]),
      sentence,
      confirmZeroNet,
    },
  }
}
