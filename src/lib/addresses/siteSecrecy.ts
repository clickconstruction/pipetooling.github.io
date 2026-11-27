import { countedLabel, pluralNoun } from '../batchWords'
import { type BookPaperRow, type PickablePaper, pickablePapers, shortDay } from '../jobs/jobPapers'
import { val } from '../valuesInPlace'
import type { PaperSite } from './paperSite'

/**
 * Secrecy on a site (punch list #439, piece 4): the words and the rules of the block **Secrecy on this site**. Pure.
 *
 * A site is a development, which carries all its jobs, or an address. Turning secrecy on puts one paper on every job
 * at the site, and our own people sign it once for the whole site before a job there opens. The database does the
 * work (`site_secrecy_turn_on`, `20261127052337_site_secrecy.sql`); this file says what the office reads before and
 * after each press. The reads and the presses are in `siteSecrecyIo.ts`.
 */

/** A site: a development by its id, or an address as it is written. */
export type SecrecySite = { developmentId: string } | { address: string }

/**
 * Where the block stands. `door` offers the presses: a development's page, a lone job's Documents tab. `reads` draws
 * the on state alone: a job in a development. `offer` is Send a paper (4d): while the picked site is off it asks once,
 * **Turn on secrecy for this site** or **Only send this one**, and while it is on it says so in two lines.
 */
export type SecrecyMode = 'door' | 'reads' | 'offer'

/** One row of `site_secrecy`, as the block reads it. */
export interface SiteSecrecyRow {
  id: string
  development_id: string | null
  address_key: string | null
  address: string | null
  book_document_id: string | null
  paper_name: string
  turned_on_at: string
  turned_off_at: string | null
}

export const SITE_SECRECY_SELECT = 'id, development_id, address_key, address, book_document_id, paper_name, turned_on_at, turned_off_at'

/** What turning secrecy on would reach, from `site_secrecy_preview`: the jobs shut and our own people asked. */
export interface SecrecyPreview {
  jobs: number
  people: number
}

/** What a site that is on holds: the jobs that carry its paper and the people who have signed it. */
export interface SecrecyCounts {
  jobs: number
  /** Null when the count could not be read: the line is left out, never guessed. */
  signed: number | null
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

export function parseSecrecyPreview(raw: unknown): SecrecyPreview {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { jobs: count(o.jobs), people: count(o.people) }
}

/** The four office roles turn secrecy on and off (the person's call, 2026-11-27). */
export function canTurnSecrecy(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

/** The office and the estimator read the block. The estimator presses nothing. */
export function canReadSecrecy(role: string | null | undefined): boolean {
  return canTurnSecrecy(role) || role === 'estimator'
}

/** The row that is on, newest first, or null when the site is off. */
export function liveSecrecy(rows: ReadonlyArray<SiteSecrecyRow>): SiteSecrecyRow | null {
  const on = rows.filter((r) => r.turned_off_at == null)
  on.sort((a, b) => (a.turned_on_at < b.turned_on_at ? 1 : a.turned_on_at > b.turned_on_at ? -1 : 0))
  return on[0] ?? null
}

/**
 * True when the database has no `site_secrecy` yet: the client is on the site before the migration is pushed. The
 * block then draws nothing, since a press would have nothing to call.
 */
export function secrecyNotThereYet(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message : ''
  return code === 'PGRST205' || code === '42P01' || (code === 'PGRST202' && message.includes('site_secrecy'))
}

/**
 * The papers the Turn on panel offers: the Contract Book's, as a job's Add a paper lists them. A paper built from
 * settings takes its settings a job at a time, so a site cannot take one and it is left out. A paper with no words
 * stays in the list, dead, with its reason.
 */
export function secrecyPapers(book: ReadonlyArray<BookPaperRow>): PickablePaper[] {
  return pickablePapers(book, []).filter((p) => !p.built)
}

const JOB = ['job', 'jobs'] as const
const PERSON = ['person', 'people'] as const

/** `3 jobs`, `1 person`: a count with its noun, as one value. */
export const countWords = (n: number, noun: readonly [string, string]): string => `${n} ${pluralNoun(noun, n)}`

export const SITE_SECRECY_WORDS = {
  heading: 'Secrecy on this site',
  off: 'Off',
  on: 'On',
  /** Under the off state on a development's page: what turning it on does, in two short sentences. */
  lead: 'Turn it on and every job here stays shut to our own people until they sign one paper. Each person signs once for the whole site.',
  /** The same on a lone job's Documents tab, where the site is the job's address. */
  leadAddress: 'Turn it on and every job at this address stays shut to our own people until they sign one paper. Each person signs once for the whole site.',
  /** On a job in a development: the block reads, and the presses are on the development's page. */
  onDevelopment: 'This job’s development has secrecy on. Turn it off on the development’s page.',
  /** In Send a paper, under a picked site that is off: what sending this one paper does and does not do. */
  offerLead: 'Secrecy is not on for this site. This paper is sent and kept with the site. Nothing is held, and our own people are not asked to sign.',
  /** The other press of that offer: go on with the one paper, and the offer goes. */
  onlySend: 'Only send this one',
  turnOn: 'Turn on secrecy for this site',
  turnOff: 'Turn it off…',
  panelTitle: 'Turn on secrecy for this site',
  pickPaper: 'The paper our own people sign',
  pickPaperHint: 'From the Contract Book. It need not be the paper a vendor signs.',
  noPapers: 'Nothing in the Contract Book can be picked yet. Write the paper there first.',
  whatHappens: 'What happens when you press',
  once: 'Each person signs once, and that covers every job here.',
  subs: 'A sub is an outside company and is not asked this paper.',
  later: 'A job added here later takes the paper too.',
  undo: 'Turn it off any time. The jobs open at once and every signature is kept.',
  notYet: 'Not yet',
  turningOn: 'Turning it on…',
  turningOff: 'Turning it off…',
  readingReach: 'Counting the jobs and the people…',
  estimator: 'The office turns secrecy on and off.',
  /** The label of each value line. */
  labels: { state: 'Secrecy', paper: 'Paper', jobs: 'Jobs', shut: 'Jobs that shut', people: 'People asked', signed: 'Signed' },
} as const

/** The off state's lead: a development's jobs, or the jobs at one address. */
export function secrecyLead(site: SecrecySite): string {
  return 'developmentId' in site ? SITE_SECRECY_WORDS.lead : SITE_SECRECY_WORDS.leadAddress
}

/**
 * Where a job's Documents tab gets its block from (4c). A job in a development reads the development's secrecy and
 * presses nothing: that door is the development's page. A lone job's site is its address, and its tab is the door.
 * A job with neither has no site.
 */
export function jobSecrecyDoor(job: { development_id?: string | null; job_address?: string | null }): { site: SecrecySite; mode: 'door' | 'reads' } | null {
  if (job.development_id) return { site: { developmentId: job.development_id }, mode: 'reads' }
  const address = (job.job_address ?? '').trim()
  return address ? { site: { address }, mode: 'door' } : null
}

/**
 * The site a paper names, as the block takes it (4d). A paper that names no site has none, and neither has an address
 * with nothing in it.
 */
export function paperSecrecySite(site: PaperSite | null | undefined): SecrecySite | null {
  if (!site) return null
  if (site.kind === 'development') return site.developmentId ? { developmentId: site.developmentId } : null
  const address = site.address.trim()
  return address ? { address } : null
}

/**
 * Whether the block draws at all, once its first read is back. A block that only reads says nothing of a site that is
 * off or a read that failed. The offer in Send a paper is for whoever can turn secrecy on: it says nothing to anyone
 * else, nothing of a read that failed, and nothing more of a site that is off once **Only send this one** was pressed.
 */
export function secrecyDraws(input: { mode: SecrecyMode; on: boolean; failed: boolean; canTurn: boolean; passed: boolean }): boolean {
  if (input.mode === 'reads') return input.on
  if (input.mode === 'offer') return input.canTurn && !input.failed && (input.on || !input.passed)
  return true
}

/** The last press of the Turn on panel: it names the act and how many people it asks. Dead until a paper is picked. */
export function turnOnButton(preview: SecrecyPreview | null, pickedPaper: boolean, busy: boolean): { label: string; dead: boolean } {
  if (busy) return { label: SITE_SECRECY_WORDS.turningOn, dead: true }
  const label = preview && preview.people > 0 ? `${countedLabel('Turn it on and ask', preview.people, PERSON)} to sign` : 'Turn it on'
  return { label, dead: !pickedPaper || preview == null }
}

/** The two counts of the panel, each a value: the jobs that shut and the people asked. */
export function previewValues(preview: SecrecyPreview): { jobs: string; people: string; jobsNote: string } {
  return {
    jobs: countWords(preview.jobs, JOB),
    people: countWords(preview.people, PERSON),
    jobsNote: preview.jobs === 0 ? 'No job is here yet. A job added later takes the paper.' : preview.jobs === 1 ? 'The job stays shut to each person until they sign.' : 'Each job stays shut to a person until they sign.',
  }
}

/** The on state's first line: `On since Nov 27`, the day a value. `turnedOnYmd` is the day in the app's own zone. */
export function onSinceSentence(turnedOnYmd: string | null): string {
  const day = shortDay(turnedOnYmd)
  return day ? `${SITE_SECRECY_WORDS.on} since ${val('day', day)}` : SITE_SECRECY_WORDS.on
}

/** The on state's counts, each a sentence with its value marked. */
export function onCountSentences(counts: SecrecyCounts): { jobs: string; signed: string | null } {
  return {
    jobs: counts.jobs === 0 ? 'No job is here yet' : `${val('count', countWords(counts.jobs, JOB))} ${counts.jobs === 1 ? 'carries' : 'carry'} the paper`,
    signed: counts.signed == null ? null : counts.signed === 0 ? 'Nobody has signed yet' : `${val('count', countWords(counts.signed, PERSON))} ${counts.signed === 1 ? 'has' : 'have'} signed`,
  }
}

/** The confirm window of **Turn it off…**: what opens, what is kept, and what turning it on again asks. */
export function turnOffConfirm(row: Pick<SiteSecrecyRow, 'paper_name'>, counts: SecrecyCounts | null): { title: string; message: string; confirmLabel: string; cancelLabel: string } {
  const jobs = counts?.jobs ?? 0
  const opens = jobs === 0 ? 'Nobody will be asked to sign for this site any more.' : jobs === 1 ? 'The 1 job here opens at once.' : `The ${jobs} jobs here open at once.`
  return {
    title: 'Turn off secrecy for this site?',
    message: `${opens} Every signature on ${row.paper_name} is kept. Turn it on again and only people who never signed are asked.`,
    confirmLabel: 'Turn secrecy off',
    cancelLabel: 'Keep it on',
  }
}

/** The toast after it is turned on. */
export function turnedOnToast(jobs: number): string {
  return jobs === 0 ? 'Secrecy is on for this site.' : `Secrecy is on. ${countWords(jobs, JOB)} now ${jobs === 1 ? 'asks' : 'ask'} for the paper.`
}

export const TURNED_OFF_TOAST = 'Secrecy is off. The jobs here are open and every signature is kept.'
