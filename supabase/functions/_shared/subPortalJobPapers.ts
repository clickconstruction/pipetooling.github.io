/**
 * Papers before a job opens, step 6: the sub's own page. A sub with no login has no row security to hide a job from
 * them: their page is read and written with the service key, behind a link. So the page's two functions are the lock
 * itself for that person. `sub-portal` holds back everything that says where a job is or what the work is until the
 * sub has signed each paper the job requires, and `submit-sub-portal` refuses a press on that job's sheet or work
 * order until then. Both ask `job_papers_for_person(job, person)` (migration *_job_required_papers, service role
 * only), which answers `{ job_number, papers[] }` and an empty list for a job that requires none.
 *
 *  - **Shut** means the job has at least one paper this person has not signed.
 *  - **It fails closed.** The edge guard for people with a login (`jobPapersLock.ts`) fails open, because the
 *    database still refuses them. Nothing stands behind this page, so a job whose papers could not be read is held
 *    back and the page says so. A job the database answers with no papers is open exactly as before.
 *  - **Nothing changes for a sub whose jobs require no paper.** One look at `job_required_papers` finds the jobs
 *    that require any paper, and only those are asked about. With none shut, every blanking function here hands back
 *    the very rows it was given.
 *  - **Money stays.** A sub's own money is theirs to read: agreed, paid, open, every payment and its day. What goes is
 *    the address, the job's name, the scope lines, notes and memos, and the plans link.
 *
 * It imports nothing, and the rows are typed by the fields it reads, so a function that imports it takes on no other
 * file. Unit-tested from `src/lib/subPortal/subPortalJobPapersEdge.test.ts`.
 */

/** A refused press on a job the sub still owes a paper on. The page reads it in its own language (`saidJobPapersFirst`). */
export const JOB_PAPERS_FIRST_WORDS = 'Sign this job’s papers first.'
/** A refused press on a job whose papers could not be read: held shut, and said so. */
export const JOB_PAPERS_UNREAD_WORDS = 'We could not check this job’s papers. Please try again.'
/** A paper that is not on one of the sub's jobs. */
export const JOB_PAPER_NOT_YOURS_WORDS = 'That paper is not on your page.'
/** A paper the office took off the job since the page was read. */
export const JOB_PAPER_GONE_WORDS = 'This job no longer requires that paper.'
/** What a shut job's statement reads where its name would be. The page's own rows are worded by the page. */
export const PAPERS_FIRST_LINE = 'Papers to sign first'

export type PersonJobPaperStatus = 'none' | 'unsent' | 'sent' | 'signed'
export type PersonJobPaper = { id: string; paper_name: string; is_form: boolean; status: PersonJobPaperStatus; signed_at: string | null }
/** One job that waits on the sub's signature, as the page reads it. `unread` marks a job held shut because its papers could not be read. */
export type PersonJobPapers = { job_id: string; job_number: string; papers: PersonJobPaper[]; unread?: true }

const STATUSES: readonly PersonJobPaperStatus[] = ['none', 'unsent', 'sent', 'signed']
const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** `job_papers_for_person(job, person)` as the page's list reads it. Anything missing reads as owed, never as signed. */
export function personJobPapersFrom(jobId: string, raw: unknown): PersonJobPapers {
  const r = record(raw)
  const papers = (Array.isArray(r.papers) ? r.papers : [])
    .map((p) => record(p))
    .filter((p) => text(p.id))
    .map((p): PersonJobPaper => {
      const status = STATUSES.includes(p.status as PersonJobPaperStatus) ? (p.status as PersonJobPaperStatus) : 'none'
      return { id: text(p.id), paper_name: text(p.paper_name), is_form: p.is_form === true, status, signed_at: status === 'signed' && text(p.signed_at) ? text(p.signed_at) : null }
    })
  return { job_id: jobId, job_number: text(r.job_number), papers }
}

/** The rule: a job is shut to a person while one of its papers is not signed, or while its papers could not be read. */
export function jobShutByPapers(job: Pick<PersonJobPapers, 'papers' | 'unread'>): boolean {
  return job.unread === true || job.papers.some((p) => p.status !== 'signed')
}

// ── Which Pipeline job a row belongs to ──────────────────────────────────────────────────────────────────────

export type SheetTie = { id: string; job_ledger_id?: string | null }
export type CommitmentTie = { id: string; job_id?: string | null; labor_job_id?: string | null }

/** Each labor sheet's Pipeline job, by the sheet's own link. A sheet with no link belongs to no job here. */
export function sheetJobMap(sheets: readonly SheetTie[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of sheets) if (s.id && s.job_ledger_id) out[s.id] = s.job_ledger_id
  return out
}

/** A work order's Pipeline job: its own, else its sheet's. Null for an order tied to neither. */
export function commitmentJobId(c: Pick<CommitmentTie, 'job_id' | 'labor_job_id'>, sheetJob: Readonly<Record<string, string>>): string | null {
  return c.job_id || (c.labor_job_id ? (sheetJob[c.labor_job_id] ?? null) : null)
}

/** Every Pipeline job the sub's page shows something of: their sheets' jobs and their work orders' jobs, each once. */
export function subPortalJobIds(sheets: readonly SheetTie[], commitments: readonly CommitmentTie[]): string[] {
  const sheetJob = sheetJobMap(sheets)
  const out = new Set<string>(Object.values(sheetJob))
  for (const c of commitments) {
    const jobId = commitmentJobId(c, sheetJob)
    if (jobId) out.add(jobId)
  }
  return [...out]
}

// ── Asking the database ──────────────────────────────────────────────────────────────────────────────────────

type PapersAnswer = { data: unknown; error: { message: string } | null }

/** A read, as far as this file builds one: the filters it uses, then the answer. */
export interface JobPapersQuery extends PromiseLike<PapersAnswer> {
  eq(column: string, value: string): JobPapersQuery
  in(column: string, values: readonly string[]): JobPapersQuery
  is(column: string, value: null): JobPapersQuery
  limit(count: number): JobPapersQuery
}

/** The service-role client, as far as this file reads it: one function call and plain reads. */
export interface JobPapersAdmin {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<PapersAnswer>
  from(table: string): { select(columns: string): JobPapersQuery }
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : String(e))

/**
 * The jobs among these that require any paper today, in one look at the live rows. Null when the look failed or may
 * have been cut short: the caller then asks about every job, so a failed look never opens one.
 */
export async function jobsRequiringPapers(admin: JobPapersAdmin, jobIds: readonly string[]): Promise<Set<string> | null> {
  const out = new Set<string>()
  try {
    for (let i = 0; i < jobIds.length; i += 100) {
      const { data, error } = await admin.from('job_required_papers').select('job_id').in('job_id', jobIds.slice(i, i + 100)).is('removed_at', null).limit(1000)
      if (error) throw error
      const rows = (data ?? []) as Array<{ job_id: string | null }>
      if (rows.length >= 1000) return null
      for (const r of rows) if (r.job_id) out.add(r.job_id)
    }
    return out
  } catch (e) {
    console.error(`job_required_papers not read, every job is asked about: ${messageOf(e)}`)
    return null
  }
}

/** One person's papers on one job. A read that fails comes back `unread`, which holds the job shut. */
export async function personJobPapers(admin: JobPapersAdmin, jobId: string, personId: string): Promise<PersonJobPapers> {
  try {
    const { data, error } = await admin.rpc('job_papers_for_person', { p_job_id: jobId, p_person_id: personId })
    if (error) throw error
    return personJobPapersFrom(jobId, data)
  } catch (e) {
    console.error(`job_papers_for_person failed, the job is held shut: ${messageOf(e)}`)
    return { job_id: jobId, job_number: '', papers: [], unread: true }
  }
}

/**
 * The jobs among these that wait on this person's signature, in the order given: each with its number and its papers.
 * A job asked about once. `numberOf` names a job whose papers could not be read, from a number the page already shows.
 */
export async function jobsWaitingOnPerson(admin: JobPapersAdmin, personId: string, jobIds: readonly string[], numberOf: Readonly<Record<string, string>> = {}): Promise<PersonJobPapers[]> {
  const ids = [...new Set(jobIds.filter(Boolean))]
  if (ids.length === 0) return []
  const requiring = await jobsRequiringPapers(admin, ids)
  const ask = requiring ? ids.filter((id) => requiring.has(id)) : ids
  const out: PersonJobPapers[] = []
  for (let i = 0; i < ask.length; i += 8) {
    const part = await Promise.all(ask.slice(i, i + 8).map((id) => personJobPapers(admin, id, personId)))
    for (const job of part) if (jobShutByPapers(job)) out.push(job.unread ? { ...job, job_number: numberOf[job.job_id] ?? '' } : job)
  }
  return out
}

export type JobShutState = 'open' | 'shut' | 'unread'

/** Whether one job is shut to one person, for a press. `unread` is a job held shut because its papers could not be read. */
export async function jobShutToPerson(admin: JobPapersAdmin, jobId: string | null | undefined, personId: string | null | undefined): Promise<JobShutState> {
  if (!jobId || !personId) return 'open'
  const requiring = await jobsRequiringPapers(admin, [jobId])
  if (requiring && !requiring.has(jobId)) return 'open'
  const job = await personJobPapers(admin, jobId, personId)
  return job.unread ? 'unread' : jobShutByPapers(job) ? 'shut' : 'open'
}

/** What a press on a shut job is answered with, or null to carry on. */
export function shutJobRefusal(state: JobShutState): { status: number; error: string } | null {
  if (state === 'shut') return { status: 403, error: JOB_PAPERS_FIRST_WORDS }
  if (state === 'unread') return { status: 503, error: JOB_PAPERS_UNREAD_WORDS }
  return null
}

/** Every Pipeline job a person's page shows something of, read for a press: the same sheets and work orders the page's read ties to a job. */
export async function readSubPortalJobIds(admin: JobPapersAdmin, personId: string): Promise<string[]> {
  const { data: junction, error: junctionError } = await admin.from('people_labor_job_assignees').select('labor_job_id').eq('person_id', personId)
  if (junctionError) throw junctionError
  const sheetIds = new Set<string>(((junction ?? []) as Array<{ labor_job_id: string }>).map((r) => r.labor_job_id))
  const { data: orders, error: ordersError } = await admin.from('step_commitments').select('id, job_id, labor_job_id').eq('person_id', personId).in('status', ['offered', 'accepted', 'approved']).limit(200)
  if (ordersError) throw ordersError
  const commitments = (orders ?? []) as CommitmentTie[]
  for (const c of commitments) if (!c.job_id && c.labor_job_id) sheetIds.add(c.labor_job_id)
  const sheets: SheetTie[] = []
  const ids = [...sheetIds]
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await admin.from('people_labor_jobs').select('id, job_ledger_id').in('id', ids.slice(i, i + 150))
    if (error) throw error
    sheets.push(...((data ?? []) as SheetTie[]))
  }
  return subPortalJobIds(sheets, commitments)
}

// ── Holding a shut job's rows back ───────────────────────────────────────────────────────────────────────────

/** The mark a held-back row carries: the Pipeline job whose papers it waits on. Rows of an open job carry none. */
export type PapersFirstMark = { papersFirstJobId?: string }

/** A sheet on the page's Today view, by the fields that say where the job is or what the work is. */
export type ShutSheetShape = {
  id: string
  address: string | null
  items: readonly unknown[]
  payHoldReason: string | null
  plansUrl?: string | null
  agreement: { lines: readonly unknown[]; exclusions: readonly string[]; references: readonly unknown[]; acknowledgements: readonly string[] } | null
  dates?: { changeRequested: { note: string | null } | null } | null
  progress?: { note: string | null } | null
}

/** A shut job's sheet: its id, number, stage, days and money stay. The address, the lines, the notes and the plans link go. */
export function blankShutSheet<T extends ShutSheetShape>(sheet: T, jobId: string): T & PapersFirstMark {
  return {
    ...sheet,
    address: null,
    items: [],
    payHoldReason: null,
    ...('plansUrl' in sheet ? { plansUrl: null } : {}),
    agreement: sheet.agreement ? { ...sheet.agreement, lines: [], exclusions: [], references: [], acknowledgements: [] } : sheet.agreement,
    ...(sheet.dates ? { dates: { ...sheet.dates, changeRequested: sheet.dates.changeRequested ? { ...sheet.dates.changeRequested, note: null } : sheet.dates.changeRequested } } : {}),
    ...(sheet.progress ? { progress: { ...sheet.progress, note: null } } : {}),
    papersFirstJobId: jobId,
  } as T & PapersFirstMark
}

/** An open offer, by the fields that say what the work is. */
export type ShutOfferShape = {
  id: string
  title: string
  lines: readonly unknown[]
  startsLabel: string | null
  exclusions: readonly string[]
  references: readonly unknown[]
  acknowledgements: readonly string[]
  specialProvisions: string | null
}

/** A shut job's offer: its id, amount, window and expiry stay. The title, the scope and everything it names go. */
export function blankShutOffer<T extends ShutOfferShape>(offer: T, jobId: string): T & PapersFirstMark {
  return { ...offer, title: 'Work order', lines: [], startsLabel: null, exclusions: [], references: [], acknowledgements: [], specialProvisions: null, papersFirstJobId: jobId } as T & PapersFirstMark
}

/** A day on *Your days*. */
export type ShutBookingShape = { label: string; address: string | null; jobNumber: string | null; commitmentId: string | null; note: string | null }

/** A shut job's booking: the days and the job's number stay. The stage's name, the address and the note go. */
export function blankShutBooking<T extends ShutBookingShape>(booking: T, jobId: string): T & PapersFirstMark {
  return { ...booking, label: booking.jobNumber ? `#${booking.jobNumber}` : booking.commitmentId ? 'Work order' : 'Sheet', address: null, note: null, papersFirstJobId: jobId } as T & PapersFirstMark
}

/** A sheet as the Statements view's papers read it. */
export type ShutPaperSheetShape = { id: string; number: string; jobName: string; address: string; lines: ReadonlyArray<{ label: string; amount: number }>; money: ReadonlyArray<{ memo: string }> }

/**
 * A shut job's statement: every amount, day and way of payment stays, so the papers still add up. The job's name reads
 * *Papers to sign first*, the address is empty, each line keeps its amount under a plain label, and memos are empty.
 * The office's number goes too: the copy the page draws no longer carries the office's words, so it is the page's own.
 */
export function blankShutPaperSheet<T extends ShutPaperSheetShape>(sheet: T): T {
  return { ...sheet, number: '', jobName: PAPERS_FIRST_LINE, address: '', lines: sheet.lines.map((l, i) => ({ ...l, label: `Line ${i + 1}` })), money: sheet.money.map((m) => ({ ...m, memo: '' })) } as T
}

/** The Statements view's block, as far as this file reads it. */
export type ShutPapersShape = { ok: boolean; sheets?: readonly ShutPaperSheetShape[]; numbers?: Readonly<Record<string, unknown>> } | null

/** The Statements view's block with the shut jobs' sheets held back. The block's own check ran before this, on the true rows. */
export function blankShutPapers<P extends ShutPapersShape>(papers: P, sheetJob: Readonly<Record<string, string | null | undefined>>, shut: ReadonlySet<string>): P {
  if (shut.size === 0 || !papers || papers.ok !== true || !papers.sheets) return papers
  const held = new Set(papers.sheets.filter((s) => shut.has(sheetJob[s.id] ?? '')).map((s) => s.id))
  if (held.size === 0) return papers
  const numbers: Record<string, unknown> = {}
  for (const [id, n] of Object.entries(papers.numbers ?? {})) if (!held.has(id)) numbers[id] = n
  return { ...papers, sheets: papers.sheets.map((s) => (held.has(s.id) ? blankShutPaperSheet(s) : s)), numbers } as P
}

/** A payment row as the Today view's ledger reads it. `job_id` is the labor sheet's id. */
export type ShutPaymentRowShape = { job_id: string; memo: string | null }

/** The payments of a shut job's sheets with their memos held back. The amounts and the days stay. */
export function blankShutPaymentMemos<T extends ShutPaymentRowShape>(rows: T[], sheetJob: Readonly<Record<string, string | null | undefined>>, shut: ReadonlySet<string>): T[] {
  if (shut.size === 0 || !rows.some((p) => shut.has(sheetJob[p.job_id] ?? ''))) return rows
  return rows.map((p) => (shut.has(sheetJob[p.job_id] ?? '') ? ({ ...p, memo: null } as T) : p))
}

/** Which Pipeline job each row of the reply belongs to. Sheets by labor sheet id, offers by work order id, bookings by their place in the list. */
export type SubPortalRowTies = {
  sheets: Readonly<Record<string, string | null | undefined>>
  offers: Readonly<Record<string, string | null | undefined>>
  bookings: ReadonlyArray<string | null | undefined>
}

/**
 * The reply's rows with the shut jobs held back. A row of an open job, or of no job, is handed back as it came, and
 * with no job shut the rows come back untouched: nothing changes for a sub whose jobs require no paper.
 */
export function blankShutSubPortalRows<S extends ShutSheetShape, O extends ShutOfferShape, B extends ShutBookingShape, P extends ShutPapersShape>(
  rows: { sheets: S[]; offers: O[]; bookings: B[]; papers: P },
  ties: SubPortalRowTies,
  shut: ReadonlySet<string>,
): { sheets: Array<S & PapersFirstMark>; offers: Array<O & PapersFirstMark>; bookings: Array<B & PapersFirstMark>; papers: P } {
  if (shut.size === 0) return rows
  const shutJob = (jobId: string | null | undefined): string | null => (jobId && shut.has(jobId) ? jobId : null)
  return {
    sheets: rows.sheets.map((s) => {
      const jobId = shutJob(ties.sheets[s.id])
      return jobId ? blankShutSheet(s, jobId) : s
    }),
    offers: rows.offers.map((o) => {
      const jobId = shutJob(ties.offers[o.id])
      return jobId ? blankShutOffer(o, jobId) : o
    }),
    bookings: rows.bookings.map((b, i) => {
      const jobId = shutJob(ties.bookings[i])
      return jobId ? blankShutBooking(b, jobId) : b
    }),
    papers: blankShutPapers(rows.papers, ties.sheets, shut),
  }
}
