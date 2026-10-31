/**
 * Put the N in (punch list #208 PR 3): the words and rows of the one press that puts every bid and
 * job at the site's address into the development. Pure: the confirm window's rows (now → after),
 * the preview's lines, the button's label with its count, and the outcome's words from what the
 * RPC says moved. The write is `putAllInDevelopment` in `chipWrites.ts`.
 */
import type { MemberBid, MemberJob, Members } from './overview'

export type PutInRow = { label: string; before: string; after: string | null; changes: boolean }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The window's rows: the development's counts now and after, the address, the customer. */
export function putInConfirmRows(args: { atAddress: Members; inIt: Members; name: string; address: string | null; customerName: string | null }): PutInRow[] {
  const bidsNow = args.inIt.bids.length
  const jobsNow = args.inIt.jobs.length
  const bidsAdd = args.atAddress.bids.length
  const jobsAdd = args.atAddress.jobs.length
  return [
    { label: 'Development', before: `not in ${args.name}`, after: args.name, changes: true },
    { label: 'Bids in it', before: String(bidsNow), after: String(bidsNow + bidsAdd), changes: bidsAdd > 0 },
    { label: 'Jobs in it', before: String(jobsNow), after: String(jobsNow + jobsAdd), changes: jobsAdd > 0 },
    { label: 'Address', before: args.address ?? '—', after: null, changes: false },
    { label: 'Customer', before: args.customerName ?? '—', after: null, changes: false },
  ]
}

export const PUT_IN_PREVIEW_CAP = 8

/** The preview's lines: each piece's number and name, the cap then *and N more*. */
export function putInPreviewLines(atAddress: Members, labels: { bidLabel: (b: MemberBid) => string; jobLabel: (j: MemberJob) => string }): { lines: string[]; more: number } {
  const all = [
    ...atAddress.jobs.map((j) => `${labels.jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim()),
    ...atAddress.bids.map((b) => `${labels.bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim()),
  ]
  return { lines: all.slice(0, PUT_IN_PREVIEW_CAP), more: Math.max(0, all.length - PUT_IN_PREVIEW_CAP) }
}

/** The button: the verb with its count (`check:batch-words` wants the count on a batch press). */
export function putInLabel(atAddress: Members, name: string): string {
  const n = atAddress.bids.length + atAddress.jobs.length
  return `Put the ${n} in ${name}`
}

/** What the RPC says moved, as a sentence; a piece the caller may not update stays, and the sentence says how many did move. */
export function putInOutcomeWords(moved: { bids: number; jobs: number }, asked: { bids: number; jobs: number }, name: string): string {
  const parts = [moved.bids ? plural(moved.bids, 'bid') : null, moved.jobs ? plural(moved.jobs, 'job') : null].filter((x): x is string => !!x)
  const askedN = asked.bids + asked.jobs
  const movedN = moved.bids + moved.jobs
  if (movedN === 0) return `Nothing moved: the ${askedN === 1 ? 'job or bid' : `${askedN} jobs and bids`} stayed as ${askedN === 1 ? 'it was' : 'they were'}, which the bid's and job's own rules decide.`
  const head = `Put ${parts.join(' and ')} in ${name}.`
  return movedN < askedN ? `${head} ${askedN - movedN} stayed as ${askedN - movedN === 1 ? 'it was' : 'they were'}, which the bid's and job's own rules decide.` : head
}
