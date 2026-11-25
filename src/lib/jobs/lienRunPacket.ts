/**
 * The notices' packet as the run window prints it, built with no window (punch list #362, step 6).
 *
 * The run window's one print (`printPacket('ready')` in `LienDeskRunModal`, v2.7477) prints the ready notices, each
 * whole, in envelope order, behind the sheet that lists in red what stayed out. Everything it reads to do that is on the
 * desk but for the enclosures (`useLienRunEnclosures`), so the same packet can be built here from the same kernels:
 * the checklist's one print stacks it in front of the affidavits.
 *
 * It must be the same paper. `LienDeskRunModal.packetParity.render.test.tsx` prints from the window and from here with
 * the same notices and compares the two documents whole, so a change to one that the other does not follow fails.
 *
 * What the window can do that this does not: *Combine the jobs at one property* (a tick under More, off when the
 * window opens), a paper printed in this sitting, and a copy sent through Docsmit in this sitting. This builds the
 * packet the window prints when it has just opened.
 *
 * Pure: notices and enclosures in, the document and what printing it stamps out. No paper's words are written here.
 */
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { filingDocHtml } from '../jobsDocuments/lienFilingDocuments'
import { noticesFullyPrinted, recipientViaDocsmit, runCopyKey, runPacketHtml, runPayPageBlocks, type RunNotice, type RunPayPages } from './lienDeskRun'
import { combineNoticesByProperty, type CombinedRunNotice } from './lienNoticeCombine'
import type { PayPageAssets, PayPageRow } from './lienNoticePayPage'
import { lienRunChecklistRows } from './lienRunChecklist'
import { runEnvelopeHold, runMailing } from './lienRunPaper'
import { lienRunParts, type LienRunPartKey } from './lienRunParts'
import { noticeInvoicePrintSections, type NoticeInvoiceDoc } from './noticeInvoiceEnclosure'
import { lienNoticesPrintSnapshot } from './lienPrintSworn'
import { runEnvelopes, type RunEnvelope } from './runEnvelopes'

/** A job's pay page: its rows, and the codes drawn for the ones that can be paid. */
export type LienRunPay = { rows: PayPageRow[]; assets: PayPageAssets }

/** What the notices enclose, by job, as `useLienRunEnclosures` reads it. */
export type LienRunEnclosureData = {
  invoiceDocsByJob: Readonly<Record<string, NoticeInvoiceDoc[]>>
  payByJob: Readonly<Record<string, LienRunPay>>
}

/** Which of the run's three stacks a notice's envelopes sit in, by its part: what prints now, what printed, what is stopped. */
export const lienRunStackOf = (part: LienRunPartKey | undefined): 'ready' | 'printed' | 'rest' => (part === 'ready' ? 'ready' : part === 'owe' || part === 'record' ? 'printed' : 'rest')

const partsOf = (n: CombinedRunNotice) => (n.parts && n.parts.length > 1 ? n.parts : null)

/** The enclosed bills by the notice that prints them: a combined notice carries every part's under the lead job's id. */
export function lienRunInvoiceDocsShown(shown: ReadonlyArray<CombinedRunNotice>, invoiceDocsByJob: Readonly<Record<string, NoticeInvoiceDoc[]>>): Record<string, NoticeInvoiceDoc[]> {
  const out: Record<string, NoticeInvoiceDoc[]> = { ...invoiceDocsByJob }
  for (const n of shown) {
    const parts = partsOf(n)
    if (parts) out[n.jobId] = parts.flatMap((p) => invoiceDocsByJob[p.jobId] ?? [])
  }
  return out
}

/** The pay page a job and a copy print, as HTML for the packet. */
export function lienRunPayPages(shown: ReadonlyArray<CombinedRunNotice>, payByJob: Readonly<Record<string, LienRunPay>>, issuerPhone: string): RunPayPages {
  const out: Record<string, Partial<Record<'owner' | 'original_contractor', string>>> = {}
  for (const n of shown) {
    const parts = partsOf(n)
    const p = parts ? { rows: parts.flatMap((x) => payByJob[x.jobId]?.rows ?? []), assets: Object.assign({}, ...parts.map((x) => payByJob[x.jobId]?.assets ?? {})) as PayPageAssets } : payByJob[n.jobId]
    if (!p || p.rows.length === 0) continue
    for (const r of n.recipients) {
      const blocks = runPayPageBlocks(n, r, p.rows, p.assets, issuerPhone)
      if (blocks.length) (out[n.jobId] ??= {})[r.key] = filingDocHtml(blocks)
    }
  }
  return out
}

export type LienRunReadyPacket = {
  /** The notices the packet prints, on paper: the ready ones, less any copy that goes by Docsmit. */
  notices: CombinedRunNotice[]
  /** The whole print document. */
  html: string
  /** How the print is filed as a sent copy: one packet on every job in it, with what each notice said (step 7). */
  filing: { kind: 'lien_notice_packet'; title: string; jobIds: string[]; sourceSnapshot: Record<string, unknown> }
  /** The copies the packet printed, `runCopyKey` each. */
  copyKeys: string[]
  /** The desk items whose every copy printed: what the print stamps printed. */
  stampIds: string[]
  /** The envelopes that stayed out, each with its reason: the sheet lists them in red. */
  held: Array<{ env: RunEnvelope; why: string }>
}

export type LienRunReadyPacketInput = {
  /** The run's notices, as the desk hands them to the run window. */
  notices: ReadonlyArray<RunNotice>
  todayYmd: string
  issuer: PhysicalInvoiceIssuer | null
  enclosures: LienRunEnclosureData
  /** The code on the first page that opens the run's guide, as the caller draws it. */
  guideCode?: string
}

/** The notices the packet prints and the envelopes it leaves out, as the window sorts them. No document is built. */
function readySelection(notices: ReadonlyArray<RunNotice>): { shown: CombinedRunNotice[]; ns: CombinedRunNotice[]; held: Array<{ env: RunEnvelope; why: string }> } {
  const shown = combineNoticesByProperty(notices, { combine: false })
  const rows = lienRunChecklistRows({ notices: [...notices], printedNow: new Map() })
  const together = shown.flatMap((n) => (n.parts && n.parts.length > 1 ? [n.parts.map((p) => p.itemId)] : []))
  const partOf = lienRunParts(rows, [], { together }).partOf

  // The envelopes in three stacks, as the window lists them: what prints now, what printed, and what is stopped,
  // each stopped one held with its reason and never printed by the packet.
  const stack = (which: 'ready' | 'printed' | 'rest') => runEnvelopes(shown.filter((n) => lienRunStackOf(partOf.get(n.itemId)) === which)).map((env) => ({ ...env, key: `${which}:${env.key}` }))
  const going = runMailing([...stack('ready'), ...stack('printed')])
  const heldOf = new Map(rows.map((r) => [r.itemId, r.held]))
  const stopped = stack('rest').map((env) => {
    const notice = env.contents.map((c) => heldOf.get(c.notice.itemId)).find(Boolean)
    return { env, why: runEnvelopeHold(env) ?? (notice ? `With its notice: ${notice}` : 'Its notice is not ready to print.') }
  })
  const held = [...going.held, ...stopped].map((h, i) => ({ env: { ...h.env, n: going.mailed.length + i + 1 }, why: h.why }))

  const paperShown = shown.map((n) => ({ ...n, recipients: n.recipients.filter((r) => !recipientViaDocsmit(r)) })).filter((n) => n.recipients.length > 0)
  return { shown, ns: paperShown.filter((n) => lienRunStackOf(partOf.get(n.itemId)) === 'ready'), held }
}

/** The notices the packet would print, in the packet's order: its count before any document is built. */
export function lienRunReadyNotices(notices: ReadonlyArray<RunNotice>): CombinedRunNotice[] {
  return readySelection(notices).ns
}

/** The packet of the ready notices, or null when no notice is ready to print on paper. */
export function lienRunReadyPacket(input: LienRunReadyPacketInput): LienRunReadyPacket | null {
  const { notices, todayYmd, issuer, enclosures, guideCode } = input
  const { shown, ns, held } = readySelection(notices)
  if (ns.length === 0) return null

  const docsShown = lienRunInvoiceDocsShown(shown, enclosures.invoiceDocsByJob)
  const invoiceSectionsByJob = Object.fromEntries(Object.entries(docsShown).map(([id, docs]) => [id, noticeInvoicePrintSections(docs)]))
  const payPagesByJob = lienRunPayPages(shown, enclosures.payByJob, (issuer?.phone ?? '').trim())

  const jobIds = ns.flatMap((n) => (partsOf(n) ?? [{ jobId: n.jobId }]).map((p) => p.jobId))
  const partsIds = (n: CombinedRunNotice) => partsOf(n) ?? [{ itemId: n.itemId, jobId: n.jobId }]
  const copyKeys = runMailing(runEnvelopes(ns)).mailed.flatMap((env) => env.contents.flatMap((c) => partsIds(c.notice as CombinedRunNotice).map((p) => runCopyKey(p.itemId, c.recipient.key))))
  return {
    notices: ns,
    html: runPacketHtml(ns, todayYmd, issuer, invoiceSectionsByJob, payPagesByJob, guideCode, held),
    filing: { kind: 'lien_notice_packet', title: ns.length === 1 ? '§ 53.056 notice packet' : `§ 53.056 notice packet · ${ns.length} notices`, jobIds, sourceSnapshot: lienNoticesPrintSnapshot(ns) },
    copyKeys,
    stampIds: noticesFullyPrinted(notices, new Set(copyKeys)).map((n) => n.itemId),
    held,
  }
}
