/**
 * Records for an owner (v2.4544, pure). An owner whose GC has not paid us asks for our
 * records on their property. The desk answers with one packet per property, behind four
 * checks: their request in writing, our contract with the GC read for a clause that stops
 * it, the numbers agreeing with the notices already mailed, and their signed acknowledgment.
 *
 * The packet is that property and nothing else: each job there, each bill, each payment
 * with the day it was paid and when it was recorded, and what is still owed. Other owners'
 * jobs, what the GC paid on other properties, check images and our own notes stay out.
 *
 * Counsel approved the cover note and the acknowledgment on 2026-10-06 (v2.4627); the draft
 * stamp and the ask-before-print went with that.
 */

export type OwnerRecordsHow = 'email' | 'letter' | 'text' | 'portal'
export type OwnerRecordsSentHow = 'handed' | 'email' | 'mail' | 'portal'

export const OWNER_RECORDS_HOW_WORDS: Record<OwnerRecordsHow, string> = { email: 'Email', letter: 'Letter', text: 'Text message', portal: 'On their portal' }
export const OWNER_RECORDS_SENT_HOW_WORDS: Record<OwnerRecordsSentHow, string> = { handed: 'Handed to them', email: 'Emailed', mail: 'Mailed', portal: 'On their portal' }

/** The ways the window offers: *On their portal* only once the records were offered there (punch list #86). */
export function ownerRecordsSentHows(file: Pick<OwnerRecordsFile, 'offer'>): OwnerRecordsSentHow[] {
  return (Object.keys(OWNER_RECORDS_SENT_HOW_WORDS) as OwnerRecordsSentHow[]).filter((k) => k !== 'portal' || file.offer != null)
}

/** What the desk keeps about one owner's request: the `file` of its `lien_owner_record_requests` row. */
export type OwnerRecordsFile = {
  request: { on: string; how: OwnerRecordsHow; from: string; link: string } | null
  /** Our contract with the GC was read and no clause stops this: the leader's tick, kept per GC. */
  contractChecked: { by: string; at: string } | null
  /**
   * Signed on paper (a link to the copy), or on their portal (punch list #86): the name they typed,
   * how they signed, the ink's path in the sent-documents bucket when drawn, and the consent instant.
   */
  acknowledgment: { signedOn: string; link: string; printedName?: string; mode?: 'type' | 'draw'; signaturePath?: string; consentedAt?: string } | null
  /** Offered on their portal (punch list #86): when, by whom, and a second name allowed to sign (a spouse, a manager). */
  offer: { at: string; by: string; alsoAllowed: string } | null
  sent: { at: string; by: string; how: OwnerRecordsSentHow; total: number; jobIds: string[] } | null
}

export const EMPTY_OWNER_RECORDS: OwnerRecordsFile = { request: null, contractChecked: null, acknowledgment: null, offer: null, sent: null }

/** Every name the portal accepts, letter for letter: the roll's owner and the office's second name. */
export function ownerRecordsAllowedNames(ownerName: string, file: Pick<OwnerRecordsFile, 'offer'>): string[] {
  return [ownerName, file.offer?.alsoAllowed ?? ''].map((n) => n.trim()).filter(Boolean)
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The stored file, read defensively: a part that does not parse is absent, never half there. */
export function parseOwnerRecords(raw: unknown): OwnerRecordsFile | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const rq = o.request as Record<string, unknown> | null | undefined
  const cc = o.contractChecked as Record<string, unknown> | null | undefined
  const ak = o.acknowledgment as Record<string, unknown> | null | undefined
  const st = o.sent as Record<string, unknown> | null | undefined
  const of = o.offer as Record<string, unknown> | null | undefined
  const how = (v: unknown): OwnerRecordsHow => (v === 'letter' || v === 'text' || v === 'portal' ? v : 'email')
  const sentHow = (v: unknown): OwnerRecordsSentHow => (v === 'email' || v === 'mail' || v === 'portal' ? v : 'handed')
  const file: OwnerRecordsFile = {
    request: rq && YMD.test(str(rq.on)) ? { on: str(rq.on), how: how(rq.how), from: str(rq.from), link: str(rq.link) } : null,
    contractChecked: cc && str(cc.at) ? { by: str(cc.by), at: str(cc.at) } : null,
    acknowledgment:
      ak && YMD.test(str(ak.signedOn))
        ? {
            signedOn: str(ak.signedOn),
            link: str(ak.link),
            ...(str(ak.printedName) ? { printedName: str(ak.printedName) } : {}),
            ...(ak.mode === 'type' || ak.mode === 'draw' ? { mode: ak.mode } : {}),
            ...(str(ak.signaturePath) ? { signaturePath: str(ak.signaturePath) } : {}),
            ...(str(ak.consentedAt) ? { consentedAt: str(ak.consentedAt) } : {}),
          }
        : null,
    offer: of && str(of.at) ? { at: str(of.at), by: str(of.by), alsoAllowed: str(of.alsoAllowed) } : null,
    sent:
      st && str(st.at)
        ? { at: str(st.at), by: str(st.by), how: sentHow(st.how), total: typeof st.total === 'number' && Number.isFinite(st.total) ? st.total : 0, jobIds: Array.isArray(st.jobIds) ? st.jobIds.filter((x): x is string => typeof x === 'string') : [] }
        : null,
  }
  return file.request || file.contractChecked || file.acknowledgment || file.offer || file.sent ? file : null
}

// ---------- the packet ----------

export type OwnerPacketBillInput = { id: string; amount: number; status: string; billedAt: string | null; order: number }
export type OwnerPacketPaymentInput = { id: string; billId: string | null; amount: number; paidOn: string | null; recordedAt: string | null; type: string | null; reference: string | null }
export type OwnerPacketJobInput = {
  id: string
  number: string
  name: string
  address: string
  gcName: string | null
  /** The job's total: what the notice's claim is counted from. */
  total: number
  bills: OwnerPacketBillInput[]
  payments: OwnerPacketPaymentInput[]
}

export type OwnerPacketPayment = { id: string; amount: number; paidOn: string | null; recordedAt: string | null; type: string; reference: string }
export type OwnerPacketBill = { id: string; label: string; amount: number; billedOn: string | null; paid: number; open: number; payments: OwnerPacketPayment[] }
/**
 * `billed` is the bills on file. Older work may have been paid with no bill kept in the app, so
 * the statement's arithmetic is the job total less what was paid, never the total less the bills.
 */
export type OwnerPacketJob = {
  id: string
  number: string
  name: string
  address: string
  gcName: string
  total: number
  billed: number
  paid: number
  /** The job's total less everything paid: the figure a notice claims. */
  owed: number
  bills: OwnerPacketBill[]
  /** Payments on the job that name no bill. */
  loosePayments: OwnerPacketPayment[]
}
export type OwnerPacket = { jobs: OwnerPacketJob[]; total: number; billed: number; paid: number; owed: number; payments: number }

const cents = (n: number): number => Math.round(n * 100) / 100
const byWhen = (a: OwnerPacketPayment, b: OwnerPacketPayment): number => (a.paidOn ?? '').localeCompare(b.paidOn ?? '') || (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '')
const payment = (p: OwnerPacketPaymentInput): OwnerPacketPayment => ({ id: p.id, amount: cents(p.amount), paidOn: p.paidOn && YMD.test(p.paidOn) ? p.paidOn : null, recordedAt: p.recordedAt, type: (p.type ?? '').trim(), reference: (p.reference ?? '').trim() })

/**
 * The statement. A bill is one that went out (billed or paid); a draft is not a bill yet.
 * A payment sits under the bill it names, oldest first; one that names no bill is listed
 * on its job. Jobs read biggest owed first, then by number.
 */
export function buildOwnerPacket(jobs: ReadonlyArray<OwnerPacketJobInput>): OwnerPacket {
  const out: OwnerPacketJob[] = jobs.map((j) => {
    const sent = [...j.bills].filter((b) => b.status === 'billed' || b.status === 'paid').sort((a, b) => a.order - b.order || (a.billedAt ?? '').localeCompare(b.billedAt ?? ''))
    const sentIds = new Set(sent.map((b) => b.id))
    const bills: OwnerPacketBill[] = sent.map((b, i) => {
      const pays = j.payments.filter((p) => p.billId === b.id).map(payment).sort(byWhen)
      const paid = cents(pays.reduce((s, p) => s + p.amount, 0))
      return { id: b.id, label: `Bill ${i + 1}`, amount: cents(b.amount), billedOn: b.billedAt ? b.billedAt.slice(0, 10) : null, paid, open: cents(Math.max(0, b.amount - paid)), payments: pays }
    })
    const loosePayments = j.payments.filter((p) => !p.billId || !sentIds.has(p.billId)).map(payment).sort(byWhen)
    const paid = cents(j.payments.reduce((s, p) => s + p.amount, 0))
    const billed = cents(bills.reduce((s, b) => s + b.amount, 0))
    return {
      id: j.id,
      number: j.number,
      name: j.name,
      address: j.address,
      gcName: (j.gcName ?? '').trim(),
      total: cents(j.total),
      billed,
      paid,
      owed: cents(Math.max(0, j.total - paid)),
      bills,
      loosePayments,
    }
  })
  out.sort((a, b) => b.owed - a.owed || a.number.localeCompare(b.number, undefined, { numeric: true }))
  const sum = (pick: (j: OwnerPacketJob) => number) => cents(out.reduce((s, j) => s + pick(j), 0))
  return { jobs: out, total: sum((j) => j.total), billed: sum((j) => j.billed), paid: sum((j) => j.paid), owed: sum((j) => j.owed), payments: out.reduce((n, j) => n + j.loosePayments.length + j.bills.reduce((m, b) => m + b.payments.length, 0), 0) }
}

// ---------- check 3: the numbers agree ----------

export type OwnerPacketNumbers = { agree: boolean; lines: string[] }

/**
 * The statement against the notices already drawn up. `claims` is each job's notice claim, or
 * null when the job has no notice. A job whose notice claims what the statement shows agrees;
 * a job with money owed and no notice, or a claim that differs, is said in one line each.
 */
export function ownerPacketNumbers(packet: OwnerPacket, claims: Readonly<Record<string, number | null | undefined>>, money: (n: number) => string): OwnerPacketNumbers {
  const lines: string[] = []
  let matched = 0
  let matchedTotal = 0
  const off: string[] = []
  const bare: string[] = []
  for (const j of packet.jobs) {
    const claim = claims[j.id]
    if (claim == null) {
      if (j.owed > 0.005) bare.push(`${money(j.owed)} on job ${j.number} has no notice.`)
      continue
    }
    if (Math.abs(claim - j.owed) <= 0.5) {
      matched += 1
      matchedTotal += j.owed
    } else off.push(`Job ${j.number}: the notice claims ${money(claim)}. The statement shows ${money(j.owed)}.`)
  }
  if (matched > 0) lines.push(`${money(matchedTotal)} matches ${matched === 1 ? 'the notice' : `the ${matched} notices`}.`)
  lines.push(...off, ...bare)
  if (lines.length === 0) lines.push('No job here has a notice yet.')
  return { agree: off.length === 0 && bare.length === 0 && matched > 0, lines }
}

// ---------- the four checks ----------

export type OwnerRecordsStepKey = 'request' | 'contract' | 'numbers' | 'acknowledgment'
export type OwnerRecordsStep = { key: OwnerRecordsStepKey; n: 1 | 2 | 3 | 4; title: string; state: 'done' | 'todo' | 'warn'; words: string }

export function ownerRecordsSteps(file: OwnerRecordsFile, numbers: OwnerPacketNumbers, day: (ymd: string) => string): OwnerRecordsStep[] {
  const rq = file.request
  const cc = file.contractChecked
  const ak = file.acknowledgment
  return [
    {
      key: 'request',
      n: 1,
      title: 'Their request, in writing',
      state: rq ? 'done' : 'todo',
      words: rq ? `${OWNER_RECORDS_HOW_WORDS[rq.how]}${rq.from.trim() ? ` from ${rq.from.trim()}` : ''}, ${day(rq.on)}. ${rq.how === 'portal' ? 'Their signing is the request.' : rq.link.trim() ? 'Link on file.' : 'No link on file.'}` : file.offer ? `Offered on their portal ${day(file.offer.at.slice(0, 10))}. Waiting for them to sign.` : 'Not on file yet. Ask them to put it in an email or a letter.',
    },
    {
      key: 'contract',
      n: 2,
      title: 'Our contract with the GC',
      state: cc ? 'done' : 'todo',
      words: cc ? `Checked ${day(cc.at.slice(0, 10))}${cc.by.trim() ? ` by ${cc.by.trim()}` : ''}. No clause stops this.` : 'Not checked yet. The leader reads it for a clause that stops us sharing records.',
    },
    { key: 'numbers', n: 3, title: 'The numbers agree', state: numbers.agree ? 'done' : 'warn', words: numbers.lines.join(' ') },
    {
      key: 'acknowledgment',
      n: 4,
      title: 'Their acknowledgment',
      state: ak ? 'done' : 'todo',
      words: ak ? (ak.printedName ? `Signed on their portal ${day(ak.signedOn)} by ${ak.printedName}${ak.mode === 'draw' ? ', drawn' : ', typed'}.` : `Signed ${day(ak.signedOn)}. ${ak.link.trim() ? 'Copy on file.' : 'No copy linked.'}`) : file.offer ? 'Not signed yet. They sign on their portal.' : 'Not signed yet. Print it for them to sign.',
    },
  ]
}

/** What still stops Record it as sent: the request, the contract check and the signed acknowledgment. The numbers warn; they do not block. */
export function ownerRecordsMissing(file: OwnerRecordsFile): string[] {
  const missing: string[] = []
  if (!file.request) missing.push('their request in writing')
  if (!file.contractChecked) missing.push('the contract check')
  if (!file.acknowledgment) missing.push('their signed acknowledgment')
  return missing
}

/** The footer's one line: what is missing, or that it can go. */
export function ownerRecordsFootWords(file: OwnerRecordsFile, day: (ymd: string) => string): string {
  if (file.sent) return `Sent ${day(file.sent.at.slice(0, 10))}${file.sent.by.trim() ? ` by ${file.sent.by.trim()}` : ''}. ${OWNER_RECORDS_SENT_HOW_WORDS[file.sent.how]}.`
  const missing = ownerRecordsMissing(file)
  if (missing.length === 0) return 'All three are on file. The packet can go.'
  return `Before it can be recorded as sent: ${missing.join(', ')}.`
}

/** What the packet leaves out, said on screen so nobody adds it by hand. */
export const OWNER_RECORDS_LEFT_OUT: ReadonlyArray<string> = ["Other owners' jobs and addresses", 'What the GC paid on other properties', 'Check images and bank details', 'Our own notes on the job']

// ---------- the pickers ----------

export type OwnerRecordsPropertyRow = { key: string; seedJobId: string; owner: string; address: string; gcName: string; jobs: number; open: number; /** Another row has this address: two customer records may be one owner. */ sharesAddress?: boolean }

/**
 * The properties an owner can ask about: the jobs with a lien record, folded by property and
 * owner. `sameProperty` is the desk's own test for two jobs at one property.
 */
export function ownerRecordsProperties<J extends { jobId: string; owner: string; address: string; addressId: string | null; gcName: string; open: number; customerId: string | null }>(
  jobs: ReadonlyArray<J>,
  sameProperty: (a: J, b: J) => boolean,
): OwnerRecordsPropertyRow[] {
  const groups: Array<{ head: J; all: J[] }> = []
  for (const j of jobs) {
    const g = groups.find((x) => x.head.customerId === j.customerId && sameProperty(x.head, j))
    if (g) g.all.push(j)
    else groups.push({ head: j, all: [j] })
  }
  const rows = groups.map((g) => ({
    key: g.head.jobId,
    seedJobId: g.head.jobId,
    owner: g.head.owner.trim() || 'Owner not on file',
    address: g.head.address.trim(),
    gcName: g.head.gcName.trim(),
    jobs: g.all.length,
    open: cents(g.all.reduce((s, j) => s + j.open, 0)),
    // The same property under a second customer record is kept apart (it may be a different owner), and said.
    sharesAddress: groups.some((x) => x !== g && sameProperty(x.head, g.head)),
  }))
  return rows.sort((a, b) => a.owner.localeCompare(b.owner) || a.address.localeCompare(b.address))
}

export function ownerRecordsPropertyMatches(row: OwnerRecordsPropertyRow, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  const hay = `${row.owner} ${row.address} ${row.gcName}`.toLowerCase()
  return q.split(/\s+/).every((t) => hay.includes(t))
}
