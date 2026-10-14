/**
 * A run that mails through Docsmit, the pure side (the Docsmit train, PR 5a — `docs/DOCSMIT_LIEN_RUN_PLAN.md`,
 * "The run window"): which envelopes may go, what `prepare` is asked for each, the price line against the
 * balance, what a send's answer means for the envelopes, the send record a filing keeps, and the send-by
 * strip. The run window (PR 5b) wires these to the buttons; nothing here touches a network.
 */
import type { RunEnvelope } from '../jobs/runEnvelopes'
import { mailParty, mailPartyProblems, type MailParty } from './mailAddress'
import { docsmitSendType, mailEnvelopeFor, mailSendBy, mailSendIsLate, type MailEnvelopeChoice, type MailReceipt } from './mailPiece'
import { WINDOW_QR_CAPTION, mailOpenDisplay, mailShortCode, windowAddressLines } from './windowEnvelope'
import type { DocsmitSettings } from './docsmitSettings'

export type DocsmitRecipientKey = 'owner' | 'original_contractor'

/** The slice of a run envelope the rules read; the real `RunEnvelope` fits it. A combined notice (#35 PR 3) names each job's desk item in `parts`. */
export type DocsmitEnvelopeLike = Pick<RunEnvelope, 'key' | 'n' | 'label' | 'name' | 'address' | 'method' | 'tracking'> & {
  contents: ReadonlyArray<{ recipient: { key: DocsmitRecipientKey }; notice: { itemId: string; jobId: string; jobNumber: string; kind: string; label: string; parts?: ReadonlyArray<{ itemId: string }> } }>
}

/** The lien desk's instrument as a mail piece's kind. */
export function mailKindOf(instrument: string): string {
  if (instrument === 'notice_53_056') return 'lien_notice_53_056'
  if (instrument === 'retainage_53_057') return 'lien_retainage_53_057'
  return 'other'
}

export type DocsmitCandidate = {
  key: string
  n: number
  label: string
  recipient: DocsmitRecipientKey
  party: MailParty
  /** What stops this envelope, in the provider's terms; empty when it can go. */
  problems: string[]
  kind: string
  /** The one job inside, or null when the envelope holds several (a GC's envelope, a combined notice). */
  jobId: string | null
  jobNumber: string
  /** Every desk item inside, a combined notice's jobs each by its own. */
  itemIds: string[]
  windowLines: string[]
}

/** The envelopes a Docsmit run may carry: on certified mail, with the name and address the provider needs. Others are left out, not held. */
export function docsmitCandidates(envelopes: ReadonlyArray<DocsmitEnvelopeLike>): DocsmitCandidate[] {
  const out: DocsmitCandidate[] = []
  for (const e of envelopes) {
    if (e.method !== 'certified_mail' || e.contents.length === 0) continue
    const party = mailParty(e.name, e.address)
    const first = e.contents[0]!
    const jobs = new Set(e.contents.map((c) => c.notice.jobId))
    out.push({
      key: e.key,
      n: e.n,
      label: e.label,
      recipient: first.recipient.key,
      party,
      problems: mailPartyProblems(party),
      kind: mailKindOf(first.notice.kind),
      jobId: jobs.size === 1 ? first.notice.jobId : null,
      jobNumber: first.notice.jobNumber,
      itemIds: [...new Set(e.contents.flatMap((c) => (c.notice.parts?.length ? c.notice.parts.map((p) => p.itemId) : [c.notice.itemId])))],
      windowLines: windowAddressLines({ name: party.firstName ? `${party.firstName} ${party.lastName}`.trim() : '', organization: party.organization, address1: party.address1, address2: party.address2, city: party.city, state: party.state, postalCode: party.postalCode }),
    })
  }
  return out
}

/**
 * The run's door: shown unless paused; enabled when at least one envelope can go. The candidates are the envelopes
 * that go out (v2.5535): one the run holds back (unsigned, $0, no address) is never among them. `held` counts the
 * certified ones it holds, so the door's reason names them instead of saying nothing is certified.
 */
export function docsmitRunDoor(settings: Pick<DocsmitSettings, 'paused'>, candidates: ReadonlyArray<Pick<DocsmitCandidate, 'problems'>>, opts: { held?: number } = {}): { show: boolean; enabled: boolean; label: string; why: string } {
  const ready = candidates.filter((c) => c.problems.length === 0).length
  const held = opts.held ?? 0
  const heldWords = held > 0 ? `${held} held ${held === 1 ? 'envelope waits' : 'envelopes wait'} in the run.` : ''
  if (settings.paused) return { show: false, enabled: false, label: '', why: 'Docsmit is paused in Developer settings.' }
  if (candidates.length === 0) return { show: true, enabled: false, label: 'Mail through Docsmit', why: held > 0 ? 'Every certified envelope is held. Its card says why.' : 'No envelope in this run is on certified mail.' }
  if (ready === 0) return { show: true, enabled: false, label: 'Mail through Docsmit', why: [`Every certified envelope${held > 0 ? ' that goes out' : ''} needs ${candidates[0]!.problems.join(', ')} first.`, heldWords].filter(Boolean).join(' ') }
  const problems = candidates.length - ready
  return { show: true, enabled: true, label: `Mail through Docsmit · ${ready} envelope${ready === 1 ? '' : 's'}`, why: [problems > 0 ? `${problems} ${problems === 1 ? 'envelope with a problem stays' : 'envelopes with a problem stay'} on paper.` : '', heldWords].filter(Boolean).join(' ') }
}

/**
 * What `prepare` is asked for one envelope, with the code the owner's QR carries and the envelope the page count takes.
 * `source_ids` are the envelope's desk items unless filings are given (v2.5532): a run's piece names its notices from
 * the start, so a send is the desk's the moment it goes, and the run's record adds the filings beside them.
 */
export type DocsmitPrepareDraft = {
  key: string
  shortCode: string
  envelope: MailEnvelopeChoice
  piece: {
    kind: string
    source_ids: string[]
    job_id: string | null
    recipient: DocsmitRecipientKey
    short_code: string
    name: string
    organization: string
    address1: string
    address2: string
    city: string
    state: string
    postal_code: string
    send_type: string
    envelope: '#10' | 'Flat' | null
    sheets: number
  }
}

export function docsmitPrepareDraft(c: DocsmitCandidate, pages: number, opts: { receipt: MailReceipt; filingIds?: string[]; shortCode?: string; random?: () => number }): DocsmitPrepareDraft {
  const shortCode = opts.shortCode ?? mailShortCode(opts.random)
  const envelope = mailEnvelopeFor(pages)
  return {
    key: c.key,
    shortCode,
    envelope,
    piece: {
      kind: c.kind,
      source_ids: opts.filingIds ?? c.itemIds,
      job_id: c.jobId,
      recipient: c.recipient,
      short_code: shortCode,
      name: c.party.firstName ? `${c.party.firstName} ${c.party.lastName}`.trim() : '',
      organization: c.party.organization,
      address1: c.party.address1,
      address2: c.party.address2,
      city: c.party.city,
      state: c.party.state,
      postal_code: c.party.postalCode,
      send_type: docsmitSendType(opts.receipt),
      envelope: envelope.envelope,
      sheets: envelope.sheets,
    },
  }
}

/** The owner's cover letter's window and code, as `CoverPageInput.window` takes them (PR 4). */
export function docsmitCoverWindow(c: DocsmitCandidate, payUrl: string | null, shortCode: string, qr: { png: string | null; svg: string | null }): { lines: string[]; qr: { png: string | null; svg: string | null; display: string; caption: string } | null } {
  return { lines: c.windowLines, qr: payUrl ? { png: qr.png, svg: qr.svg, display: mailOpenDisplay(payUrl, shortCode), caption: WINDOW_QR_CAPTION } : null }
}

export type DocsmitPrepared = { key: string; pieceId: string; price: number | null; correction: string | null; sheets: number; envelope: '#10' | 'Flat' | null }

const money = (n: number) => `$${n.toFixed(2)}`

/** The price line: the envelopes, the total, the balance; short when the balance will not cover it; low when what is left is under the warning. */
export function docsmitPriceWords(prepared: ReadonlyArray<DocsmitPrepared>, balance: number | null, warn: number): { total: number; priced: number; words: string; short: boolean; low: boolean } {
  const priced = prepared.filter((p) => p.price != null)
  const total = priced.reduce((s, p) => s + (p.price as number), 0)
  const count = prepared.length
  const head = `${count} envelope${count === 1 ? '' : 's'} · ${money(total)}${priced.length < count ? ` (${count - priced.length} not priced yet)` : ''}`
  if (balance == null) return { total, priced: priced.length, words: `${head} · balance unknown`, short: false, low: false }
  const left = balance - total
  if (left < 0) return { total, priced: priced.length, words: `${head} · balance ${money(balance)} · Docsmit credit is short by ${money(-left)}`, short: true, low: true }
  return { total, priced: priced.length, words: `${head} · balance ${money(balance)}${left < warn ? ` · ${money(left)} left after, add credit soon` : ''}`, short: false, low: left < warn }
}

export type DocsmitSendAnswer = { ok: boolean; sent: string[]; skipped?: Array<{ id: string; why: string }>; stopped_at?: string; shortfall?: number; error?: string }

/** What a send's answer means for the envelopes: which mailed, which stayed, and one line for the foot. */
export function docsmitSendOutcome(answer: DocsmitSendAnswer, prepared: ReadonlyArray<Pick<DocsmitPrepared, 'key' | 'pieceId'>>): { mailedKeys: string[]; heldKeys: string[]; words: string } {
  const keyOf = (pieceId: string) => prepared.find((p) => p.pieceId === pieceId)?.key ?? null
  const mailedKeys = answer.sent.map(keyOf).filter((k): k is string => !!k)
  const heldKeys = prepared.map((p) => p.key).filter((k) => !mailedKeys.includes(k))
  const n = mailedKeys.length
  const mailed = n === 0 ? 'Nothing mailed' : `${n} envelope${n === 1 ? '' : 's'} mailed through Docsmit`
  if (answer.ok) return { mailedKeys, heldKeys, words: `${mailed}.` }
  const stopped = answer.stopped_at ? keyOf(answer.stopped_at) : null
  const at = stopped ? ` at envelope ${prepared.findIndex((p) => p.key === stopped) + 1}` : ''
  const why = answer.shortfall != null ? `Docsmit credit is short by ${money(answer.shortfall)}${at}; nothing more was sent.` : (answer.error ?? 'Docsmit refused one envelope; nothing more was sent.')
  return { mailedKeys, heldKeys, words: `${mailed}. ${why} The rest stay on paper.` }
}

/** The send a filing keeps for a Docsmit envelope: the provider and the piece, and the number once it is known. */
export function docsmitSendRecord(pieceId: string, tracking: string | null): { tracking: string; via: 'docsmit'; piece_id: string } {
  return { tracking: (tracking ?? '').trim(), via: 'docsmit', piece_id: pieceId }
}

/** The strip over a run with a window: send to Docsmit by the day and the cutoff, or the month mails late. Null with no window. */
export function docsmitSendByStrip(windowLastYmd: string | null, s: Pick<DocsmitSettings, 'cutoffLocal' | 'sendByBufferDays'>, now: { ymd: string; local: string }): { words: string; late: boolean; ymd: string } | null {
  if (!windowLastYmd) return null
  const by = mailSendBy(windowLastYmd, { bufferBusinessDays: s.sendByBufferDays, cutoffLocal: s.cutoffLocal })
  const late = mailSendIsLate(now.ymd, now.local, by)
  return { words: late ? `Past Docsmit's cutoff for ${windowLastYmd}: this month mails late. ${by.words} was the last call.` : by.words, late, ymd: by.ymd }
}
