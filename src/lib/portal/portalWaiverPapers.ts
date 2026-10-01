import type { PortalWaiverHalf, PortalWaiverRow } from './portalPayload'

/**
 * Lien waivers on the customer portal (v2.4304, pass 3 of canvas QsK155GLJPu2yri9w74d1g): the
 * note a waiver adds to its bill in the ledger (and to a shared bill on the owner's page), and
 * the rows it adds to Your papers. Pure; the page draws them. Only signed halves reach here
 * (`portalPayload` drops the rest), so nothing promises paper that does not exist.
 */

const FORM_WORDS: Record<string, { short: string; title: string }> = {
  conditional_progress: { short: 'conditional', title: 'Conditional progress' },
  conditional_final: { short: 'conditional final', title: 'Conditional final' },
  unconditional_progress: { short: 'unconditional', title: 'Unconditional progress' },
  unconditional_final: { short: 'unconditional final', title: 'Unconditional final' },
}

function formWords(half: PortalWaiverHalf, kind: 'conditional' | 'unconditional', final: boolean): { short: string; title: string } {
  const known = half.formType ? FORM_WORDS[half.formType] : undefined
  if (known) return known
  // A function from before v2.4304 sends no form: say what the bill's place implies.
  return FORM_WORDS[`${kind}_${final ? 'final' : 'progress'}`]!
}

function shortDate(ymd: string | null): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export type PortalWaiverNote = { words: string; href: string | null }

/** The bill's note: its furthest signed waiver — the unconditional once there is one. */
export function portalWaiverNote(waivers: ReadonlyArray<PortalWaiverRow>, invoiceId: string | null): PortalWaiverNote | null {
  if (!invoiceId) return null
  const row = waivers.find((w) => w.invoiceId === invoiceId)
  if (!row) return null
  const pick = row.unconditional.state !== 'none' ? { half: row.unconditional, kind: 'unconditional' as const } : row.conditional.state !== 'none' ? { half: row.conditional, kind: 'conditional' as const } : null
  if (!pick) return null
  const verb = pick.half.state === 'sent' ? 'sent' : 'signed'
  return { words: `${formWords(pick.half, pick.kind, row.final).short}, ${verb} ${shortDate(pick.half.ymd)}`, href: pick.half.pdfUrl }
}

export type PortalWaiverPaperRow = {
  key: string
  audience: PortalWaiverRow['audience']
  jobLabel: string
  jobAddress: string | null
  /** "Conditional progress · Bill 2 of 3 · $18,200.00 · signed by Malachi Whites" */
  line: string
  /** SIGNED for a conditional; PAID IN FULL for an unconditional — the money it answers has settled. */
  status: 'SIGNED' | 'PAID IN FULL'
  ymd: string | null
  href: string | null
}

/** Your papers: one row per signed waiver, newest first. */
export function portalWaiverPaperRows(waivers: ReadonlyArray<PortalWaiverRow>, usd: (n: number) => string): PortalWaiverPaperRow[] {
  const rows: PortalWaiverPaperRow[] = []
  for (const w of waivers) {
    for (const kind of ['conditional', 'unconditional'] as const) {
      const half = w[kind]
      if (half.state === 'none') continue
      const signedBy = half.signerName ? `signed by ${half.signerName}` : null
      rows.push({
        key: `${w.invoiceId}:${kind}`,
        audience: w.audience,
        jobLabel: w.jobLabel,
        jobAddress: w.jobAddress,
        // A job's only bill is labelled plain "Bill": it adds nothing to the line.
        line: [formWords(half, kind, w.final).title, w.billLabel === 'Bill' ? null : w.billLabel, usd(w.amount), signedBy].filter(Boolean).join(' · '),
        status: kind === 'conditional' ? 'SIGNED' : 'PAID IN FULL',
        ymd: half.ymd,
        href: half.pdfUrl,
      })
    }
  }
  return rows.sort((a, b) => (b.ymd ?? '').localeCompare(a.ymd ?? '') || a.key.localeCompare(b.key))
}

/** The group's lead line, by who is reading. Plain words. */
export const PORTAL_WAIVER_GROUP_WORDS: Record<PortalWaiverRow['audience'], { heading: string; lead: string }> = {
  payer: { heading: 'Lien waivers', lead: 'One pair per bill. The conditional comes with the bill. The unconditional comes once your check clears.' },
  owner: {
    heading: 'Lien waivers on your property',
    lead: 'Our waivers to your builder, for the bills our office shared with you. Each one gives up our lien right on your property for that payment.',
  },
}
