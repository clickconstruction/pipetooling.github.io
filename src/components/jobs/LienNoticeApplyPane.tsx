import { useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { lienApplyButtonWords, lienApplyChecks, lienApplyReasonProblem, lienApplySetsAside, lienPaperWords, type LienRecordedPaper } from '../../lib/jobs/lienNoticeApply'
import { applyLienNoticePaper } from '../../lib/jobs/lienNoticeApplyIo'
import LienRecordSheet from './LienRecordSheet'
import { recordSheetField, recordSheetLabel, recordSheetTick } from './lienRecordSheetStyles'

/**
 * Apply a notice that already went (v2.7508): the office picks the paper off the record, ticks which of this job's
 * months it stands for, reads what matches and what the desk warns about, types a reason when warned, and one row is
 * written on this job that points at the paper. The notice waiting on the desk is set aside, kept with its approval
 * and signature. Opened from *Already mailed? Record it* when the property has a notice on record.
 */
export type LienApplyPaneJob = {
  id: string
  /** "4107 · Redbud Builders" */
  label: string
  /** "4107" */
  number: string
  /** The job's own share: its open balance, or the claim set by hand. */
  amount: number
  /** The notice waiting on the desk, when there is one. */
  item: { id: string; fields: unknown; months: ReadonlyArray<string> } | null
}

export default function LienNoticeApplyPane({
  job,
  papers,
  noticedMonths,
  months,
  propertyKind,
  lastWorkYmd,
  userId,
  userName,
  onClose,
  onApplied,
  onNotListed,
  layout = 'box',
  onCloseWindow,
}: {
  job: LienApplyPaneJob
  papers: ReadonlyArray<LienRecordedPaper>
  noticedMonths: ReadonlyArray<string>
  /** The months the desk asks this job about. */
  months: ReadonlyArray<string>
  propertyKind: string
  lastWorkYmd: string | null
  userId: string | null
  userName: string
  onClose: () => void
  onApplied: (result: { filingId: string }) => void
  /** The paper is not on the list: record it as a paper that went out by hand. */
  onNotListed: () => void
  layout?: 'box' | 'sheet'
  onCloseWindow?: () => void
}) {
  const { showToast } = useToastContext()
  const open = useMemo(() => months.filter((m) => !noticedMonths.includes(m)), [months, noticedMonths])
  const [pickedKey, setPickedKey] = useState<string | null>(papers.length === 1 ? papers[0]!.key : null)
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(open))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const paper = papers.find((p) => p.key === pickedKey) ?? null
  const tickedList = useMemo(() => [...ticked].sort(), [ticked])
  const checks = useMemo(() => (paper ? lienApplyChecks({ paper, months: tickedList, noticedMonths, propertyKind, lastWorkYmd }) : { refusals: [], warnings: [] }), [paper, tickedList, noticedMonths, propertyKind, lastWorkYmd])
  const reasonProblem = paper ? lienApplyReasonProblem(checks.warnings, reason) : ''
  const setsAside = Boolean(job.item) && lienApplySetsAside(job.item?.months ?? [], tickedList, noticedMonths)
  const blocked = !paper || checks.refusals.length > 0 || reasonProblem !== ''
  const sheet = layout === 'sheet'

  const apply = async () => {
    if (busy || blocked || !paper) return
    setBusy(true)
    try {
      const result = await applyLienNoticePaper({ paper, job: { id: job.id, amount: job.amount }, months: tickedList, reason, userId, userName, setAside: setsAside && job.item ? { id: job.item.id, fields: job.item.fields } : null })
      showToast(`Applied. ${tickedList.map(workMonthShort).join(', ')} ${tickedList.length === 1 ? 'reads' : 'read'} as noticed on job ${job.number}.${result.setAside ? ' The waiting notice is set aside, not mailed.' : ''}`, 'success')
      onApplied({ filingId: result.filingId })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not apply the notice.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (m: string, on: boolean) => setTicked((prev) => { const next = new Set(prev); if (on) next.add(m); else next.delete(m); return next })
  const small = sheet ? '0.8125rem' : '0.72rem'
  const label: React.CSSProperties = sheet ? { ...recordSheetLabel, marginBottom: 0 } : { fontSize: '0.75rem', fontWeight: 700 }
  const tick: React.CSSProperties = sheet ? recordSheetTick : { display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.75rem', padding: '2px 0' }
  const box = sheet ? { width: 20, height: 20, flexShrink: 0 } : undefined

  const body = (
    <div data-testid="lien-notice-apply" style={{ display: 'grid', gap: sheet ? '0.85rem' : '0.45rem' }}>
      <div role="radiogroup" aria-label="Which paper went" style={{ display: 'grid', gap: sheet ? 8 : 2 }}>
        <span style={label}>Which paper went?</span>
        {papers.map((p) => {
          const words = lienPaperWords(p)
          return (
            <label key={p.key} style={tick} data-lien-apply-paper={p.key}>
              <input type="radio" name="lien-apply-paper" checked={pickedKey === p.key} onChange={() => setPickedKey(p.key)} aria-label={`The notice of ${words.head}`} style={box} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{words.head}</span>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: small }}>
                  {words.detail}
                  {p.documentUrl ? <> · <a href={p.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)' }}>saved copy ›</a></> : null}
                </span>
              </span>
            </label>
          )
        })}
        <button type="button" className="lienFootLink" onClick={onNotListed} disabled={busy} data-lien-apply-not-listed style={{ justifySelf: 'start', background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: small }}>
          It is not on this list. Record it now ›
        </button>
      </div>
      <div role="group" aria-label={`Which of job ${job.number}'s months it named`} style={{ display: 'grid', gap: sheet ? 8 : 2 }}>
        <span style={label}>Which of job {job.number}’s months did it name?</span>
        {months.length === 0 ? <span style={{ fontSize: small, color: 'var(--text-muted)' }}>The desk is not asking this job for a month.</span> : null}
        {months.map((m) => {
          const has = noticedMonths.includes(m)
          return (
            <label key={m} style={tick}>
              <input type="checkbox" checked={!has && ticked.has(m)} disabled={has} onChange={(e) => toggle(m, e.target.checked)} aria-label={`${workMonthShort(m)} ${m.slice(0, 4)}`} style={box} />
              <span style={{ flex: 1, minWidth: 0 }}>{workMonthShort(m)} {m.slice(0, 4)}{has ? ' · already has a notice' : ` · ${formatUsdNoCents(job.amount)} unpaid on the job`}</span>
            </label>
          )
        })}
      </div>
      {paper ? (
        <div data-testid="lien-apply-checks" style={{ display: 'grid', gap: 2, fontSize: small }}>
          <div style={{ color: 'var(--text-green-700)' }}>Same owner of record. Same original contractor.</div>
          {checks.refusals.map((r) => <div key={r} style={{ color: 'var(--text-red-600)' }} data-lien-apply-refusal>{r}</div>)}
          {checks.warnings.map((w) => <div key={w} style={{ color: 'var(--text-amber-800)' }} data-lien-apply-warning>{w}</div>)}
        </div>
      ) : null}
      {paper && checks.warnings.length > 0 ? (
        <label style={{ display: 'block' }}>
          <span style={sheet ? recordSheetLabel : { ...label, display: 'block', marginBottom: 2 }}>Why it stands for {tickedList.length === 1 ? workMonthShort(tickedList[0]!) : 'these months'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>kept on the record</span></span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} aria-label="Why the paper stands for the month" placeholder="Its total held this job’s unpaid bill. No new charge that month." style={sheet ? { ...recordSheetField, height: 'auto' } : { width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }} />
          {reasonProblem && reason.trim() ? <span style={{ display: 'block', fontSize: small, color: 'var(--text-red-600)' }}>{reasonProblem}</span> : null}
        </label>
      ) : null}
      {paper && checks.refusals.length === 0 ? (
        <div style={{ fontSize: small, color: 'var(--text-muted)' }} data-lien-apply-after>
          {setsAside
            ? 'The notice waiting on the desk is set aside, not mailed. It keeps its approval and signature. Undo is on this job’s filings.'
            : job.item
              ? 'The notice waiting on the desk names another month too, so it stays where it is.'
              : 'One record is written on this job. The paper’s own record is not changed. Undo is on this job’s filings.'}
        </div>
      ) : null}
    </div>
  )

  if (sheet) {
    return (
      <LienRecordSheet
        kind="notice_apply"
        title="Notice already on record"
        headline="A § 53.056 notice that already went"
        lines={[job.label, 'Pick the paper and the month. One record is written on this job, and the desk stops asking.']}
        action={{ label: lienApplyButtonWords(paper, job.number), busyLabel: 'Applying…', busy, disabled: blocked, onClick: () => void apply(), fill: '#b45309' }}
        onBack={onClose}
        onClose={onCloseWindow}
      >
        {body}
      </LienRecordSheet>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-amber-tint)', display: 'grid', gap: '0.45rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>This notice already went</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>For a paper already on record at this property. Pick it and the month it stands for. One record is written on this job, and the desk stops asking.</div>
      {body}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={onClose} disabled={busy} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', color: 'inherit' }}>Back</button>
        <button type="button" onClick={() => void apply()} disabled={busy || blocked} style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: busy || blocked ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: blocked ? 0.6 : 1 }} data-testid="lien-apply-record">
          {busy ? 'Applying…' : `${lienApplyButtonWords(paper, job.number)} ▸`}
        </button>
      </div>
    </div>
  )
}
