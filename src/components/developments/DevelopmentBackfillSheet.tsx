/**
 * The backfill sheet (punch list #208, design spike, draft B of `backfill-mockup.html`): *Make the
 * bid J887 came from*. The few facts a bid needs and the app is guessing sit on top, each with where
 * it came from, editable; the rest copies as it is. One press makes the bid, born won, and pairs it.
 */
import { useEffect, useState } from 'react'
import type { MemberJob } from '../../lib/developments/overview'
import { money, SmallButton } from './developmentPageBits'

export type BackfillSheetValues = { projectName: string; wonFor: number | null; wonOn: string | null }

export function DevelopmentBackfillSheet({
  job,
  jobLabel,
  developmentName,
  customerName,
  estimatorName,
  busy,
  onMake,
  onClose,
}: {
  job: MemberJob
  jobLabel: string
  developmentName: string
  customerName: string | null
  /** The job's account man, who the bid will name as its estimator; null leaves the bid with none. */
  estimatorName: string | null
  busy: boolean
  onMake: (v: BackfillSheetValues) => void
  onClose: () => void
}) {
  const [projectName, setProjectName] = useState((job.job_name ?? '').trim())
  const [wonFor, setWonFor] = useState<string>(job.revenue != null && job.revenue > 0 ? String(job.revenue) : '')
  const firstDay = (job.last_work_date ?? job.created_at ?? '').slice(0, 10)
  const [wonOn, setWonOn] = useState<string>(firstDay)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const field = (label: string, control: React.ReactNode, from: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center', fontSize: '0.86rem' }}>
      <label style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {control}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{from}</span>
      </div>
    </div>
  )
  const inputStyle: React.CSSProperties = { flex: 1, minWidth: 0, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }
  const wonForNumber = wonFor.trim() === '' ? null : Number(wonFor)
  const canMake = projectName.trim() !== '' && (wonForNumber === null || Number.isFinite(wonForNumber)) && !busy
  return (
    <div role="dialog" aria-modal="true" aria-label={`Make the bid ${jobLabel} came from`} data-testid="backfill-sheet" style={{ position: 'fixed', inset: 0, zIndex: 760, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 'min(560px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.14)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.98rem', color: 'var(--text-strong)' }}>Make the bid {jobLabel} came from</strong>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>a bid, born won, paired with {jobLabel}</span>
        </div>
        <div style={{ padding: '10px 14px', display: 'grid', gap: 8 }}>
          {field('Name', <input value={projectName} onChange={(e) => setProjectName(e.target.value)} style={inputStyle} aria-label="Bid name" />, 'from the job')}
          {field('Won for', <input value={wonFor} onChange={(e) => setWonFor(e.target.value)} inputMode="decimal" placeholder="no value" style={inputStyle} aria-label="Won for" />, job.revenue ? `the job's revenue, ${money(job.revenue)}` : 'the job has no revenue')}
          {field('Won on', <input type="date" value={wonOn} onChange={(e) => setWonOn(e.target.value)} style={inputStyle} aria-label="Won on" />, job.last_work_date ? "the job's last work day" : "the job's first day")}
          {field('Estimator', <span style={{ ...inputStyle, background: 'var(--bg-subtle)' }}>{estimatorName ?? '—'}</span>, estimatorName ? "the job's account man" : 'none on the job')}
          {field(
            'Copied as is',
            <span style={{ ...inputStyle, background: 'var(--bg-subtle)', color: 'var(--text-700)' }}>
              {[customerName, (job.job_address ?? '').trim() || null, developmentName].filter(Boolean).join(' · ')} · the job's trade
            </span>,
            '',
          )}
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            It lands on the Bid Board as won and in {developmentName}, with no sent date, no plans and no counts, and a note saying it was made from {jobLabel}. Change any of it later on the Bid window's Edit tab.
          </p>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SmallButton onClick={() => onMake({ projectName: projectName.trim(), wonFor: wonForNumber, wonOn: wonOn || null })} disabled={!canMake} primary title="Makes the bid and writes the job's bid link">
            Make the bid and pair it
          </SmallButton>
          <span style={{ marginLeft: 'auto' }}>
            <SmallButton onClick={onClose} disabled={busy}>
              Cancel
            </SmallButton>
          </span>
        </div>
      </div>
    </div>
  )
}
