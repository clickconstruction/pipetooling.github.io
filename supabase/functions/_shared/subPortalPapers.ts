/**
 * A sub's papers as their own page reads them (punch list #371, step 1): the rows the `sub-portal` function reads,
 * shaped into the sheets the papers' kernel draws (`subPapers.ts`), with what the sub already answered.
 *
 *  - **Whose sheets.** Only a sheet that is this person's alone, by the rule every office screen uses
 *    (`sheetParties`, then `sheetOwedTo`). A sheet two people share is left out. Paid sheets stay in.
 *  - **The same sheet the office's window builds** (`paperSheetFrom` in `src/lib/subWorkOrders/subPapersInputs.ts`):
 *    each money line's day, how it was sent, and a memo the office hid left blank. The amounts always show.
 *    `subPortalPapers.test.ts` holds the two builders together, sheet for sheet.
 *  - **A number is read, never given.** A sheet carries the number and revision of its live paper in the register,
 *    where the office has made one. `asIssued` says whether today's figures are the ones that paper was issued with.
 *    Nothing here registers a paper.
 *  - **Checked first.** The three papers are built and checked against each other (`subPapersAddUp`). A set that does
 *    not add up hands back no figure at all.
 *
 * Pure: no table, and the clock is handed in.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from './appTimeZone.ts'
import { lineLaborCost } from './peopleLaborJobItemLineCost.ts'
import type { NeedsWorkOrderRosterPerson } from './rosterSub.ts'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties.ts'
import { paperPreparedAt, subPaperFingerprint } from './subPaperMarks.ts'
import {
  buildPaymentRecord,
  buildStatementOfAccount,
  buildWorkStatement,
  paperDay,
  paperJobLabel,
  paperMoneyDay,
  paperSendings,
  paperSheetName,
  subPapersAddUp,
  SUB_PAPER_CONFIRM_LIVE,
  type PaperCompany,
  type PaperContext,
  type PaperMoneyLine,
  type PaperSending,
  type PaperSheet,
} from './subPapers.ts'
import { sheetOwedTo, TEAM_SHEET_RULE } from './teamSheetRule.ts'

const cents = (n: number): number => Math.round(n * 100) / 100
const YMD = /^\d{4}-\d{2}-\d{2}/

// ── The rows, as the function reads them ─────────────────────────────────────────────────────────────────────

export type PapersSheetRow = { id: string; assigned_to_name: string | null; address: string | null; job_number: string | null; job_ledger_id: string | null; job_date: string | null; created_at: string | null; labor_rate: number | null }
export type PapersItemRow = { job_id: string; fixture: string | null; count: number | null; hrs_per_unit: number | null; is_fixed: boolean | null; labor_rate: number | null; direct_labor_amount: number | null; sequence_order?: number | null }
export type PapersPaymentRow = { id: string; job_id: string; amount: number | string | null; memo: string | null; payment_date: string | null; created_at: string | null; hidden_from_sub: boolean | null; method: string | null; method_ref: string | null; sending_id: string | null }
export type PapersAssigneeRow = { labor_job_id: string; person_id: string }
export type PapersPersonRow = { id: string; name: string | null; kind: string | null; account_user_id: string | null }
export type PapersUserRow = { id: string; role: string | null }
export type PapersSendingRow = { id: string; number: number | string | null }
export type PapersCreditRow = { payment_id: string | null; amount: number | string | null }
export type PapersRegisterRow = { id: string; kind: string; number: string | null; revision: number | null; labor_job_id: string | null; sending_id: string | null; payment_id: string | null; issued_at: string | null; replaced_by: string | null; voided_at: string | null; fingerprint: string | null }
/** `revision`, `amount` and `said_from` are what a confirm is read by: the revision the sub saw, what it came to, and the address the press came from. */
export type PapersAckRow = { id?: string; kind: string; paper_id: string | null; labor_job_id: string | null; sending_id: string | null; payment_id: string | null; note: string | null; created_at: string | null; revision?: number | string | null; amount?: number | string | null; said_from?: string | null }

export type SubPortalPapersRows = {
  personId: string
  sheets: readonly PapersSheetRow[]
  items: readonly PapersItemRow[]
  payments: readonly PapersPaymentRow[]
  /** Every name on the person's sheets, not only theirs: who else is on a sheet decides whether it is theirs alone. */
  assignees: readonly PapersAssigneeRow[]
  /** The roster rows of everyone named on those sheets. */
  people: readonly PapersPersonRow[]
  /** The logins behind those roster rows: a teammate is told from a sub by the account's role. */
  users: readonly PapersUserRow[]
  /** `jobs_ledger.job_name` by the sheet's `job_ledger_id`. */
  jobNames: Readonly<Record<string, string>>
  sendings: readonly PapersSendingRow[]
  credits: readonly PapersCreditRow[]
  register: readonly PapersRegisterRow[]
  acks: readonly PapersAckRow[]
}

// ── A payment's day and how it was sent, as the office words them ────────────────────────────────────────────

/** The office's `paymentDay` (`subPaymentsLedger.ts`): the Date sent, else the day the row was recorded, flagged. */
function moneyDay(p: { payment_date: string | null; created_at: string | null }): { ymd: string; recorded: boolean } | null {
  const sent = (p.payment_date ?? '').trim()
  if (YMD.test(sent)) return { ymd: sent.slice(0, 10), recorded: false }
  const made = (p.created_at ?? '').trim()
  if (!made) return null
  const ymd = calendarYmdInAppTzFromIso(made)
  return YMD.test(ymd) ? { ymd: ymd.slice(0, 10), recorded: true } : null
}

/** The office's method labels (`subPaymentWindow.ts`), restated: that file is the Record payment window's and stays in the app. */
const METHOD_LABEL: Record<string, string> = { check: 'Check', zelle: 'Zelle', mercury: 'Mercury', cashapp: 'Cash App', apple_pay: 'Apple Pay', cash: 'Cash', client_direct: 'Client direct', other: 'Other' }
const FROM_CREDIT = 'credit'

/** `Check 1182`, `Zelle`; '' when no method was picked. The office's `subPayMethodWords`. */
export function portalPayMethodWords(p: { method: string | null; method_ref: string | null }): string {
  const label = p.method === FROM_CREDIT ? 'From credit' : (METHOD_LABEL[p.method ?? ''] ?? '')
  if (!label) return ''
  const ref = (p.method_ref ?? '').trim()
  return ref ? `${label} ${ref}` : label
}

// ── The sheets ───────────────────────────────────────────────────────────────────────────────────────────────

/** What the register holds for a sheet's paper: its number, its live revision, the day that copy was issued. */
export type PortalPaperNumber = { number: string; revision: number; issuedOn: string; fingerprint: string }

/** Each sheet's live work statement in the register: not replaced, not void, the highest revision. */
export function portalSheetNumbers(register: readonly PapersRegisterRow[]): Map<string, PortalPaperNumber> {
  const out = new Map<string, PortalPaperNumber>()
  for (const r of register) {
    if (r.kind !== 'work_statement' || !r.labor_job_id || r.voided_at || r.replaced_by || !(r.number ?? '').trim()) continue
    const revision = Number(r.revision) || 1
    const have = out.get(r.labor_job_id)
    if (!have || revision > have.revision) out.set(r.labor_job_id, { number: (r.number ?? '').trim(), revision, issuedOn: r.issued_at ? calendarYmdInAppTzFromIso(r.issued_at).slice(0, 10) : '', fingerprint: r.fingerprint ?? '' })
  }
  return out
}

/** The ids of the sheets that are this person's alone, by the office's rule. */
export function portalOwnSheetIds(rows: Pick<SubPortalPapersRows, 'personId' | 'sheets' | 'assignees' | 'people' | 'users'>): Set<string> {
  const roleByUser = new Map(rows.users.map((u) => [u.id, u.role]))
  const roster: NeedsWorkOrderRosterPerson[] = rows.people.map((p) => ({ id: p.id, name: (p.name ?? '').trim(), kind: p.kind ?? '', accountRole: p.account_user_id ? (roleByUser.get(p.account_user_id) ?? null) : null }))
  const nameById = new Map(roster.map((p) => [p.id, p.name]))
  const lookup = buildSheetPartiesLookup(roster)
  const byJob = new Map<string, Array<{ personId: string; personName: string | null }>>()
  for (const a of rows.assignees) {
    const list = byJob.get(a.labor_job_id) ?? []
    list.push({ personId: a.person_id, personName: nameById.get(a.person_id) ?? null })
    byJob.set(a.labor_job_id, list)
  }
  const mine = `id:${rows.personId}`
  const out = new Set<string>()
  for (const s of rows.sheets) {
    const to = sheetOwedTo(sheetParties(s, byJob.get(s.id), lookup), TEAM_SHEET_RULE)
    if (to.person != null && to.key === mine) out.add(s.id)
  }
  return out
}

/** The person's own sheets as the papers read them, oldest first: the office's `paperSheetsFor`, from the function's rows. */
export function portalPaperSheets(rows: SubPortalPapersRows): PaperSheet[] {
  const own = portalOwnSheetIds(rows)
  const numbers = portalSheetNumbers(rows.register)
  const sendingNo = new Map<string, number>()
  for (const s of rows.sendings) {
    const n = Number(s.number)
    if (s.number != null && Number.isFinite(n)) sendingNo.set(s.id, n)
  }
  const confirms = portalConfirms(rows.acks)
  const creditKept = new Map<string, number>()
  for (const c of rows.credits) {
    const amount = Number(c.amount) || 0
    if (amount > 0 && c.payment_id) creditKept.set(c.payment_id, amount)
  }
  const itemsByJob = new Map<string, PapersItemRow[]>()
  for (const it of rows.items) {
    if (!own.has(it.job_id)) continue
    const list = itemsByJob.get(it.job_id) ?? []
    list.push(it)
    itemsByJob.set(it.job_id, list)
  }
  const moneyByJob = new Map<string, PaperMoneyLine[]>()
  for (const p of rows.payments) {
    if (!own.has(p.job_id)) continue
    const day = moneyDay(p)
    const fromCredit = p.method === FROM_CREDIT
    const list = moneyByJob.get(p.job_id) ?? []
    list.push({
      id: p.id,
      amount: cents(Number(p.amount) || 0),
      ymd: day?.ymd ?? '',
      recorded: day ? day.recorded : false,
      at: p.created_at ?? '',
      how: fromCredit ? '' : portalPayMethodWords(p),
      // The office hid this memo from the sub: the page never carries it. The amount always shows.
      memo: p.hidden_from_sub === true ? '' : (p.memo ?? '').trim(),
      sendingId: p.sending_id ?? null,
      sendingNo: p.sending_id ? (sendingNo.get(p.sending_id) ?? null) : null,
      fromCredit,
      creditKept: Math.max(0, cents(creditKept.get(p.id) ?? 0)),
      clientDirect: p.method === 'client_direct',
    })
    moneyByJob.set(p.job_id, list)
  }
  return rows.sheets
    .filter((s) => own.has(s.id))
    .map((s): PaperSheet => {
      const rate = Number(s.labor_rate) || 0
      const items = (itemsByJob.get(s.id) ?? []).slice().sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      const number = numbers.get(s.id)
      return {
        id: s.id,
        number: number?.number ?? '',
        revision: number?.revision ?? 1,
        replacesCopyOf: '',
        jobNumber: (s.job_number ?? '').trim(),
        jobName: (s.job_ledger_id ? (rows.jobNames[s.job_ledger_id] ?? '') : '').trim(),
        address: (s.address ?? '').trim(),
        day: (s.job_date ?? '').slice(0, 10) || (s.created_at ? calendarYmdInAppTzFromIso(s.created_at).slice(0, 10) : ''),
        lines: items.map((it) => ({ label: (it.fixture ?? '').trim() || 'A line', amount: cents(lineLaborCost({ count: it.count ?? undefined, hrs_per_unit: it.hrs_per_unit ?? undefined, is_fixed: it.is_fixed ?? undefined, labor_rate: it.labor_rate, direct_labor_amount: it.direct_labor_amount }, rate)) })),
        money: moneyByJob.get(s.id) ?? [],
        confirm: confirms.get(s.id) ?? null,
      }
    })
    .sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999') || a.id.localeCompare(b.id))
}

// ── What the sub answered ────────────────────────────────────────────────────────────────────────────────────

/** A payment's key on the papers: its sending's id, or `row:<payment id>` for one recorded before sendings. */
export function portalPaymentKeyOf(ack: Pick<PapersAckRow, 'sending_id' | 'payment_id'>): string {
  return ack.sending_id ? ack.sending_id : ack.payment_id ? `row:${ack.payment_id}` : ''
}

/** What a key on the papers points at in the tables: a sending, or one payment row. Null for a key that is neither. */
export function portalPaymentTarget(key: string): { sending_id: string | null; payment_id: string | null } | null {
  const k = key.trim()
  if (!k) return null
  if (k.startsWith('row:')) return k.length > 4 ? { sending_id: null, payment_id: k.slice(4) } : null
  return { sending_id: k, payment_id: null }
}

/**
 * Each sheet's confirm, from the rows the page wrote: the newest one that names its sheet and the revision the sub
 * saw. A work statement prints it, and says so when the statement has changed since (`buildWorkStatement`). The
 * office's window reads the same rows by this one rule.
 */
export function portalConfirms(acks: ReadonlyArray<Pick<PapersAckRow, 'kind' | 'labor_job_id' | 'created_at' | 'revision' | 'amount' | 'said_from'>>): Map<string, PaperConfirm> {
  const out = new Map<string, PaperConfirm>()
  const sorted = acks.slice().sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  for (const a of sorted) {
    if (a.kind !== 'confirmed' || !a.labor_job_id) continue
    const revision = Number(a.revision)
    if (!Number.isFinite(revision) || revision < 1) continue
    out.set(a.labor_job_id, { revision, amount: cents(Number(a.amount) || 0), at: a.created_at ? paperDay(calendarYmdInAppTzFromIso(a.created_at)) : 'a day not recorded', from: (a.said_from ?? '').trim() || 'their page' })
  }
  return out
}

export type PortalWrongNote = { about: 'statement' | 'payment'; key: string; day: string; note: string }

/** The answers a sub gave, as the page reads them: each payment marked received with its day, and each note they sent. */
export function portalAnswers(acks: readonly PapersAckRow[]): { received: Record<string, string>; wrong: PortalWrongNote[] } {
  const received: Record<string, string> = {}
  const wrong: PortalWrongNote[] = []
  const sorted = acks.slice().sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  for (const a of sorted) {
    const day = a.created_at ? paperDay(calendarYmdInAppTzFromIso(a.created_at)) : ''
    const payment = portalPaymentKeyOf(a)
    if (a.kind === 'received') {
      // The first answer stands: a payment is marked received once.
      if (payment && !(payment in received)) received[payment] = day
    } else if (a.kind === 'something_wrong') {
      if (a.labor_job_id) wrong.push({ about: 'statement', key: a.labor_job_id, day, note: (a.note ?? '').trim() })
      else if (payment) wrong.push({ about: 'payment', key: payment, day, note: (a.note ?? '').trim() })
    }
  }
  return { received, wrong }
}

// ── The block the page reads ─────────────────────────────────────────────────────────────────────────────────

export type SubPortalPapers =
  | {
      ok: true
      /** The letterhead, the sub, today and the moment this was read, for the papers the page draws. */
      ctx: PaperContext
      sheets: PaperSheet[]
      /** By sheet id, where the office has made the paper: its number, its live revision, the day that copy was issued, and whether today's figures are that copy's. */
      numbers: Record<string, { number: string; revision: number; issuedOn: string; asIssued: boolean }>
      /** Payments the sub marked received, by payment key, with the day. */
      received: Record<string, string>
      /** The notes the sub sent the office, oldest first. */
      wrong: PortalWrongNote[]
      /** *Still open* to date, over these sheets. */
      stillOpen: number
      /** Sheets on the page's Today view that are not here, because the person shares them with someone else. */
      sharedSheets: number
      officePhone: string
    }
  /** The papers do not agree with each other. The page says the office is checking, and shows no figure. */
  | { ok: false; officePhone: string }

export type PortalPaperSet = { sheets: PaperSheet[]; ctx: PaperContext; sendings: PaperSending[]; ok: boolean; problems: string[] }

/** The sheets, the context and the check, shared by the block and the two answers. */
export function portalPaperSet(rows: SubPortalPapersRows, who: { subName: string; company: PaperCompany; now: Date }): PortalPaperSet {
  const sheets = portalPaperSheets(rows)
  const today = calendarYmdInAppTzFromIso(who.now.toISOString()).slice(0, 10)
  const ctx: PaperContext = { company: who.company, sub: { name: who.subName, lines: [] }, today, preparedAt: paperPreparedAt(who.now, APP_CALENDAR_TZ), zone: 'Central time' }
  const sendings = paperSendings(sheets)
  const work = sheets.map((s) => buildWorkStatement(s, ctx))
  const payments = sendings.map((s) => buildPaymentRecord(s, sheets, ctx))
  const statement = buildStatementOfAccount(sheets, { from: null, to: null }, ctx)
  const check = subPapersAddUp({ statement, work, payments })
  return { sheets, ctx, sendings, ok: check.ok, problems: check.problems }
}

export function buildSubPortalPapers(rows: SubPortalPapersRows, who: { subName: string; company: PaperCompany; officePhone: string; now: Date }, set: PortalPaperSet = portalPaperSet(rows, who)): SubPortalPapers {
  if (!set.ok) return { ok: false, officePhone: who.officePhone }
  const live = portalSheetNumbers(rows.register)
  const numbers: Record<string, { number: string; revision: number; issuedOn: string; asIssued: boolean }> = {}
  for (const s of set.sheets) {
    const n = live.get(s.id)
    if (!n) continue
    numbers[s.id] = { number: n.number, revision: n.revision, issuedOn: n.issuedOn, asIssued: !!n.fingerprint && n.fingerprint === subPaperFingerprint(buildWorkStatement(s, set.ctx)) }
  }
  const answers = portalAnswers(rows.acks)
  return {
    ok: true,
    ctx: set.ctx,
    sheets: set.sheets,
    numbers,
    received: answers.received,
    wrong: answers.wrong,
    stillOpen: buildStatementOfAccount(set.sheets, { from: null, to: null }, set.ctx).stillOpen,
    sharedSheets: rows.sheets.length - set.sheets.length,
    officePhone: who.officePhone,
  }
}

// ── The two answers ──────────────────────────────────────────────────────────────────────────────────────────

/** The longest note a sub can send. */
export const PORTAL_WRONG_NOTE_MAX = 1000
/** The most notes one person's page sends in a day: a link is a capability, and a note asks the office to act. */
export const PORTAL_WRONG_NOTES_A_DAY = 10

export type PortalAnswerRow = {
  kind: 'received' | 'something_wrong' | 'confirmed'
  person_id: string
  labor_job_id: string | null
  sending_id: string | null
  payment_id: string | null
  /** The paper in the register the answer is about, where the office has made one, and the revision the sub saw. */
  paper_id: string | null
  revision: number | null
  /** The figure the sub was looking at: a payment's amount, what stays open on a statement, or what a confirmed statement comes to. */
  amount: number
  note: string | null
}

export type PortalAnswerPlan =
  /** `what` names the statement or payment as the office reads it: `WS-2041-1 · #2041 Cedar Hollow Clinic`, `PR-0231`. */
  | { ok: true; row: PortalAnswerRow; already: string | null; what: string }
  | { ok: false; status: number; error: string }

/** The live paper in the register for a sheet or a payment, by the mint's own rule: not replaced, not void, the highest revision. */
function livePaper(register: readonly PapersRegisterRow[], match: (r: PapersRegisterRow) => boolean): { id: string; revision: number; fingerprint: string } | null {
  let best: { id: string; revision: number; fingerprint: string } | null = null
  for (const r of register) {
    if (r.voided_at || r.replaced_by || !match(r)) continue
    const revision = Number(r.revision) || 1
    if (!best || revision > best.revision) best = { id: r.id, revision, fingerprint: r.fingerprint ?? '' }
  }
  return best
}

/**
 * What an answer writes, or why it is refused. Only a payment or a sheet on the person's own papers can be answered,
 * so another person's key reads as not found. `already` is the day a payment was marked received before: nothing is
 * written twice.
 */
export function planPortalAnswer(body: { action?: unknown; about?: unknown; key?: unknown; note?: unknown }, rows: SubPortalPapersRows, set: PortalPaperSet, confirmLive: boolean = SUB_PAPER_CONFIRM_LIVE): PortalAnswerPlan {
  const action = typeof body.action === 'string' ? body.action : ''
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  // While confirming is off the answer does not exist: the page draws no press for it, and a call for it reads as any unknown one.
  if (action !== 'got_it' && action !== 'something_wrong' && !(action === 'confirm' && confirmLive)) return { ok: false, status: 400, error: 'Unknown action.' }
  if (!set.ok) return { ok: false, status: 409, error: 'The office is checking your statements. Please call the office.' }
  if (action === 'confirm') {
    if (!key) return { ok: false, status: 400, error: 'Say which statement this is about.' }
    const sheet = set.sheets.find((s) => s.id === key)
    if (!sheet) return { ok: false, status: 404, error: 'That statement is not on your page.' }
    // A confirm is of a copy the office made: its number and its revision are what the record keeps. The page
    // never makes that copy, so a sheet with none, or one that changed since, has nothing to confirm yet.
    const paper = livePaper(rows.register, (r) => r.kind === 'work_statement' && r.labor_job_id === sheet.id)
    if (!paper) return { ok: false, status: 409, error: 'The office has not made this statement yet, so there is nothing to confirm. Please call the office.' }
    const statement = buildWorkStatement(sheet, set.ctx)
    if (!paper.fingerprint || paper.fingerprint !== subPaperFingerprint(statement)) return { ok: false, status: 409, error: "This statement changed since the office's copy. Please call the office for a new copy to confirm." }
    // One confirm per revision: a second press changes nothing and reads the first day back.
    const had = portalConfirms(rows.acks).get(sheet.id)
    const already = had && had.revision === paper.revision && Math.abs(had.amount - statement.comesTo) < 0.005 ? had.at : null
    return { ok: true, already, what: [sheet.number, paperJobLabel(sheet)].filter(Boolean).join(' · ') || paperSheetName(sheet), row: { kind: 'confirmed', person_id: rows.personId, note: null, labor_job_id: sheet.id, sending_id: null, payment_id: null, paper_id: paper.id, revision: paper.revision, amount: statement.comesTo } }
  }
  const about = action === 'got_it' ? 'payment' : body.about === 'statement' || body.about === 'payment' ? body.about : ''
  if (!about || !key) return { ok: false, status: 400, error: 'Say which statement or payment this is about.' }
  let note: string | null = null
  if (action === 'something_wrong') {
    note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) return { ok: false, status: 400, error: 'Tell the office what looks wrong.' }
    if (note.length > PORTAL_WRONG_NOTE_MAX) return { ok: false, status: 400, error: `Please keep the note under ${PORTAL_WRONG_NOTE_MAX.toLocaleString('en-US')} characters, or call the office.` }
  }
  const base = { kind: action === 'got_it' ? ('received' as const) : ('something_wrong' as const), person_id: rows.personId, note }
  if (about === 'statement') {
    const sheet = set.sheets.find((s) => s.id === key)
    if (!sheet) return { ok: false, status: 404, error: 'That statement is not on your page.' }
    const paper = livePaper(rows.register, (r) => r.kind === 'work_statement' && r.labor_job_id === sheet.id)
    return { ok: true, already: null, what: [sheet.number, paperJobLabel(sheet)].filter(Boolean).join(' · ') || paperSheetName(sheet), row: { ...base, labor_job_id: sheet.id, sending_id: null, payment_id: null, paper_id: paper?.id ?? null, revision: paper?.revision ?? null, amount: buildWorkStatement(sheet, set.ctx).stillOpen } }
  }
  const sending = set.sendings.find((s) => s.key === key)
  const target = sending ? portalPaymentTarget(sending.key) : null
  if (!sending || !target) return { ok: false, status: 404, error: 'That payment is not on your page.' }
  const paper = livePaper(rows.register, (r) => r.kind === 'payment_record' && (target.sending_id ? r.sending_id === target.sending_id : r.payment_id === target.payment_id))
  const received = portalAnswers(rows.acks).received
  const already = action === 'got_it' && sending.key in received ? received[sending.key] || paperDay(set.ctx.today) : null
  return { ok: true, already, what: sending.number || `the payment of ${paperMoneyDay(sending)}`, row: { ...base, labor_job_id: null, sending_id: target.sending_id, payment_id: target.payment_id, paper_id: paper?.id ?? null, revision: paper?.revision ?? null, amount: sending.amount } }
}
