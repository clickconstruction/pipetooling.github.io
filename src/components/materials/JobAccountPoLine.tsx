import { useState, type CSSProperties } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { useJobAccountStrips } from '../../hooks/useJobAccountStrips'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { poMomentLine, telHref, openJobAccountCloseNote } from '../../lib/jobs/jobAccountStrip'
import { closeOpenJobAccountRequests } from '../../lib/jobs/openJobAccountDispatchRequest'
import { MarkJobAccountOpenedModal } from './MarkJobAccountOpenedModal'

const TONES: Record<'amber' | 'teal' | 'muted', CSSProperties> = {
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' },
  teal: { background: '#ccfbf1', color: '#0f766e', border: '1px solid #0f766e55' },
  muted: { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
}

/**
 * The PO moment (v2.3426): the status line under the supply house pick in
 * both PO Generators. Job and house named, parts about to be bought — the
 * natural place for "reach Curly before ordering". Never blocks the code.
 * Amber with Call · Mark opened… · Send the packet · Not needed when there is
 * no account; teal with the reference once there is.
 */
export function JobAccountPoLine({
  jobId,
  jobLabel,
  houseId,
  compact = false,
}: {
  jobId: string
  jobLabel: string
  houseId: string
  compact?: boolean
}) {
  const { user: authUser } = useAuth()
  const jobDetailModal = useJobDetailModal()
  const strips = useJobAccountStrips([jobId])
  const entry = strips.byJob.get(jobId)?.find((e) => e.houseId === houseId) ?? null
  const line = poMomentLine(entry, jobLabel)
  const [sheet, setSheet] = useState<'open' | 'not_needed' | null>(null)
  if (!entry || !line) return null
  const tel = telHref(entry.rep?.phone)

  const btn: CSSProperties = {
    padding: compact ? '0.3rem 0.6rem' : '0.25rem 0.6rem',
    fontSize: '0.75rem',
    borderRadius: 5,
    border: '1px solid currentColor',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <div data-job-account-po-line={entry.state} style={{ ...TONES[line.tone], borderRadius: 8, padding: '0.5rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8125rem', marginTop: '0.5rem', textAlign: 'left' }}>
      <span>{line.text}</span>
      {line.canCall || line.canMarkOpened || line.canSendPacket || line.canNotNeeded ? (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {line.canCall && tel && entry.rep ? (
            <a href={tel} style={btn}>Call {entry.rep.name.split(' ')[0]}</a>
          ) : null}
          {line.canMarkOpened ? (
            <button type="button" onClick={() => setSheet('open')} style={{ ...btn, background: '#0f766e', borderColor: '#0f766e', color: 'white' }}>
              Mark opened…
            </button>
          ) : null}
          {line.canSendPacket && jobDetailModal ? (
            <button type="button" onClick={() => jobDetailModal.openJobDetail({ jobId, openSupplyHouseShare: true })} style={btn} title="Open the job with the Share-with-supply-house email on top">
              Send the packet
            </button>
          ) : null}
          {line.canNotNeeded ? (
            <button type="button" onClick={() => setSheet('not_needed')} style={{ ...btn, border: 'none', fontWeight: 500, textDecoration: 'underline dotted' }}>
              Not needed for this job
            </button>
          ) : null}
        </span>
      ) : null}
      {sheet ? (
        <MarkJobAccountOpenedModal
          jobId={jobId}
          jobLabel={jobLabel}
          house={{ id: entry.houseId, name: entry.houseName }}
          existing={null}
          reps={entry.rep ? [{ id: entry.rep.id, name: entry.rep.name, email: '', phone: entry.rep.phone }] : []}
          initialMode={sheet}
          onClose={() => setSheet(null)}
          onSaved={(row) => {
            setSheet(null)
            strips.reload()
            if (entry.state === 'requested' && authUser?.id) {
              void closeOpenJobAccountRequests(jobId, authUser.id, openJobAccountCloseNote(entry.houseName, row.status === 'not_needed' ? 'not_needed' : 'open', row.account_ref))
            }
          }}
        />
      ) : null}
    </div>
  )
}
