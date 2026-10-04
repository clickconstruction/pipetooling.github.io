import { type JobDemandLetterRow, liveDemandLetters } from './demandLetterTracking'
import { type JobLienFilingRow, liveFilings } from './lienDeadlines'
import { normalizeDocumentUrl } from './lienFilingDocumentLink'
import { type JobLienReleaseRow, lienReleaseFormLabel, liveLienReleases } from './lienReleaseTracking'

/**
 * A job's lien paper as rows for the job window's Documents tab (v2.4496): the notices and
 * filings recorded on it, its demand letters, and its releases of lien. Voided paper is left
 * out, and so is a release still in draft. Pure: the tab draws what this returns.
 */

/** The Lien window's tab that holds this paper. */
export type LienPaperTab = 'demand' | 'notice' | 'affidavit' | 'release_record'

export type JobLienPaperRow =
  | { kind: 'filing'; id: string; title: string; detail: string; amount: number | null; documentUrl: string; tab: LienPaperTab; createdAt: string }
  | { kind: 'demand'; id: string; title: string; detail: string; amount: number | null; tab: LienPaperTab; createdAt: string }
  | { kind: 'release'; id: string; title: string; detail: string; amount: number | null; release: JobLienReleaseRow; createdAt: string }

const FILING: Record<string, { title: string; tab: LienPaperTab; money: boolean }> = {
  notice_53_056: { title: '§ 53.056 notice', tab: 'notice', money: true },
  retainage_53_057: { title: '§ 53.057 retainage notice', tab: 'notice', money: true },
  affidavit: { title: 'Lien affidavit', tab: 'affidavit', money: true },
  release_of_record: { title: 'Release of record', tab: 'release_record', money: false },
}

const SENT_BY: Record<string, string> = {
  certified_mail: 'by certified mail',
  traceable_courier: 'by courier',
  email: 'by email',
  hand: 'by hand',
}

const mdY = (ymd: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  return m ? `${m[2]}/${m[3]}/${m[1]}` : ''
}

const amountOrNull = (n: number | string | null | undefined): number | null => {
  const v = Number(n)
  return Number.isFinite(v) && v !== 0 ? v : null
}

export type JobLienPaper = { filings: JobLienFilingRow[]; letters: JobDemandLetterRow[]; releases: JobLienReleaseRow[] }

/**
 * The rows, oldest first. `dayOf` turns a timestamp into its calendar day in the app's time zone
 * (a plain date passes through it unchanged).
 */
export function jobLienPaperRows(paper: JobLienPaper, dayOf: (iso: string) => string): JobLienPaperRow[] {
  const day = (v: string | null | undefined): string => (v && v.trim() ? mdY(dayOf(v)) || mdY(v) : '')
  const rows: JobLienPaperRow[] = []

  for (const f of liveFilings(paper.filings)) {
    const known = FILING[f.kind] ?? { title: 'Lien filing', tab: 'notice' as LienPaperTab, money: true }
    const parts = [
      f.served_at ? `Served ${day(f.served_at)}` : '',
      f.filed_at ? `Filed ${day(f.filed_at)}` : '',
      (f.recording_number ?? '').trim() ? `recording no. ${f.recording_number.trim()}` : '',
    ].filter(Boolean)
    rows.push({
      kind: 'filing',
      id: f.id,
      title: known.title,
      detail: parts.join(' · ') || 'Recorded, not served yet',
      amount: known.money ? amountOrNull(f.amount) : null,
      documentUrl: normalizeDocumentUrl(f.document_url),
      tab: known.tab,
      createdAt: f.created_at,
    })
  }

  for (const l of liveDemandLetters(paper.letters)) {
    const sent = l.sent_at ? `Sent ${day(l.sent_at)}${SENT_BY[l.sent_method] ? ` ${SENT_BY[l.sent_method]}` : ''}` : 'Not sent yet'
    const reply = l.deadline_date ? `reply by ${day(l.deadline_date)}` : ''
    rows.push({
      kind: 'demand',
      id: l.id,
      title: 'Demand letter',
      detail: [sent, reply].filter(Boolean).join(' · '),
      amount: amountOrNull(l.amount),
      tab: 'demand',
      createdAt: l.created_at,
    })
  }

  for (const r of liveLienReleases(paper.releases)) {
    if (r.status === 'draft') continue
    rows.push({
      kind: 'release',
      id: r.id,
      title: 'Release of lien',
      detail: lienReleaseFormLabel(r.form_type),
      amount: amountOrNull(r.amount),
      release: r,
      createdAt: r.created_at,
    })
  }

  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
