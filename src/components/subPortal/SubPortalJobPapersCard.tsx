/**
 * Papers before a job opens, step 6: the card drawn on a sub's own page in place of a job's rows, until the sub has
 * signed each paper the job requires. **Work on J2391**, how many papers stand between the sub and the job's address
 * and scope, each paper with its state, and **Read and sign** on the first one not signed. The press asks
 * `submit-sub-portal` for the sub's own copy and its signing link (`sign_job_paper`), remembers the way back to this
 * page, and leaves for the signing page the app already has.
 *
 * The job's sheets and offers sit under the papers as one line each: the job's number, *Papers to sign first* where
 * the address would be, and the money, which is the sub's own to read. Modelled on `JobPapersGate`, painted with the
 * portal's own single-theme light palette like the page it sits on.
 */
import { useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { JOB_PAPERS_RETURN_KEY } from '../../lib/jobs/jobPapers'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../../lib/portal/portalFailure'
import { formatPortalUsd } from '../../lib/portal/portalPayload'
import { CARD, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { formatSubPortalDate, type SubPortalLang, type SubPortalStringKey } from '../../lib/subPortal/subPortalI18n'
import { subJobPapersCardView, subPapersFirstLine, type SubPortalJobPapers } from '../../lib/subPortal/subPortalJobPapers'
import type { SubPortalOffer, SubPortalSheet } from '../../lib/subPortal/subPortalPayload'
import { PortalFailureNote } from '../portal/PortalFailureNote'

type T = (key: SubPortalStringKey, vars?: Record<string, string>) => string

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const cardStyle: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 8, marginTop: 13, overflow: 'hidden' }
const paperStyle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER }
const dotStyle: CSSProperties = { flex: '0 0 22px', height: 22, borderRadius: 999, border: `2px solid ${HAIR}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: MUTED, boxSizing: 'border-box' }
const pressStyle: CSSProperties = { font: 'inherit', fontWeight: 700, fontSize: 15, minHeight: 46, borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', padding: '0.5rem 0.9rem', textAlign: 'center', lineHeight: 1.2, cursor: 'pointer', width: '100%' }
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', fontSize: 13, padding: '5px 0', borderTop: `1px dotted ${HAIR}` }

export function SubPortalJobPapersCard({
  job,
  sheets,
  offers,
  lang,
  t,
  today,
  submitToken,
  phone,
  returnPath,
}: {
  job: SubPortalJobPapers
  /** The job's sheets, held back: the number and the money show. */
  sheets: readonly SubPortalSheet[]
  /** The job's offers, held back: the amount shows. */
  offers: readonly SubPortalOffer[]
  lang: SubPortalLang
  t: T
  /** The company's day, so a paper signed today says so. */
  today: string
  submitToken: string
  /** The office's number, offered beside a refusal. */
  phone: string | null
  /** The in-app path to come back to after signing. Defaults to this page's own path and query. */
  returnPath?: string
}) {
  const [busy, setBusy] = useState(false)
  /** The signing page did not open, as kept: its class or the function's own known sentence, worded in the page's language. */
  const [error, setError] = useState<PortalFailureCause | null>(null)
  const view = subJobPapersCardView(job, today, lang)
  const firstLine = subPapersFirstLine(lang)

  async function sign() {
    if (busy || !view.next) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-sub-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: submitToken, kind: 'sign_job_paper', required_paper_id: view.next.id }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; signPath?: string; error?: unknown } | null
      if (json?.ok && typeof json.signPath === 'string' && json.signPath.startsWith('/contract/accept?')) {
        try {
          window.sessionStorage.setItem(JOB_PAPERS_RETURN_KEY, JSON.stringify({ jobId: job.jobId, path: returnPath ?? `${window.location.pathname}${window.location.search}` }))
        } catch {
          // No session storage here: the signing page then offers no way back, and the link still opens this page.
        }
        window.location.assign(json.signPath)
        return
      }
      // A refusal here is about the paper, not the link: read as a send, so never as a gone link.
      setError(portalFailureCause(res.status, json, 'send'))
    } catch (e) {
      setError(portalFailureKind(e))
    }
    setBusy(false)
  }

  return (
    <div style={cardStyle} data-avoid-break data-sub-job-papers={job.unread ? 'unread' : 'owed'}>
      <div style={{ background: NOTE_BAND, padding: '0.5rem 0.9rem', fontSize: 15, fontWeight: 700 }}>
        <span aria-hidden>🔒 </span>
        {view.title}
      </div>
      <div style={{ padding: '0.65rem 0.9rem 0.8rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: INK }}>{view.lead}</p>
        {view.rows.map((r) => (
          <div key={r.id} style={paperStyle} data-sub-job-paper={r.done ? 'signed' : 'owed'}>
            <span style={r.done ? { ...dotStyle, background: PAPER_GREEN, borderColor: PAPER_GREEN, color: '#fff' } : dotStyle} aria-hidden>
              {r.done ? '✓' : ''}
            </span>
            <div>
              <b style={{ display: 'block', fontWeight: 600, fontSize: 13.5 }}>{r.paperName}</b>
              <small style={{ color: MUTED, fontSize: 12 }}>{r.sub}</small>
            </div>
          </div>
        ))}
        {view.next && view.nextLabel ? (
          <button
            type="button"
            data-screen-only
            style={busy ? { ...pressStyle, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'wait' } : pressStyle}
            disabled={busy}
            onClick={() => void sign()}
          >
            {busy ? view.busyLabel : view.nextLabel}
          </button>
        ) : null}
        <PortalFailureNote failure={error ? portalFailure(error, 'open', lang, { phone }) : null} lang={lang} onTryAgain={() => void sign()} busy={busy} />
        {sheets.length > 0 || offers.length > 0 ? (
          <div>
            {sheets.map((sheet) => (
              <div key={sheet.id} style={rowStyle} data-sub-job-papers-sheet={sheet.id}>
                <span>
                  <b>{sheet.jobNumber ?? t('workOrder')}</b>
                  <span style={{ color: MUTED }}> · {firstLine}</span>
                </span>
                <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {t('agreed')} {formatPortalUsd(sheet.agreed)} · {t('paidLabel')} {formatPortalUsd(sheet.paid + sheet.backcharges)} · {t('openLabel')} <b style={{ color: INK }}>{formatPortalUsd(sheet.open)}</b>
                </span>
              </div>
            ))}
            {offers.map((offer) => (
              <div key={offer.id} style={rowStyle} data-sub-job-papers-offer={offer.id}>
                <span>
                  <b>{t('newWork')}</b>
                  <span style={{ color: MUTED }}> · {firstLine}</span>
                </span>
                <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  <b style={{ color: INK }}>{formatPortalUsd(offer.total)}</b>
                  {offer.expiresOn ? ` · ${t('offerExpires', { date: formatSubPortalDate(offer.expiresOn, lang) })}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default SubPortalJobPapersCard
