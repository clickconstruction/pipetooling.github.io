/**
 * GC mode, the real build, the Board's B6-b-ii: the presses behind a company's Documents tab, on B6-b-i's functions
 * (`20261010009000_gc_papers`). Every one is a dev's while the Board is built, as the functions are.
 *
 * A send, in the lead's order (2026-10-09, call B):
 * 1. a master agreement or a W-9: `gc_company_paper` makes or refreshes the company's copy of its Book entry;
 * 2. `gc_send_paper` records the send and its promise;
 * 3. the email, keyed `<send id>:<paper>`: the copy's signing link through `send-contract-for-signature`'s company
 *    branch, or `gc-trade-email` for an insurance ask or a statement of work's reminder.
 * If the email fails, the send and its promise stay on record and the screen says so, so a reminder tries again.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { spanishHeld } from '../../../supabase/functions/_shared/gcTradeEmail'
import { sendGcSow } from './gcIo'
import { paperEmail, paperSendKey } from './paperEmail'
import type { PaperStep } from './paperSend'
import type { PortalLang } from './portalI18n'
import { sowEmailRequest } from './sowEmail'
import { GC_TRADE_EMAIL_REFUSALS, gcTradeEmailRefusal, readTradeEmailAnswer, type TradeEmailAnswer } from './tradeEmail'
import { sendGcTradeEmail } from './tradeEmailIo'
import type { GcState, Partner } from './types'

function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data as T
}

/**
 * The Contract Book entry sent as a company's master agreement, by its title (the owner's call A, 2026-10-09: "We need
 * to make a new master services agreement, I will have to provide you one"). Prod's Book has none yet, so the master
 * agreement's row says it is waiting on the agreement, with no Send, until the entry is there: Send turns on by the
 * entry's presence, never a flag. It goes in as a text entry or a Contract Form whose doc_type is agreement
 * (docs/CONTRACT_FORMS.md), since a company's copy of it reads as its master agreement once signed.
 */
export const GC_MASTER_AGREEMENT_TITLE = 'Master Services Agreement'

/** The Book entries a company is sent (call B), by title and by form. Null: not in the Book. */
export interface CompanyPaperEntries {
  msa: string | null
  w9: string | null
}

/**
 * The Book's entries for a sub: the master agreement by its title, as a text entry or an agreement form, and the W-9 by
 * its form's doc_type (the Subs packet's W-9).
 */
export async function loadCompanyPaperEntries(): Promise<CompanyPaperEntries> {
  const entries = taken(
    await supabase.from('contract_template_documents').select('id, document_name, form_template_id').eq('audience', 'sub').order('sequence_order'),
    'load the Contract Book',
  )
  const formIds = [...new Set(entries.map((e) => e.form_template_id).filter((id): id is string => Boolean(id)))]
  const forms = formIds.length ? taken(await supabase.from('contract_form_templates').select('id, doc_type').in('id', formIds), 'load the Contract Book’s forms') : []
  const docType = new Map(forms.map((f) => [f.id, f.doc_type]))
  const typeOf = (e: { form_template_id: string | null }) => (e.form_template_id ? (docType.get(e.form_template_id) ?? null) : 'agreement')
  return {
    msa: entries.find((e) => e.document_name.trim() === GC_MASTER_AGREEMENT_TITLE && typeOf(e) === 'agreement')?.id ?? null,
    w9: entries.find((e) => e.form_template_id && typeOf(e) === 'w9')?.id ?? null,
  }
}

/** Whether the Documents tab offers a step's send: a waiver waits for the draws, a paper with no Book entry for it. */
export function paperSendable(step: PaperStep, entries: CompanyPaperEntries | null): boolean {
  if (step.paper === 'waiver') return false
  if (step.paper === 'msa' || step.paper === 'w9') return Boolean(entries?.[step.paper])
  return true
}

/** What a send did: emailed (to its names), or refused, and whether it is on record anyway. */
export type PaperSendOutcome = { ok: true; to: string[]; emailed: boolean } | { ok: false; recorded: boolean; why: string }

/** The words for a send that is on record but did not go by email. */
export const notEmailedWords = (why: string): string => `On record, the email did not go: ${why} Send the reminder to try again.`

/** One send of a paper from the Documents tab, with its email, in the order above. */
export async function sendCompanyPaper(args: {
  state: GcState
  partner: Partner
  step: PaperStep
  by: string
  note: string
  lang: PortalLang
  entries: CompanyPaperEntries
}): Promise<PaperSendOutcome> {
  const { state, partner, step, by, note, lang, entries } = args
  if (!paperSendable(step, entries)) return { ok: false, recorded: false, why: 'This paper is not sent from here yet.' }
  const email = paperEmail(state, partner, step, by, note, lang)
  // Spanish waits for its reader (decision 8): say so before anything is on record.
  if (email && spanishHeld({ lang })) return { ok: false, recorded: false, why: GC_TRADE_EMAIL_REFUSALS.spanishHeld }

  let documentId: string | null = null
  if (step.paper === 'msa' || step.paper === 'w9') {
    documentId = taken(await supabase.rpc('gc_company_paper', { p_company_id: partner.id, p_book_entry_id: entries[step.paper]! }), 'make their copy of the paper')
  }
  let sowId: string | null = null
  if (step.paper === 'sow' && step.mode === 'first' && step.packageId) sowId = await sendGcSow(step.packageId, state.today)

  const sendId = taken(
    await supabase.rpc('gc_send_paper', {
      p: {
        companyId: partner.id,
        paper: step.paper,
        ...(step.projectId ? { projectId: step.projectId } : {}),
        ...(step.packageId ? { packageId: step.packageId } : {}),
        dueOn: by,
        note: note.trim(),
        first: step.mode === 'first' && (step.paper === 'msa' || step.paper === 'sow'),
        what: step.what,
      },
    }),
    'record the send',
  )
  if (!email) return { ok: true, to: [], emailed: false }

  let answer: TradeEmailAnswer
  if (email.how === 'sign') {
    try {
      const r = await supabase.functions.invoke('send-contract-for-signature', {
        body: {
          person_contract_document_id: documentId,
          public_origin: window.location.origin,
          trade_email: { companyId: partner.id, key: paperSendKey(sendId, step.paper), lang, subject: email.subject, lines: email.lines, actionLabel: email.actionLabel },
        },
      })
      const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
      const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
      answer = readTradeEmailAnswer(r.data, errorBody)
    } catch (e) {
      answer = { ok: false, key: 'failed', detail: e instanceof Error ? e.message : String(e) }
    }
  } else {
    // A statement of work's first send keeps the trade card's own key (B6-a-ii), so the two never send it twice.
    const key = sowId && step.projectId && step.packageId ? (sowEmailRequest(state, step.projectId, step.packageId, sowId, lang)?.key ?? paperSendKey(sendId, step.paper)) : paperSendKey(sendId, step.paper)
    answer = await sendGcTradeEmail({ companyId: partner.id, kind: email.kind, key, projectId: email.projectId, lang, subject: email.subject, lines: email.lines })
  }
  return answer.ok ? { ok: true, to: answer.to, emailed: true } : { ok: false, recorded: true, why: gcTradeEmailRefusal(answer.key) }
}

/** The office files a company's insurance certificate: its last day and the https link to it. */
export async function recordCompanyInsurance(companyId: string, expiresOn: string, url: string): Promise<string> {
  return taken(await supabase.rpc('gc_record_company_coi', { p_company_id: companyId, p_expires_on: expiresOn, p_url: url.trim() }), 'file their insurance certificate')
}

/**
 * The office marks a certificate a trade sent from its portal good (P5b-2m, the owner's "Office looks first"): it counts
 * from then on, and the keep trigger keeps the insurance promise. A dev's until the papers' door.
 */
export async function markCompanyCoiGood(paperId: string): Promise<void> {
  await taken(await supabase.rpc('gc_mark_company_coi_good', { p_paper_id: paperId }), 'mark their certificate good')
}

/**
 * The Drive link of a certificate a trade sent from its portal (P5b-2): its upload, tied to the paper. The board's paper
 * states carry no link, and the office team reads the uploads (`gc_trade_files`). Null: none found.
 */
export async function loadReceivedCoiLink(paperId: string): Promise<string | null> {
  const rows = taken(
    await supabase.from('gc_trade_files').select('drive_url').eq('record_id', paperId).eq('purpose', 'coi').order('uploaded_at', { ascending: false }).limit(1),
    'read their certificate’s link',
  )
  return rows[0]?.drive_url ?? null
}
