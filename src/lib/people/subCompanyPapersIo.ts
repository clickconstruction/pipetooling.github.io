/**
 * A sub's company's own papers on People → Contracts (punch list #403, step 6, PR 2): the read, the send and the entry
 * from paper. Every write runs as the caller under its table's own policy: `gc_company_paper` and the paper's update
 * take the office's four roles, `gc_company_people` the GC office team. The send is `send-contract-for-signature`'s
 * company branch with `from: 'office'` (v2.8322), which mails the people at the company who get contracts. Browser io,
 * not pure; the rules and the words are `subCompanyPapers.ts`.
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { gcTradeEmailRefusal, readTradeEmailAnswer } from '../gc/tradeEmail'
import { COMPANY_PAPER_WORDS, companyPaperEmail, companyPaperSendKey, type CompanyKeptPerson, type CompanyPaperRow } from './subCompanyPapers'

const PAPERS = 'person_contract_documents'
const COLUMNS = 'id, company_id, document_name, status, signed_at, sent_at, signer_last_viewed_at, lineage_version, form_template_id, signer_name, signer_title'

/** The papers of these companies. None asked, none read. */
export async function loadCompanyPapers(companyIds: readonly string[]): Promise<CompanyPaperRow[]> {
  if (companyIds.length === 0) return []
  return fetchAllRows<CompanyPaperRow>(
    (from, to) => supabase.from(PAPERS).select(COLUMNS).in('company_id', [...companyIds]).order('id').range(from, to),
    'load the companies’ papers',
  )
}

/** The people a company keeps, with the address each is mailed at: what the send window opens a signer's address from. */
export async function loadCompanyKeptPeople(companyId: string): Promise<CompanyKeptPerson[]> {
  const rows = await withSupabaseRetry<CompanyKeptPerson[]>(
    async () => supabase.from('gc_company_people').select('name, email').eq('company_id', companyId).is('removed_at', null).order('created_at'),
    'read the people at the company',
  )
  return rows ?? []
}

/** The signer kept as a person at the company who gets its contracts, so the send reaches them. Their email once. */
async function keepSignerAtCompany(companyId: string, signer: { name: string; title: string; email: string }): Promise<void> {
  const email = signer.email.trim()
  const rows = await withSupabaseRetry<Array<{ id: string; email: string; gets: string[] }>>(
    async () => supabase.from('gc_company_people').select('id, email, gets').eq('company_id', companyId).is('removed_at', null),
    'read the people at the company',
  )
  const have = (rows ?? []).find((r) => r.email.trim().toLowerCase() === email.toLowerCase())
  if (have) {
    if (have.gets.includes('contracts')) return
    const { error } = await supabase.from('gc_company_people').update({ gets: [...have.gets, 'contracts'] }).eq('id', have.id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('gc_company_people')
    .insert({ company_id: companyId, name: signer.name.trim(), email, role: signer.title.trim(), gets: ['contracts'], added_by: 'office' })
  if (error) throw error
}

/** What a send or an entry did. */
export type CompanyPaperOutcome = { ok: true; words: string } | { ok: false; why: string }

/**
 * Send the company a Contract Book paper to sign: keep the signer at the company, make or refresh the company's copy,
 * name the signer on it, then the email. A paper signed between the read and the press is not sent again.
 */
export async function sendCompanyPaperFromPeople(args: {
  company: { id: string; name: string }
  bookEntryId: string
  paper: string
  signer: { name: string; title: string; email: string }
}): Promise<CompanyPaperOutcome> {
  const { company, bookEntryId, paper, signer } = args
  try {
    await keepSignerAtCompany(company.id, signer)
    const made = await supabase.rpc('gc_company_paper', { p_company_id: company.id, p_book_entry_id: bookEntryId })
    if (made.error) throw made.error
    const documentId = made.data as string
    const named = await supabase
      .from(PAPERS)
      .update({ signer_name: signer.name.trim(), signer_title: signer.title.trim() || null, signer_email: signer.email.trim() })
      .eq('id', documentId)
      .in('status', ['unsent', 'sent'])
      .select('id')
    if (named.error) throw named.error
    if ((named.data ?? []).length === 0) return { ok: false, why: COMPANY_PAPER_WORDS.signedAlready }

    const email = companyPaperEmail({ paper, company: company.name, signer: signer.name })
    const r = await supabase.functions.invoke('send-contract-for-signature', {
      body: {
        person_contract_document_id: documentId,
        public_origin: window.location.origin,
        trade_email: { companyId: company.id, key: companyPaperSendKey(documentId, Date.now()), lang: 'en', subject: email.subject, lines: email.lines, actionLabel: email.actionLabel, from: 'office' },
      },
    })
    if ((r.data as { emailed?: boolean } | null)?.emailed === false) return { ok: false, why: COMPANY_PAPER_WORDS.notEmailed }
    const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
    const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
    const answer = readTradeEmailAnswer(r.data, errorBody)
    if (answer.ok) return { ok: true, words: COMPANY_PAPER_WORDS.sentWords(answer.to) }
    return { ok: false, why: answer.key === 'officeOnly' ? COMPANY_PAPER_WORDS.officeOnly : gcTradeEmailRefusal(answer.key) }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}

/** Enter a paper the company signed on paper: make or refresh its copy, then mark it signed by who and on what day. */
export async function enterCompanyPaperFromPaper(args: {
  companyId: string
  bookEntryId: string
  signer: { name: string; title: string }
  signedOn: string
  link: string
}): Promise<CompanyPaperOutcome> {
  try {
    const made = await supabase.rpc('gc_company_paper', { p_company_id: args.companyId, p_book_entry_id: args.bookEntryId })
    if (made.error) throw made.error
    const link = args.link.trim()
    const done = await supabase
      .from(PAPERS)
      .update({
        status: 'signed',
        signed_at: args.signedOn,
        signer_name: args.signer.name.trim(),
        signer_title: args.signer.title.trim() || null,
        ...(link ? { url: link } : {}),
        note: 'Entered from paper.',
      })
      .eq('id', made.data as string)
      .in('status', ['unsent', 'sent'])
      .select('id')
    if (done.error) throw done.error
    if ((done.data ?? []).length === 0) return { ok: false, why: COMPANY_PAPER_WORDS.signedAlready }
    return { ok: true, words: COMPANY_PAPER_WORDS.entered }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}
