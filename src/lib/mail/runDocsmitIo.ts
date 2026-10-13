/**
 * A run that mails through Docsmit, the doing side (the Docsmit train, PR 5b — `docs/DOCSMIT_LIEN_RUN_PLAN.md`,
 * "The run window"): each certified envelope's PDF (the owner's copy with the window block and the code), the copy
 * in the bucket, `prepare` at the function (CASS, the message, the upload, the price), then `send`. The pure rules
 * are `runDocsmit.ts`; this file is the only one that reaches the bucket and the function, and it never throws:
 * an envelope that cannot go is held with its reason and the rest carry on.
 */
import { supabase } from '../supabase'
import type { RunEnvelope } from '../jobs/runEnvelopes'
import type { CombinedRunNotice } from '../jobs/lienNoticeCombine'
import type { RunRecipient } from '../jobs/lienDeskRun'
import { buildRunNoticePdf } from '../jobs/lienDeskRunIo'
import { mergePdfBlobs, pdfPageCount } from '../jobsDocuments/demandLetterPacket'
import { LIEN_RELEASE_DOCUMENTS_BUCKET } from '../jobs/lienReleaseDocuments'
import type { FilingDocBlock } from '../jobsDocuments/lienFilingDocuments'
import type { NoticeInvoiceDoc } from '../jobs/noticeInvoiceEnclosure'
import type { PayPageRow } from '../jobs/lienNoticePayPage'
import { payLinkUrl } from '../billing/payLink'
import { loadBrandMarkDataUrl, payQrSvgMarkup, svgMarkupToPngDataUrl } from '../billing/payQr'
import type { MailReceipt } from './mailPiece'
import { docsmitCandidates, docsmitCoverWindow, docsmitPrepareDraft, type DocsmitCandidate, type DocsmitPrepared, type DocsmitSendAnswer } from './runDocsmit'
import { mailOpenUrl, mailShortCode } from './windowEnvelope'

export type DocsmitPreparedEnvelope = DocsmitPrepared & {
  n: number
  label: string
  /** The company or the person the envelope is to. */
  who: string
  windowLines: string[]
  sendType: string
  shortCode: string
  recipient: DocsmitCandidate['recipient']
  jobNumber: string
  itemIds: string[]
  /** The PDF as the provider holds it, for the review: an object URL the window revokes when it closes. */
  pdfUrl: string
  pdfPath: string
}

export type DocsmitHeld = { key: string; n: number; label: string; why: string }

export type DocsmitPrepareOutcome = { prepared: DocsmitPreparedEnvelope[]; held: DocsmitHeld[]; balance: number | null }

export type DocsmitPrepareContext = {
  receipt: MailReceipt
  invoiceDocsByJob: Readonly<Record<string, readonly NoticeInvoiceDoc[]>>
  payBlocksByJob: Readonly<Record<string, Partial<Record<'owner' | 'original_contractor', readonly FilingDocBlock[]>>>>
  payRowsByJob: Readonly<Record<string, readonly PayPageRow[]>>
  /** Stand-ins for tests; the real ones reach the bucket, the function and the QR drawer. */
  io?: Partial<DocsmitIo>
}

export type DocsmitIo = {
  buildPdf: typeof buildRunNoticePdf
  merge: (blobs: readonly Blob[]) => Promise<Blob>
  pages: (blob: Blob) => Promise<number>
  qrPng: (url: string) => Promise<string | null>
  upload: (path: string, blob: Blob) => Promise<string | null>
  invoke: (body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  objectUrl: (blob: Blob) => string
  shortCode: () => string
}

const realIo: DocsmitIo = {
  buildPdf: buildRunNoticePdf,
  merge: (blobs) => mergePdfBlobs(blobs),
  pages: (blob) => pdfPageCount(blob),
  qrPng: async (url) => {
    try {
      return await svgMarkupToPngDataUrl(await payQrSvgMarkup(url, 240, await loadBrandMarkDataUrl()), 240)
    } catch {
      return null
    }
  },
  upload: async (path, blob) => {
    const { error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).upload(path, blob, { contentType: 'application/pdf', upsert: true })
    return error ? error.message : null
  },
  invoke: async (body) => {
    const { data, error } = await supabase.functions.invoke('mail-send-docsmit', { body })
    return { data, error }
  },
  objectUrl: (blob) => URL.createObjectURL(blob),
  shortCode: () => mailShortCode(),
}

function answerError(data: unknown, error: unknown, fallback: string): string {
  const d = data as { error?: unknown; correction?: unknown } | null
  if (d && typeof d.error === 'string' && d.error) return typeof d.correction === 'string' && d.correction ? `${d.error} ${d.correction}` : d.error
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') return (error as { message: string }).message
  return fallback
}

/** The bill the owner's code opens: the first payable bill on the job, or none. */
export function docsmitPayUrl(rows: readonly PayPageRow[] | undefined): string | null {
  const row = (rows ?? []).find((r) => r.payable)
  return row ? payLinkUrl(row.invoiceId) : null
}

/** Every certified envelope, prepared at Docsmit or held with its reason. The window lists both before anything mails. */
export async function prepareDocsmitRun(envelopes: ReadonlyArray<RunEnvelope>, ctx: DocsmitPrepareContext): Promise<DocsmitPrepareOutcome> {
  const io: DocsmitIo = { ...realIo, ...(ctx.io ?? {}) }
  const out: DocsmitPrepareOutcome = { prepared: [], held: [], balance: null }
  const byKey = new Map(envelopes.map((e) => [e.key, e] as const))
  for (const c of docsmitCandidates(envelopes)) {
    const env = byKey.get(c.key)!
    if (c.problems.length > 0) {
      out.held.push({ key: c.key, n: c.n, label: c.label, why: `The address needs ${c.problems.join(', ')}.` })
      continue
    }
    try {
      const shortCode = io.shortCode()
      const ownerJob = env.contents.find((x) => x.recipient.key === 'owner')?.notice.jobId ?? null
      const payUrl = c.recipient === 'owner' && ownerJob ? docsmitPayUrl(ctx.payRowsByJob[ownerJob]) : null
      const png = payUrl ? await io.qrPng(mailOpenUrl(payUrl, shortCode)) : null
      const window = docsmitCoverWindow(c, payUrl, shortCode, { png, svg: null })
      const blobs: Blob[] = []
      for (const content of env.contents) {
        const n = content.notice as CombinedRunNotice
        const r = content.recipient as RunRecipient
        blobs.push(await io.buildPdf(n, r.key, ctx.invoiceDocsByJob[n.jobId] ?? [], ctx.payBlocksByJob[n.jobId]?.[r.key] ?? [], { window: r.key === 'owner' ? window : null }))
      }
      const blob = blobs.length > 1 ? await io.merge(blobs) : blobs[0]!
      const pages = await io.pages(blob)
      const draft = docsmitPrepareDraft(c, pages, { receipt: ctx.receipt, shortCode })
      if (draft.envelope.problem) {
        out.held.push({ key: c.key, n: c.n, label: c.label, why: draft.envelope.problem })
        continue
      }
      const pdfPath = `mail/${shortCode}.pdf`
      const uploadErr = await io.upload(pdfPath, blob)
      if (uploadErr) {
        out.held.push({ key: c.key, n: c.n, label: c.label, why: `The copy did not reach the bucket: ${uploadErr}` })
        continue
      }
      const { data, error } = await io.invoke({ action: 'prepare', piece: draft.piece, pdf_path: pdfPath, pdf_bucket: LIEN_RELEASE_DOCUMENTS_BUCKET, job_number: c.jobNumber })
      const d = data as { ok?: boolean; piece_id?: string; price?: number | null; correction?: string | null; credit_balance?: number | null } | null
      if (error || !d?.ok || !d.piece_id) {
        out.held.push({ key: c.key, n: c.n, label: c.label, why: answerError(data, error, 'Docsmit did not take the envelope.') })
        continue
      }
      if (typeof d.credit_balance === 'number') out.balance = d.credit_balance
      out.prepared.push({
        key: c.key,
        n: c.n,
        label: c.label,
        who: c.party.organization || `${c.party.firstName} ${c.party.lastName}`.trim(),
        windowLines: c.windowLines,
        sendType: draft.piece.send_type,
        shortCode,
        recipient: c.recipient,
        jobNumber: c.jobNumber,
        itemIds: c.itemIds,
        pieceId: d.piece_id,
        price: typeof d.price === 'number' ? d.price : null,
        correction: typeof d.correction === 'string' && d.correction ? d.correction : null,
        sheets: draft.envelope.sheets,
        envelope: draft.envelope.envelope,
        pdfUrl: io.objectUrl(blob),
        pdfPath,
      })
    } catch (e) {
      out.held.push({ key: c.key, n: c.n, label: c.label, why: e instanceof Error && e.message ? e.message : 'The envelope could not be prepared.' })
    }
  }
  return out
}

/** `send` for the prepared pieces, in order; the answer as the function spelled it, or a refusal in the same shape. */
export async function sendDocsmitRun(pieceIds: ReadonlyArray<string>, io: Partial<DocsmitIo> = {}): Promise<DocsmitSendAnswer> {
  const invoke = io.invoke ?? realIo.invoke
  try {
    const { data, error } = await invoke({ action: 'send', piece_ids: [...pieceIds] })
    const d = data as Partial<DocsmitSendAnswer> | null
    if (d && Array.isArray(d.sent)) return { ok: d.ok === true, sent: d.sent, skipped: d.skipped, stopped_at: d.stopped_at, shortfall: d.shortfall, error: d.error }
    return { ok: false, sent: [], error: answerError(data, error, 'Docsmit did not answer.') }
  } catch (e) {
    return { ok: false, sent: [], error: e instanceof Error && e.message ? e.message : 'Docsmit did not answer.' }
  }
}

/** What a send's answer writes onto each prepared envelope's copies: the provider, the piece and where it stands. Pure. */
export function docsmitRecipientPatches(prepared: ReadonlyArray<Pick<DocsmitPreparedEnvelope, 'key' | 'pieceId'>>, answer: DocsmitSendAnswer): Map<string, Pick<RunRecipient, 'via' | 'pieceId' | 'pieceStatus' | 'pieceProblem'>> {
  const out = new Map<string, Pick<RunRecipient, 'via' | 'pieceId' | 'pieceStatus' | 'pieceProblem'>>()
  for (const p of prepared) {
    if (answer.sent.includes(p.pieceId)) out.set(p.key, { via: 'docsmit', pieceId: p.pieceId, pieceStatus: 'sent', pieceProblem: null })
    else if (answer.stopped_at === p.pieceId) out.set(p.key, { via: 'docsmit', pieceId: p.pieceId, pieceStatus: 'failed', pieceProblem: answer.error ?? 'Docsmit refused it.' })
    else out.set(p.key, { via: 'docsmit', pieceId: p.pieceId, pieceStatus: 'prepared', pieceProblem: answer.ok ? null : 'Not sent: the batch stopped before it.' })
  }
  return out
}

/** The held envelopes, one line each, for the review's foot and a toast. */
export function docsmitHeldWords(held: ReadonlyArray<DocsmitHeld>): string {
  if (held.length === 0) return ''
  return `${held.length} ${held.length === 1 ? 'envelope stays' : 'envelopes stay'} on paper: ${held.map((h) => `envelope ${h.n} (${h.why.replace(/\.$/, '')})`).join('; ')}.`
}
