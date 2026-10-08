import { pDate, pt, type PortalLang } from './portalI18n'

/**
 * GC mode, New project's step 7: the set email (`to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md` on
 * branch spike/gc-mode, step 7, amended 2026-10-07). When a new set of plans goes on a project, each
 * company asked to quote a trade on it hears, once, through the Portal lane's one sender to a
 * trade company, `gc-trade-email` with kind `plans` (`sendGcTradeEmail`, P3-a). This file is the pure half: who hears, the
 * key that sends each company the set once, and the words, which are the portal's own (`pt`, the
 * prototype's `portalMessages` plans branch, word for word) so the email and the portal's Their
 * messages say the same thing in the company's language.
 */

/** A company asked to quote on the project (`gc_companies`). */
export interface SetEmailCompany {
  id: string
  name: string
  lang: PortalLang
}

/** One ask (`gc_invites`): a company on a trade. */
export interface SetEmailInvite {
  id: string
  packageId: string
  companyId: string
  status: 'invited' | 'opened' | 'bid' | 'declined'
}

/** One company that hears the set, with every trade it is on here and whether the set changes one. */
export interface SetEmailRecipient {
  companyId: string
  companyName: string
  lang: PortalLang
  /** Its trades on the project, in the project's trade order. */
  trades: string[]
  /** The set changes at least one of them. */
  touched: boolean
  /** Its scope lines that read from a sheet or section the set changes, by their words. */
  linesTouched: string[]
  /** The scope lines the set adds, by trade (only its trades that gain one). */
  linesAdded: { trade: string; lines: string[] }[]
}

/**
 * Who hears a new set. While we bid: every company asked on any trade of the project, except one
 * that said no. Once the job is ours: only the company each trade was awarded to
 * (`awardedInviteIds`, the Board's B6; until it lands nobody hears after the bid). One entry per
 * company, whatever its number of trades, the ones whose trade changed first, then by name.
 */
export function setEmailRecipients(input: {
  stage: string
  trades: { id: string; trade: string }[]
  invites: SetEmailInvite[]
  companies: SetEmailCompany[]
  /** The trades (package ids) the set touches, as the window settled them. */
  touches: string[]
  /** By package id: the scope lines the set touches and the ones it adds, as the window reads them. */
  linesByPackage?: Record<string, { touched: string[]; added: string[] }>
  awardedInviteIds?: string[]
}): SetEmailRecipient[] {
  const bidding = input.stage === 'bidding'
  const awarded = new Set(input.awardedInviteIds ?? [])
  const order = new Map(input.trades.map((t, i) => [t.id, i]))
  const byCompany = new Map<string, { packageIds: string[] }>()
  for (const inv of input.invites) {
    if (inv.status === 'declined') continue
    if (!order.has(inv.packageId)) continue
    if (!bidding && !awarded.has(inv.id)) continue
    const row = byCompany.get(inv.companyId) ?? { packageIds: [] }
    if (!row.packageIds.includes(inv.packageId)) row.packageIds.push(inv.packageId)
    byCompany.set(inv.companyId, row)
  }
  const out: SetEmailRecipient[] = []
  for (const [companyId, { packageIds }] of byCompany) {
    const company = input.companies.find((c) => c.id === companyId)
    if (!company) continue
    const sorted = [...packageIds].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    out.push({
      companyId,
      companyName: company.name,
      lang: company.lang,
      trades: sorted.map((id) => input.trades.find((t) => t.id === id)?.trade ?? ''),
      touched: sorted.some((id) => input.touches.includes(id)),
      linesTouched: sorted.flatMap((id) => input.linesByPackage?.[id]?.touched ?? []),
      linesAdded: sorted
        .map((id) => ({ trade: input.trades.find((t) => t.id === id)?.trade ?? '', lines: input.linesByPackage?.[id]?.added ?? [] }))
        .filter((x) => x.lines.length > 0),
    })
  }
  return out.sort((a, b) => Number(b.touched) - Number(a.touched) || a.companyName.localeCompare(b.companyName))
}

/** The key that sends one company one set once: a second press, or a retry, sends nothing new. */
export function setEmailKey(projectId: string, rev: number): string {
  return `${projectId}:plans:${rev}`
}

/**
 * The set email's words for one company: the portal's `plans` message without its greeting (the
 * sender writes "Hello …" for the people it picks and adds the portal link under the lines). In
 * order: the set is out, the sheets it names, the company's lines it touches, the lines it adds to
 * each of its trades, whether it changes their trade, and while we bid the day the quote is due
 * (`quoteDueOn`, `questionsCloseOn`'s day). A line with nothing to say is left out. The last three
 * facts are the ones New project's `planEmail` carried and a trade acts on (the lead, 2026-10-07),
 * in the Portal lane's words (`mPlansYourLines`, `mPlansAddsLines`, `mInviteDue`).
 */
export function setEmailWords(
  lang: PortalLang,
  set: { label: string; project: string; note: string; sheets: string[]; quoteDueOn?: string | null },
  r: Pick<SetEmailRecipient, 'trades' | 'touched'> & Partial<Pick<SetEmailRecipient, 'linesTouched' | 'linesAdded'>>,
): { subject: string; lines: string[] } {
  const trades = r.trades.join(pt(lang, 'and'))
  const yours = r.linesTouched ?? []
  return {
    subject: pt(lang, 'mPlansSubject', { label: set.label, project: set.project }),
    lines: [
      // An empty note would leave "…is out. " with a space at the end.
      pt(lang, 'mPlansOut', { label: set.label, project: set.project, note: set.note }).trim(),
      ...(set.sheets.length > 0 ? [pt(lang, 'sheetsList', { list: set.sheets.join(', ') })] : []),
      ...(yours.length > 0 ? [pt(lang, 'mPlansYourLines', { list: yours.join(', ') })] : []),
      ...(r.linesAdded ?? []).map((a) => pt(lang, 'mPlansAddsLines', { trade: a.trade, list: a.lines.join(', ') })),
      pt(lang, r.touched ? 'mPlansChanges' : 'mPlansNoChange', { trades }),
      ...(set.quoteDueOn ? [pt(lang, 'mInviteDue', { date: pDate(lang, set.quoteDueOn) })] : []),
    ],
  }
}

/** What one company's send came to, from `gc-trade-email`. */
export type SetEmailResult =
  | { companyId: string; outcome: 'sent'; messageId: string; emailSendLogId: string | null; to: string[]; already: boolean }
  | { companyId: string; outcome: 'no email' }
  | { companyId: string; outcome: 'failed'; error: string }

/** The `gc_plan_set_sends` rows the sends make: a company with no address, or a failed send, gets none. */
export function setSendRows(
  setId: string,
  recipients: Pick<SetEmailRecipient, 'companyId' | 'touched'>[],
  results: SetEmailResult[],
): { set_id: string; company_id: string; touched: boolean; email_send_log_id: string | null }[] {
  return results.flatMap((r) => {
    if (r.outcome !== 'sent') return []
    const who = recipients.find((x) => x.companyId === r.companyId)
    return who ? [{ set_id: setId, company_id: r.companyId, touched: who.touched, email_send_log_id: r.emailSendLogId }] : []
  })
}

/** One line on how the sends went, for the window: "Emailed 4 companies. 1 has no email on file." */
export function setEmailSummary(results: SetEmailResult[]): string {
  const sent = results.filter((r) => r.outcome === 'sent').length
  const none = results.filter((r) => r.outcome === 'no email').length
  const failed = results.filter((r) => r.outcome === 'failed').length
  const parts = [`Emailed ${sent} ${sent === 1 ? 'company' : 'companies'}.`]
  if (none > 0) parts.push(`${none} ${none === 1 ? 'has' : 'have'} no email on file.`)
  if (failed > 0) parts.push(`${failed} did not go out. Press Try again.`)
  return parts.join(' ')
}
