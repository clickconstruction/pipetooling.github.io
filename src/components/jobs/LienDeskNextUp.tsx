import type { CSSProperties } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { groupLienNextUp, type LienNextUpKind, type LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { LIEN_JOB_DOOR_TITLE } from './LienJobNumber'

/**
 * The Lien desk's Do now tab (Next up until v2.4630; punch list #82, PR 2): every lien paper that asks for an act,
 * in deadline order, one button a row. The list is `lienNextUp.ts`; this draws it. A button
 * (or a press on the row) hands the row back to the desk, which opens the pane that already
 * does the work. Nothing is written here.
 *
 * A table on a computer; the same rows as cards on a phone.
 */

const KIND_WORDS: Record<LienNextUpKind, string> = { notice: 'Notice', affidavit: 'Affidavit', retainage: 'Retainage' }
const KIND_TONE: Record<LienNextUpKind, { bg: string; fg: string }> = {
  notice: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' },
  affidavit: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
  retainage: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
}

const tag = (kind: LienNextUpKind): CSSProperties => ({ display: 'inline-block', padding: '0 7px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap', background: KIND_TONE[kind].bg, color: KIND_TONE[kind].fg })
const actBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const openBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }

/** "Oct 15 · 10 days left", "Oct 1 · 4 days late", "Oct 5 · today"; empty with no day. */
export function lienNextUpDueWords(r: Pick<LienNextUpRow, 'dueOn' | 'daysLeft'>): string {
  if (!r.dueOn || r.daysLeft == null) return ''
  const day = formatYmdMonthDay(r.dueOn)
  if (r.daysLeft < 0) return `${day} · ${-r.daysLeft} ${r.daysLeft === -1 ? 'day' : 'days'} late`
  if (r.daysLeft === 0) return `${day} · today`
  return `${day} · ${r.daysLeft} ${r.daysLeft === 1 ? 'day' : 'days'} left`
}

function dueColor(r: LienNextUpRow): string {
  if (r.daysLeft != null && r.daysLeft < 0) return 'var(--text-red-600)'
  return r.severity === 'red' ? 'var(--text-red-600)' : r.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)'
}

export default function LienDeskNextUp({
  rows,
  loading,
  isMobile,
  onAct,
  onOpenJob,
}: {
  rows: ReadonlyArray<LienNextUpRow>
  loading: boolean
  isMobile: boolean
  onAct: (row: LienNextUpRow) => void
  /** The job's number and name as a door to the Job window (v2.4628); a GC's run row has no job and stays plain. */
  onOpenJob?: (jobId: string) => void
}) {
  if (loading) return <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
  const groups = groupLienNextUp(rows)
  if (groups.length === 0) {
    return (
      <div data-lien-next-up="empty" style={{ padding: '2rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Nothing needs you right now. Every lien paper is sent, filed or waiting on its day. The Deadlines tab shows what is coming.
      </div>
    )
  }
  // The title: a text door to the job when there is one, underlined on hover (`.lienJobDoor`); the click stops here, so the row keeps its own.
  const title = (r: LienNextUpRow, style: CSSProperties) => {
    const jobId = r.jobId
    if (!jobId || !onOpenJob) return <span style={style} title={r.title}>{r.title}</span>
    return (
      <button
        type="button"
        className="lienJobDoor"
        data-testid={`lien-next-up-job-${jobId}`}
        title={LIEN_JOB_DOOR_TITLE}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenJob(jobId)
        }}
        style={{ ...style, border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderRadius: 3, minWidth: 0, maxWidth: '100%', ...(isMobile ? { minHeight: 28 } : null) }}
      >
        {r.title}
      </button>
    )
  }
  const button = (r: LienNextUpRow) => (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation()
        onAct(r)
      }}
      style={{ ...(r.button ? actBtn : openBtn), ...(isMobile ? { width: '100%', padding: '9px 12px', fontSize: '0.9rem' } : {}) }}
      data-lien-next-up-act={r.action}
    >
      {r.button ?? 'Open'}
    </button>
  )
  return (
    <div data-lien-next-up="list" style={{ overflowY: 'auto', minHeight: 0, padding: isMobile ? '0.6rem 0.75rem 1rem' : '0.75rem 1.25rem 1.25rem' }}>
      {groups.map((g) => (
        <section key={g.group} aria-label={g.label} data-lien-next-up-group={g.group} style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: g.group === 'now' ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
            {g.label} · {g.rows.length}
          </h3>
          <div style={{ display: 'grid', gap: isMobile ? 8 : 0, border: isMobile ? 'none' : '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            {g.rows.map((r, i) => {
              const due = lienNextUpDueWords(r)
              return isMobile ? (
                <div key={r.key} data-lien-next-up-row={r.key} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.7rem', display: 'grid', gap: 6, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={tag(r.kind)}>{KIND_WORDS[r.kind]}</span>
                    {due ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: dueColor(r) }}>{due}</span> : null}
                  </div>
                  <div>{title(r, { fontWeight: 700, fontSize: '0.92rem', overflowWrap: 'anywhere', whiteSpace: 'normal' })}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                  {button(r)}
                </div>
              ) : (
                <div
                  key={r.key}
                  data-lien-next-up-row={r.key}
                  onClick={() => onAct(r)}
                  style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1.2fr) minmax(0, 1.4fr) 170px auto', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.8rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.8125rem' }}
                >
                  <span><span style={tag(r.kind)}>{KIND_WORDS[r.kind]}</span></span>
                  <span style={{ minWidth: 0, overflow: 'hidden' }}>{title(r, { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' })}</span>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sub}>{r.sub}</span>
                  <span style={{ fontWeight: 600, color: dueColor(r), whiteSpace: 'nowrap' }}>{due}</span>
                  <span style={{ justifySelf: 'end' }}>{button(r)}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
