/**
 * GC mode, Owner Billing's O7c: what a GC job's customer sees and presses in their portal. For each GC project of
 * theirs that we won: the change orders waiting on them, to sign or decline, and the work to accept once every line is
 * billed (gc_record_acceptance's own rule). customer-portal reads the rows (`loadGcPortalJobs`) and draws them
 * (`gcPortalJobs`); submit-portal-request checks a press against the same link (`gcPortalOwns`) and says the
 * database's refusals in the customer's words (`gcPortalRefusalWords`). The pure parts are tested from src.
 *
 * The Board's B6-d-iii adds our contract to sign: the newest send of it on a won job (gc_owner_contract_sends, B6-d-i),
 * with its price as one number (never by line: board-b5.md:248), the terms they sign to, the sign-by day and the file
 * to read, until they sign it here (`gc_owner_contract_sign`, `gcContractSignWords`). A job with only that to show
 * shows.
 */

export type PortalGcChangeOrder = {
  id: string
  number: number
  description: string
  /** What it adds to their price; below zero, a credit. */
  price: number
  /** The working days it adds. */
  days: number
  sentOn: string
}

/**
 * Every term we bill by (Owner Billing's O1 columns on gc_projects), so the summary they sign under never reads easier
 * than what Bill the customer bills: the share held back and when it drops, the days to pay after the architect
 * certifies a bill, interest on a late bill, and what each day of finishing late takes off our price. Null: not on
 * this job.
 */
export type PortalGcTerms = {
  retainagePct: number | null
  retainageStep: { atPct: number; toPct: number; way: 'all' | 'rest' } | null
  payDays: number | null
  lateInterestPctPerMonth: number | null
  lateFinishPerDay: number | null
}

/** Our contract on a job: to sign (the newest send), or signed here, with who signed and the file they signed. */
export type PortalGcContract =
  | ({
      state: 'toSign'
      sendId: string
      signBy: string
      /** Their price, as one number. */
      total: number
      fileName: string
      /** A link to read the file, for an hour. Null when it could not be made: they call us. */
      fileUrl: string | null
      /** Our price no longer matches this send (a trade added or taken off since): no sign form, we send a new one. */
      priceChanged?: boolean
    } & PortalGcTerms)
  | { state: 'signed'; signedOn: string; signer: string | null; fileName: string; fileUrl: string | null }

export type PortalGcJob = {
  projectId: string
  name: string
  /** Our contract, while it waits on them or once they signed it here. Absent: nothing to show. */
  contract?: PortalGcContract
  /** Sent to them and not yet answered, lowest number first. */
  changeOrders: PortalGcChangeOrder[]
  /** Every line is billed and nothing is accepted yet: Accept the work shows. */
  canAccept: boolean
  /** The day the work was accepted, and whether at the office or here. Null before. */
  accepted: { on: string; how: 'office' | 'portal' } | null
}

export type GcPortalRows = {
  projects: { id: string; name: string; customer_id: string | null }[]
  gc: { project_id: string; stage: string }[]
  changeOrders: { id: string; project_id: string; number: number; description: string; price: number | string; days: number; sent_on: string | null; status: string }[]
  acceptances: { project_id: string; accepted_on: string; how: string }[]
  /** Each project's pay applications: its number, whether final, and its work so far. */
  payApps: { project_id: string; number: number; final: boolean; work_to_date: number | string }[]
  /** Our price with the customer today, by project (gc_owner_contract_now). */
  contractNow: Record<string, number>
  /** Every send of our contract on their won jobs (B6-d-i). Missing: none read. */
  contractSends?: { id: string; project_id: string; sign_by: string; total: number | string | null; file_name: string; signed_on: string | null; signer_printed_name: string | null; created_at: string }[]
  /** Each won job's terms and whether our contract is signed or the job lost. */
  terms?: {
    project_id: string
    owner_retainage_pct: number | string | null
    owner_retainage_step_at_pct?: number | string | null
    owner_retainage_step_to_pct?: number | string | null
    owner_retainage_step_way?: string | null
    owner_late_interest_pct_per_month?: number | string | null
    owner_late_finish_per_day?: number | string | null
    owner_pay_days: number | null
    owner_contract_signed_on: string | null
    lost_on: string | null
  }[]
  /** A link to read each send's file, by send id. */
  contractUrls?: Record<string, string>
  /** The sends whose price is no longer whole for their job (gc_owner_contract_worth_ok said no). */
  priceChanged?: string[]
}

/** The stages of a job we won, as the board stages them. */
const WON = new Set(['buyout', 'building', 'closed'])

/** Every line billed: the last progress pay application's work so far covers the price today (half a dollar's slack). */
function everyLineBilled(rows: GcPortalRows, projectId: string): boolean {
  const progress = rows.payApps.filter((a) => a.project_id === projectId && !a.final).sort((a, b) => b.number - a.number)[0]
  const contract = rows.contractNow[projectId]
  return progress !== undefined && contract !== undefined && Number(progress.work_to_date) >= contract - 0.5
}

/**
 * Our contract on one job: the newest send while nothing is signed and the job is going, or the send they signed here.
 * Signed on paper at the office: nothing, since there is nothing for them to do.
 */
function contractOf(rows: GcPortalRows, projectId: string): PortalGcContract | null {
  const newest = (rows.contractSends ?? [])
    .filter((s) => s.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!newest) return null
  const fileUrl = rows.contractUrls?.[newest.id] ?? null
  if (newest.signed_on) return { state: 'signed', signedOn: newest.signed_on, signer: newest.signer_printed_name, fileName: newest.file_name, fileUrl }
  const terms = rows.terms?.find((t) => t.project_id === projectId)
  if (!terms || terms.owner_contract_signed_on || terms.lost_on) return null
  const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  const at = num(terms.owner_retainage_step_at_pct)
  const to = num(terms.owner_retainage_step_to_pct)
  return {
    state: 'toSign',
    sendId: newest.id,
    signBy: newest.sign_by,
    total: num(newest.total) ?? 0,
    fileName: newest.file_name,
    fileUrl,
    ...(rows.priceChanged?.includes(newest.id) ? { priceChanged: true } : {}),
    retainagePct: num(terms.owner_retainage_pct),
    retainageStep: at !== null && to !== null ? { atPct: at, toPct: to, way: terms.owner_retainage_step_way === 'all' ? 'all' : 'rest' } : null,
    payDays: terms.owner_pay_days,
    lateInterestPctPerMonth: num(terms.owner_late_interest_pct_per_month),
    lateFinishPerDay: num(terms.owner_late_finish_per_day),
  }
}

/** Every term we bill by, as the sentences the customer reads above the sign form, in Bill the customer's words. */
export function gcContractTermsLines(t: PortalGcTerms, usd: (n: number) => string): string[] {
  const lines = ['We bill once a month for the work done.']
  if (t.retainagePct !== null && t.retainagePct > 0) {
    if (t.retainageStep) {
      const at = t.retainageStep.atPct === 50 ? 'half done' : `${t.retainageStep.atPct}% done`
      lines.push(`Part of each bill, ${t.retainagePct}%, is held until the work is ${at}.`)
      lines.push(`Then it drops to ${t.retainageStep.toPct}% ${t.retainageStep.way === 'all' ? 'on all of it' : 'on the rest'}.`)
    } else {
      lines.push(`Part of each bill, ${t.retainagePct}%, is held until the end.`)
    }
  }
  if (t.payDays !== null) lines.push(`Each bill is due ${t.payDays} days after the architect certifies it.`)
  if (t.lateInterestPctPerMonth !== null) lines.push(`A late bill carries interest of ${t.lateInterestPctPerMonth}% a month.`)
  if (t.lateFinishPerDay !== null && t.lateFinishPerDay > 0) lines.push(`Each day the work finishes late takes ${usd(t.lateFinishPerDay)} off our price.`)
  return lines
}

/** The refusal when the file they would sign is not the one we sent: its bytes no longer match the send's SHA-256. */
export const CONTRACT_FILE_CHANGED_WORDS = 'This contract changed after we sent it. We will send you the new one.'

/** The SHA-256 of a file's bytes as lowercase hex, as the send kept it. */
export async function bytesSha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The customer's GC jobs we won, each with something to show: our contract, a change order to answer, the work to accept, or the acceptance. */
export function gcPortalJobs(rows: GcPortalRows, customerId: string): PortalGcJob[] {
  const won = new Set(rows.gc.filter((g) => WON.has(g.stage)).map((g) => g.project_id))
  return rows.projects
    .filter((p) => p.customer_id === customerId && won.has(p.id))
    .map((p): PortalGcJob => {
      const acceptance = rows.acceptances.find((a) => a.project_id === p.id)
      const contract = contractOf(rows, p.id)
      return {
        projectId: p.id,
        name: p.name,
        ...(contract ? { contract } : {}),
        changeOrders: rows.changeOrders
          .filter((c) => c.project_id === p.id && c.status === 'sent' && c.sent_on !== null)
          .sort((a, b) => a.number - b.number)
          .map((c) => ({ id: c.id, number: c.number, description: c.description.trim(), price: Number(c.price), days: c.days, sentOn: c.sent_on ?? '' })),
        canAccept: !acceptance && everyLineBilled(rows, p.id),
        accepted: acceptance ? { on: acceptance.accepted_on, how: acceptance.how === 'portal' ? 'portal' : 'office' } : null,
      }
    })
    .filter((j) => j.contract !== undefined || j.changeOrders.length > 0 || j.canAccept || j.accepted !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** gc_customer_sign_owner_contract's keys, in the customer's words (its DETAIL is the office's copy of them). */
const CONTRACT_SIGN_WORDS: Record<string, string> = {
  notFound: 'That contract is not on your account.',
  notYours: 'That contract is not on your account.',
  lost: 'That job is not going ahead. Please call our office.',
  alreadySigned: 'You signed it already. Thank you.',
  notNewest: 'We sent you a newer one. Refresh the page and sign that one.',
  priceChanged: 'Our price changed after we sent this. We will send you the new one.',
  nameNeeded: 'Type your name to sign.',
  tooLong: 'Keep the name under 200 characters.',
}

/** A refusal of our contract's signing, by its key, in the customer's words. */
export function gcContractSignWords(message: string): string {
  return CONTRACT_SIGN_WORDS[message.trim()] ?? 'Something went wrong. Please try again, or call our office.'
}

/** A signature on our contract as the portal sends it (B6-d-iii), or the customer's words for why it cannot go. */
export type ContractSignRequest =
  | { ok: true; sendId: string; printedName: string; png: string | null; consent: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Read `gc_owner_contract_sign`'s body: the send, the name, a drawn signature or none for a typed one, and the e-sign
 * consent, which is required before anything is stored (as the trade's statement of work requires it).
 */
export function parseContractSign(body: Record<string, unknown>): ContractSignRequest {
  const sendId = typeof body.sendId === 'string' && /^[0-9a-f-]{36}$/.test(body.sendId) ? body.sendId : null
  if (!sendId) return { ok: false, error: 'Bad request' }
  const printedName = typeof body.printedName === 'string' ? body.printedName.trim() : ''
  if (!printedName) return { ok: false, error: 'Type your name to sign.' }
  const png = typeof body.signaturePngBase64 === 'string' && body.signaturePngBase64.trim() ? body.signaturePngBase64.trim() : null
  const consent = body.esignConsent
  if (!consent || typeof consent !== 'object' || Array.isArray(consent) || typeof (consent as Record<string, unknown>).clauseText !== 'string') {
    return { ok: false, error: 'Tick the box to agree to sign electronically.' }
  }
  return { ok: true, sendId, printedName, png, consent: consent as Record<string, unknown> }
}

/** A press is the link's: the project is this customer's. */
export function gcPortalOwns(project: { customer_id: string | null } | null | undefined, customerId: string): boolean {
  return Boolean(project && project.customer_id && project.customer_id === customerId)
}

/** The database's refusals, which speak to the office, in the customer's words. */
export function gcPortalRefusalWords(message: string): string {
  if (/is not waiting on the customer/.test(message)) return 'That change order is already answered.'
  if (/They accepted the work on/.test(message)) return 'The work is already accepted.'
  if (/Bill every line first/.test(message)) return 'The work can be accepted once every line of it is billed.'
  if (/Keep the reason to one short line/.test(message)) return 'Keep the reason to one short line.'
  if (/Only a job we won/.test(message)) return 'That job cannot be accepted here.'
  return 'Something went wrong. Please try again, or call our office.'
}

// deno-lint-ignore no-explicit-any
type Admin = any

/** The rows for one customer's GC jobs, read as the service role. Nothing on a failed read: the statement still shows. */
export async function loadGcPortalJobs(admin: Admin, customerId: string): Promise<PortalGcJob[]> {
  try {
    const { data: projects } = await admin.from('projects').select('id, name, customer_id').eq('customer_id', customerId)
    const ids = ((projects ?? []) as GcPortalRows['projects']).map((p) => p.id)
    if (ids.length === 0) return []
    const { data: gc } = await admin.from('gc_projects').select('project_id, stage').in('project_id', ids)
    const won = ((gc ?? []) as GcPortalRows['gc']).filter((g) => WON.has(g.stage)).map((g) => g.project_id)
    if (won.length === 0) return []
    const [changeOrders, acceptances, payApps, contractSends, terms] = await Promise.all([
      admin.from('gc_change_orders').select('id, project_id, number, description, price, days, sent_on, status').in('project_id', won).eq('status', 'sent'),
      admin.from('gc_owner_acceptances').select('project_id, accepted_on, how').in('project_id', won),
      admin.from('gc_owner_pay_apps').select('project_id, number, final, work_to_date').in('project_id', won),
      admin.from('gc_owner_contract_sends').select('id, project_id, sign_by, total, worth, file_name, file_path, signed_on, signer_printed_name, created_at').in('project_id', won),
      admin
        .from('gc_projects')
        .select('project_id, owner_retainage_pct, owner_retainage_step_at_pct, owner_retainage_step_to_pct, owner_retainage_step_way, owner_late_interest_pct_per_month, owner_late_finish_per_day, owner_pay_days, owner_contract_signed_on, lost_on')
        .in('project_id', won),
    ])
    // On each job, the newest send: a link to read its file for an hour (to sign, or what they signed), and, while it is
    // unsigned, whether its price is still whole (gc_owner_contract_worth_ok), so no one signs into a refusal.
    const sends = (contractSends.data ?? []) as (NonNullable<GcPortalRows['contractSends']>[number] & { file_path: string; worth: unknown })[]
    const contractUrls: Record<string, string> = {}
    const priceChanged: string[] = []
    for (const id of won) {
      const newest = sends.filter((s) => s.project_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (!newest) continue
      const { data: signed } = await admin.storage.from('gc-owner-contracts').createSignedUrl(newest.file_path, 3600)
      if (signed?.signedUrl) contractUrls[newest.id] = signed.signedUrl
      if (!newest.signed_on) {
        const { data: whole } = await admin.rpc('gc_owner_contract_worth_ok', { p_project_id: id, p_worth: newest.worth })
        if (whole === false) priceChanged.push(newest.id)
      }
    }
    const contractNow: Record<string, number> = {}
    for (const id of won) {
      const { data } = await admin.rpc('gc_owner_contract_now', { p_project_id: id })
      if (data !== null && data !== undefined) contractNow[id] = Number(data)
    }
    return gcPortalJobs(
      {
        projects: (projects ?? []) as GcPortalRows['projects'],
        gc: (gc ?? []) as GcPortalRows['gc'],
        changeOrders: (changeOrders.data ?? []) as GcPortalRows['changeOrders'],
        acceptances: (acceptances.data ?? []) as GcPortalRows['acceptances'],
        payApps: (payApps.data ?? []) as GcPortalRows['payApps'],
        contractNow,
        contractSends: sends,
        terms: (terms.data ?? []) as NonNullable<GcPortalRows['terms']>,
        contractUrls,
        priceChanged,
      },
      customerId,
    )
  } catch (e) {
    console.error('loadGcPortalJobs', e)
    return []
  }
}
