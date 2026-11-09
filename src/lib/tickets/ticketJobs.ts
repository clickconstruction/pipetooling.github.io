/**
 * Counter tickets (punch list #295, PR 2): the job choices on the sheet a ticket opens after its photo, *Which job is
 * this ticket for?*. Pure: the jobs the app already knows about in, the chips in their order out, and the choice as
 * each tap changes it.
 *
 * The order is the order a tech at a counter would guess in: a PO code the office made for them today (it carries its
 * job and its supply house), then the job they are clocked in on, then the day's other jobs, then a job they searched
 * for. The first of the first two that exists is picked already, so the usual ticket is one tap on Save. A second tap
 * on another job adds it: one ticket, two jobs, and the office splits the charge. *Not for one job* clears the jobs.
 */

export interface TicketJobFacts {
  jobId: string
  /** The job's number as the screens print it, *JP1042*. */
  label: string
  name: string
}

export interface TicketPoFacts extends TicketJobFacts {
  poEntryId: string
  /** The five-digit counter code as printed. */
  poCode: string
  houseName: string | null
}

export type TicketJobWhy = 'po' | 'clocked' | 'day' | 'picked'

export interface TicketJobOption extends TicketJobFacts {
  /** The chip's key: the PO entry for a code, else the job. */
  key: string
  why: TicketJobWhy
  poEntryId: string | null
  poCode: string | null
  houseName: string | null
}

export interface TicketJobsInput {
  /** PO codes made for this person today, newest first. */
  poEntries: readonly TicketPoFacts[]
  /** The job they are clocked in on now, if any. */
  clockedJob: TicketJobFacts | null
  /** The other jobs of the day: clocked earlier or scheduled. */
  dayJobs: readonly TicketJobFacts[]
  /** Jobs they found through *Another job…*, in the order found. */
  picked: readonly TicketJobFacts[]
}

/** The chips, in order, a job once: a PO code's chip stands for its job, and the job is not listed again below it. */
export function ticketJobOptions(input: TicketJobsInput): TicketJobOption[] {
  const out: TicketJobOption[] = []
  const seenJobs = new Set<string>()
  const seenPo = new Set<string>()
  for (const po of input.poEntries) {
    if (!po.jobId || seenPo.has(po.poEntryId)) continue
    seenPo.add(po.poEntryId)
    seenJobs.add(po.jobId)
    out.push({ key: `po:${po.poEntryId}`, why: 'po', jobId: po.jobId, label: po.label, name: po.name, poEntryId: po.poEntryId, poCode: po.poCode, houseName: po.houseName })
  }
  const add = (job: TicketJobFacts | null, why: TicketJobWhy) => {
    if (!job?.jobId || seenJobs.has(job.jobId)) return
    seenJobs.add(job.jobId)
    out.push({ key: `job:${job.jobId}`, why, jobId: job.jobId, label: job.label, name: job.name, poEntryId: null, poCode: null, houseName: null })
  }
  add(input.clockedJob, 'clocked')
  for (const job of input.dayJobs) add(job, 'day')
  for (const job of input.picked) add(job, 'picked')
  return out
}

/**
 * What the sheet has picked: the chips by key in the order tapped, or no one job, or the job left for later (a phone
 * with no signal and no job to offer still saves the photo; the taker or the office names the job afterwards).
 */
export interface TicketChoice {
  keys: string[]
  noOneJob: boolean
  later?: boolean
}

export const EMPTY_TICKET_CHOICE: TicketChoice = { keys: [], noOneJob: false }

/** Picked before any tap: today's PO code, else the job clocked in now. A day's other job is offered, never assumed. */
export function firstTicketChoice(options: readonly TicketJobOption[]): TicketChoice {
  const first = options.find((o) => o.why === 'po') ?? options.find((o) => o.why === 'clocked')
  return first ? { keys: [first.key], noOneJob: false } : EMPTY_TICKET_CHOICE
}

/** A tap on a chip: on when it was off, off when it was on. A job always takes *Not for one job* off. */
export function tapTicketJob(choice: TicketChoice, key: string): TicketChoice {
  if (choice.keys.includes(key)) return { keys: choice.keys.filter((k) => k !== key), noOneJob: false }
  return { keys: [...choice.keys, key], noOneJob: false }
}

/** A tap on *Not for one job*: on clears the jobs, off leaves nothing picked. */
export function tapNoOneJob(choice: TicketChoice): TicketChoice {
  return choice.noOneJob ? EMPTY_TICKET_CHOICE : { keys: [], noOneJob: true }
}

/** A tap on *Pick the job later*: on clears the rest, off leaves nothing picked. */
export function tapJobLater(choice: TicketChoice): TicketChoice {
  return choice.later ? EMPTY_TICKET_CHOICE : { keys: [], noOneJob: false, later: true }
}

/** A job found through *Another job…* is picked as it is added. */
export function withPickedJob(choice: TicketChoice, jobId: string): TicketChoice {
  const key = `job:${jobId}`
  return choice.keys.includes(key) ? { ...choice, noOneJob: false } : { keys: [...choice.keys, key], noOneJob: false }
}

/** The chips the choice names, in the order tapped; a key the options no longer hold is skipped. */
export function chosenOptions(choice: TicketChoice, options: readonly TicketJobOption[]): TicketJobOption[] {
  const byKey = new Map(options.map((o) => [o.key, o]))
  const out: TicketJobOption[] = []
  for (const key of choice.keys) {
    const o = byKey.get(key)
    if (o && !out.some((x) => x.jobId === o.jobId)) out.push(o)
  }
  return out
}

/** Whether Save has something to save to: a job, or the word that there is none. */
export function ticketChoiceReady(choice: TicketChoice, options: readonly TicketJobOption[]): boolean {
  return choice.noOneJob || choice.later === true || chosenOptions(choice, options).length > 0
}

/** What the choice writes on the ticket: the first job, the rest, the first PO code among them, or no one job. */
export function ticketChoiceWrite(choice: TicketChoice, options: readonly TicketJobOption[]): { job_id: string | null; also_job_ids: string[]; no_one_job: boolean; po_entry_id: string | null } {
  if (choice.noOneJob) return { job_id: null, also_job_ids: [], no_one_job: true, po_entry_id: null }
  if (choice.later) return { job_id: null, also_job_ids: [], no_one_job: false, po_entry_id: null }
  const chosen = chosenOptions(choice, options)
  return {
    job_id: chosen[0]?.jobId ?? null,
    also_job_ids: chosen.slice(1).map((o) => o.jobId),
    no_one_job: false,
    po_entry_id: chosen.find((o) => o.poEntryId)?.poEntryId ?? null,
  }
}

function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** The Save button says exactly what it will do: *Save the ticket to JP1042*, *… to JP1042 and JP1038*. */
export function ticketSaveLabel(choice: TicketChoice, options: readonly TicketJobOption[]): string {
  if (choice.noOneJob) return 'Save the ticket for no one job'
  if (choice.later) return 'Save the ticket and pick the job later'
  const chosen = chosenOptions(choice, options)
  if (chosen.length === 0) return 'Pick a job to save the ticket'
  return `Save the ticket to ${joinLabels(chosen.map((o) => o.label))}`
}

/** The small line under a chip: why it is offered. */
export function ticketJobWhyWords(option: Pick<TicketJobOption, 'why' | 'poCode' | 'houseName'>): string {
  switch (option.why) {
    case 'po':
      return option.houseName ? `Your PO code at ${option.houseName}` : 'Your PO code'
    case 'clocked':
      return 'Clocked in now'
    case 'day':
      return 'On your day'
    case 'picked':
      return 'You picked it'
  }
}

/** The line under the chips once one job is picked and more are offered. */
export const SECOND_JOB_WORDS = 'For two jobs? Tap the second one too.'
