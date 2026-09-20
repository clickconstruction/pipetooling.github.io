/**
 * Readiness of a Contract sweep row (Contract sweep PR 1): what the app knows
 * about a job before anyone presses Send. "Ready" used to mean "the email
 * parses"; now it means the email parses, the scope says more than the job's
 * name, the job has an amount, and the customer is not a builder whose own
 * subcontract is the agreement. Send all takes only Ready rows. Pure — fed
 * by the sweep modal from the same prefill the send will mint.
 */

export type ContractSweepRowInput = {
  id: string
  /** "523" — for the "+ J798" chip on rows that share an email. */
  jobNumber: string
  jobName: string
  /** The effective signer email (the row's edit, else the job's). */
  email: string
  revenue: number | null
  /** The scope the send would mint — accepted-estimate lines, else fixtures, else the job name. */
  scopeLines: ReadonlyArray<string>
  /** The job's customer is a GC (gc_customer_id set) and the builder is not the customer row. */
  gcJob: boolean
}

export type ContractSweepFlag = 'ready' | 'thin_scope' | 'no_amount' | 'no_email' | 'gc_job'

export type ContractSweepRowAction = 'send' | 'fix_email' | 'file_theirs' | 'add_scope'

export type ContractSweepRowState = {
  /** The chips, in the order they render. */
  flags: ContractSweepFlag[]
  /** Other jobs in this sweep with the same email ("+ J798"). */
  sameEmailAs: string[]
  emailOk: boolean
  /** Send all takes it. */
  readyForBulk: boolean
  /** The row's one button. */
  action: ContractSweepRowAction
}

export const CONTRACT_SWEEP_FLAG_LABELS: Record<ContractSweepFlag, { text: string; tone: 'green' | 'amber' | 'red' | 'blue'; title: string }> = {
  ready: { text: 'Ready', tone: 'green', title: 'Email parses, the scope says more than the job name, the job has an amount — Send all takes it' },
  thin_scope: { text: 'Scope is just the name', tone: 'amber', title: 'No fixtures and no accepted-estimate lines: the agreement would read "Work we’ll do: <job name>". Open the job to type the scope first' },
  no_amount: { text: 'No amount', tone: 'amber', title: 'No amount on the job: the agreement would read "Billed at completion (time and materials)". Send one at a time after a look' },
  no_email: { text: 'No email', tone: 'red', title: 'No signer email on the job — Fix email opens the job' },
  gc_job: { text: 'GC job · file theirs', tone: 'blue', title: 'The customer is a builder: their subcontract is the agreement. File it rather than sending ours' },
}

export function isValidSweepEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

/** The scope says nothing the job's name did not: empty, or one line equal to the name. */
export function isThinScope(scopeLines: ReadonlyArray<string>, jobName: string): boolean {
  const lines = scopeLines.map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return true
  return lines.length === 1 && lines[0]!.toLowerCase() === jobName.trim().toLowerCase()
}

export function assessContractSweepRows(rows: ReadonlyArray<ContractSweepRowInput>): Map<string, ContractSweepRowState> {
  const byEmail = new Map<string, string[]>()
  for (const r of rows) {
    const key = r.email.trim().toLowerCase()
    if (!isValidSweepEmail(key)) continue
    const list = byEmail.get(key)
    if (list) list.push(r.jobNumber)
    else byEmail.set(key, [r.jobNumber])
  }
  const out = new Map<string, ContractSweepRowState>()
  for (const r of rows) {
    const emailOk = isValidSweepEmail(r.email)
    const thin = isThinScope(r.scopeLines, r.jobName)
    const noAmount = !(Number(r.revenue ?? 0) > 0)
    const flags: ContractSweepFlag[] = []
    if (r.gcJob) flags.push('gc_job')
    if (thin) flags.push('thin_scope')
    if (noAmount) flags.push('no_amount')
    if (!emailOk) flags.push('no_email')
    const readyForBulk = emailOk && !thin && !noAmount && !r.gcJob
    if (readyForBulk) flags.push('ready')
    const sameEmailAs = emailOk ? (byEmail.get(r.email.trim().toLowerCase()) ?? []).filter((n) => n !== r.jobNumber) : []
    const action: ContractSweepRowAction = !emailOk && !r.gcJob ? 'fix_email' : r.gcJob ? 'file_theirs' : thin ? 'add_scope' : 'send'
    out.set(r.id, { flags, sameEmailAs, emailOk, readyForBulk, action })
  }
  return out
}

export const CONTRACT_SWEEP_FILTERS = ['to_send', 'needs_look', 'all'] as const
export type ContractSweepFilter = (typeof CONTRACT_SWEEP_FILTERS)[number]
export const CONTRACT_SWEEP_FILTER_LABELS: Record<ContractSweepFilter, string> = { to_send: 'To send', needs_look: 'Needs a look', all: 'All' }

export function contractSweepFilterMatches(state: ContractSweepRowState | undefined, filter: ContractSweepFilter): boolean {
  if (filter === 'all' || !state) return true
  return filter === 'to_send' ? state.readyForBulk : !state.readyForBulk
}

export type ContractSweepSummary = {
  all: number
  toSend: number
  needsLook: number
  revenueTotal: number
  /** Distinct emails among the Ready rows — what "Send all" really means. */
  customersToEmail: number
}

export function contractSweepSummary(rows: ReadonlyArray<ContractSweepRowInput>, states: ReadonlyMap<string, ContractSweepRowState>): ContractSweepSummary {
  let toSend = 0
  let revenueTotal = 0
  const emails = new Set<string>()
  for (const r of rows) {
    revenueTotal += Number(r.revenue ?? 0) || 0
    const st = states.get(r.id)
    if (st?.readyForBulk) {
      toSend++
      emails.add(r.email.trim().toLowerCase())
    }
  }
  return { all: rows.length, toSend, needsLook: rows.length - toSend, revenueTotal, customersToEmail: emails.size }
}

/** What the pane's primary button does for a row (PR 2). */
export type ContractSweepPrimary = 'send_next' | 'file_theirs' | 'blocked'

export function contractSweepPrimary(state: ContractSweepRowState | undefined): ContractSweepPrimary {
  if (!state) return 'blocked'
  if (state.flags.includes('gc_job')) return 'file_theirs'
  if (!state.emailOk) return 'blocked'
  return state.readyForBulk ? 'send_next' : 'blocked'
}

/**
 * The footer's one sentence (PR 2): what pressing the primary will do, or why
 * it won't, and which job comes next.
 */
export function contractSweepFooterSentence(input: {
  state: ContractSweepRowState | undefined
  email: string
  jobName: string
  gcName: string | null
  nextJobNumber: string | null
  /** PR 5 (v2.3644): the chosen way — absent reads as the signing-link email, as before. */
  way?: 'pdf_email' | 'link' | 'download' | 'file_theirs'
}): string {
  const { state } = input
  const next = input.nextJobNumber ? ` · then J${input.nextJobNumber}` : ''
  if (!state) return ''
  const ours = input.way && input.way !== 'file_theirs'
  if (state.flags.includes('gc_job') && !ours) return `GC job · ${input.gcName ? `${input.gcName}'s` : 'the builder’s'} subcontract is the agreement`
  if (input.way === 'download') {
    const thin = state.flags.includes('thin_scope') ? `the scope is one line — “Work we'll do: ${input.jobName || 'Job'}” · ` : ''
    return `${thin}Nothing is emailed — the page is yours to hand over, and the job leaves this list${next}`
  }
  if (!state.emailOk) return 'No signer email — type one in To above, or download the page to print'
  const why: string[] = []
  if (state.flags.includes('thin_scope')) why.push(`the scope is one line — “Work we'll do: ${input.jobName || 'Job'}”`)
  if (state.flags.includes('no_amount')) why.push('sends as time and materials')
  if (why.length > 0) return `${why.join(' · ')}${next}`
  const same = state.sameEmailAs.length > 0 ? ` · this customer also has ${state.sameEmailAs.map((n) => `J${n}`).join(', ')} here` : ''
  return `${input.way === 'pdf_email' ? 'Emails the PDF to' : 'Emails'} ${input.email.trim()}${same}${next}`
}
