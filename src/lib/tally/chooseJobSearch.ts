/**
 * The Choose job sheet's search (punch list #216): every word you type lands somewhere on the
 * job and is lit where it landed, a hit on the number sorts first, a hit on the customer shows
 * the customer line. The fields are the ones the app's job searches read
 * (`projectsForecastJobSearch.ts`, the `search_jobs_ledger` RPC): the number with or without its
 * ledger letter, the name, the address, the customer. The every-word rule is the Clock sessions
 * search's (`clockSessionSearch.ts`). Pure: the sheet draws the runs.
 */
import { effectiveJobLedgerNumber, resolveJobLedgerPrefix, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'

export type ChooseJobRow = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  job_address: string | null
  customer_name?: string | null
  service_type_id?: string | null
}

/** A piece of a field's text, lit when a typed word landed on it. */
export type LitRun = { text: string; lit: boolean }

export type ChooseJobHit = {
  job: ChooseJobRow
  /** The bare number as the tally prints it: the HCP number, else the Click number, else '—'. */
  number: LitRun[]
  name: LitRun[]
  address: LitRun[]
  /** The customer line, present only when a word landed on it. */
  customer: LitRun[] | null
  /** 0: the number is a typed word. 1: the number starts with one. 2: the hit is elsewhere, or nothing was typed. */
  rank: 0 | 1 | 2
}

/** The words typed, lowercased, in order. */
export function chooseJobSearchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** The number as the sheet prints it. */
export function chooseJobNumber(job: Pick<ChooseJobRow, 'hcp_number' | 'click_number'>): string {
  return effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
}

/**
 * Every occurrence of every word in `text`, case-insensitive, as runs of lit and unlit text.
 * Overlapping hits ("san" and "san mar") merge into one lit run. No words, or none landing,
 * gives the whole text as one unlit run; empty text gives no runs.
 */
export function litRuns(text: string, words: readonly string[]): LitRun[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const lit = new Array<boolean>(text.length).fill(false)
  for (const w of words) {
    if (!w) continue
    let pos = 0
    for (;;) {
      const at = lower.indexOf(w, pos)
      if (at === -1) break
      for (let i = at; i < at + w.length; i++) lit[i] = true
      pos = at + 1
    }
  }
  const runs: LitRun[] = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || lit[i] !== lit[start]) {
      runs.push({ text: text.slice(start, i), lit: lit[start] === true })
      start = i
    }
  }
  return runs
}

/**
 * The word as it lands on the bare number: "j972" with the job's letter J is "972"; a word that
 * is not the letter plus digits is itself.
 */
function numberWord(word: string, prefixLower: string): string {
  if (prefixLower && word.startsWith(prefixLower) && word.length > prefixLower.length && /^\d+$/.test(word.slice(prefixLower.length))) {
    return word.slice(prefixLower.length)
  }
  return word
}

/** The job's hit for the typed words, or null when a word landed nowhere. */
export function chooseJobHit(job: ChooseJobRow, words: readonly string[], prefixMap: LedgerPrefixMap): ChooseJobHit | null {
  const number = chooseJobNumber(job)
  const numberLower = number.toLowerCase()
  const prefixLower = resolveJobLedgerPrefix(job.service_type_id ?? null, prefixMap).toLowerCase()
  const name = (job.job_name ?? '').trim()
  const address = (job.job_address ?? '').trim()
  const customer = (job.customer_name ?? '').trim()
  const nameLower = name.toLowerCase()
  const addressLower = address.toLowerCase()
  const customerLower = customer.toLowerCase()

  const numberWords: string[] = []
  let rank: 0 | 1 | 2 = 2
  for (const w of words) {
    const nw = numberWord(w, prefixLower)
    const onNumber = numberLower.includes(nw)
    if (onNumber) {
      numberWords.push(nw)
      if (numberLower === nw) rank = 0
      else if (rank === 2 && numberLower.startsWith(nw)) rank = 1
    }
    const lands = onNumber || nameLower.includes(w) || addressLower.includes(w) || customerLower.includes(w)
    if (!lands) return null
  }
  const customerRuns = customer ? litRuns(customer, words) : []
  return {
    job,
    number: litRuns(number, numberWords),
    name: litRuns(name || '—', words),
    address: litRuns(address, words),
    customer: customerRuns.some((r) => r.lit) ? customerRuns : null,
    rank: words.length === 0 ? 2 : rank,
  }
}

/**
 * The jobs the typed words land on, number hits first (the number typed, then numbers that start
 * with it), the rest in the order given. Nothing typed keeps every job in its order, unlit.
 */
export function searchChooseJobs(jobs: readonly ChooseJobRow[], query: string, prefixMap: LedgerPrefixMap): ChooseJobHit[] {
  const words = chooseJobSearchWords(query)
  const hits: ChooseJobHit[] = []
  for (const job of jobs) {
    const hit = chooseJobHit(job, words, prefixMap)
    if (hit) hits.push(hit)
  }
  if (words.length === 0) return hits
  return hits
    .map((hit, i) => ({ hit, i }))
    .sort((a, b) => a.hit.rank - b.hit.rank || a.i - b.i)
    .map((x) => x.hit)
}
