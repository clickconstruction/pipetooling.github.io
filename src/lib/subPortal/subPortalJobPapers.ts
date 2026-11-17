/**
 * Papers before a job opens, step 6: the sub's own page. A sub with no login signs on their page before a job's
 * address and scope show (the owner's call 7). The `sub-portal` function holds a shut job's rows back and lists the
 * jobs that wait on the sub's signature (`job_papers`); this file reads that list and says what the page draws, in
 * the page's two languages. The rows of the card are the prompt's own (`jobPapersGateView`), so a paper reads the
 * same on the sub's page as at a job in the app.
 *
 * Pure: no React, no fetch.
 */
import { jobPapersGateView, parseMyJobPapers, type MyJobPaper } from '../jobs/jobPapers'
import type { SubPortalLang } from './subPortalI18n'

/** One job that waits on the sub's signature. `unread` is a job held shut because its papers could not be read. */
export type SubPortalJobPapers = { jobId: string; jobNumber: string; unread: boolean; papers: MyJobPaper[] }

/** The reply's `job_papers`, read defensively. A job with nothing left to sign is not a waiting job and is left out. */
export function parseSubPortalJobPapers(raw: unknown): SubPortalJobPapers[] {
  if (!Array.isArray(raw)) return []
  const out: SubPortalJobPapers[] = []
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) continue
    const r = entry as Record<string, unknown>
    const jobId = typeof r.job_id === 'string' ? r.job_id.trim() : ''
    if (!jobId) continue
    const mine = parseMyJobPapers(r)
    const unread = r.unread === true
    if (!unread && !mine.papers.some((p) => p.status !== 'signed')) continue
    out.push({ jobId, jobNumber: mine.jobNumber.trim(), unread, papers: mine.papers })
  }
  return out
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** What a held-back row reads where the job's address or name would be. */
export function subPapersFirstLine(lang: SubPortalLang = 'en'): string {
  return lang === 'es' ? 'Primero hay documentos por firmar' : 'Papers to sign first'
}

export interface SubJobPapersCardView {
  title: string
  lead: string
  rows: { id: string; paperName: string; done: boolean; sub: string }[]
  /** The paper Read and sign opens: the first one not signed. Null when the papers could not be read. */
  next: MyJobPaper | null
  nextLabel: string | null
  /** The press while the signing page is being opened. */
  busyLabel: string
}

/**
 * The card drawn in place of a shut job's rows on the sub's page: **Work on J2391**, how many papers stand between the
 * sub and the job's address and scope, each paper with its state, and **Read and sign** on the first one not signed.
 * `today` is the company's day, so a paper signed today says so. A job whose papers could not be read says that, and
 * offers no press.
 */
export function subJobPapersCardView(job: SubPortalJobPapers, today: string | null = null, lang: SubPortalLang = 'en'): SubJobPapersCardView {
  const es = lang === 'es'
  const gate = jobPapersGateView({ jobNumber: job.jobNumber, linked: true, papers: job.papers }, today)
  const total = job.papers.length
  const left = job.papers.filter((p) => p.status !== 'signed').length
  const signed = total - left
  const title = es ? `Trabajo en ${job.jobNumber || 'una obra'}` : `Work on ${job.jobNumber || 'a job'}`
  const busyLabel = es ? 'Abriendo el documento…' : 'Opening the paper…'
  if (job.unread || total === 0) {
    return {
      title,
      lead: es
        ? 'No pudimos revisar los documentos de este trabajo. Vuelva a cargar la página, o llame a la oficina.'
        : 'We could not check this job’s papers just now. Reload the page, or call the office.',
      rows: [],
      next: null,
      nextLabel: null,
      busyLabel,
    }
  }
  const before = es
    ? `Este trabajo tiene ${total} ${total === 1 ? 'documento' : 'documentos'} por firmar antes de que pueda ver dónde es y cuál es el trabajo.`
    : `This job has ${total} ${total === 1 ? 'paper' : 'papers'} to sign before you can see where it is and what the work is.`
  const leftWords = es ? (left === 1 ? 'Falta 1 documento.' : `Faltan ${left} documentos.`) : `${left} ${left === 1 ? 'paper is' : 'papers are'} left.`
  const rows = gate.rows.map((row, i) => {
    if (!es) return row
    const paper = job.papers[i]!
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(paper.signedAt ?? '')
    const month = m ? MONTHS_ES[Number(m[2]) - 1] : undefined
    const sub = !row.done ? 'Sin firmar todavía' : today && paper.signedAt?.slice(0, 10) === today ? 'Firmado hoy' : m && month ? `Firmado el ${Number(m[3])} ${month}` : 'Firmado'
    return { ...row, sub }
  })
  return {
    title,
    lead: signed > 0 && left > 0 ? `${before} ${leftWords}` : before,
    rows,
    next: gate.next,
    nextLabel: gate.next ? (es ? `Leer y firmar: ${gate.next.paperName}` : `Read and sign: ${gate.next.paperName}`) : null,
    busyLabel,
  }
}
