/**
 * The trail (punch list #129, v2.5651): the money's story on a job, read-only, for the job's people, who read no job
 * row and so never open the office's Job activity. From the money line's own read (the bills, the payments, every
 * live word) and the job's lines in Messages (`useJobMessages`, the texts, emails and calls both ways, live), on one
 * timeline newest first (`lib/bids/bidMoneyTrail.ts`), in the Pipeline sheet's shell.
 */
import { useMemo } from 'react'
import { useJobMessages } from '../../hooks/useJobMessages'
import { buildMoneyTrail, trailDayWords, TRAIL_EMPTY, type TrailItem } from '../../lib/bids/bidMoneyTrail'
import type { BidMoneyLine } from '../../lib/bids/bidMoneyLine'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'
import { loadJobMessages } from '../../lib/messages/messagesIo'
import ResponsiveModalShell from '../ResponsiveModalShell'

export interface BidMoneyTrailProps {
  line: BidMoneyLine
  onClose: () => void
  /** For a smoke: the job's lines, in place of the read. */
  loadLines?: (job: { id: string; status: string | null; createdAt: string | null }) => Promise<JobActivityMessage[]>
}

const KIND_COLOR: Record<TrailItem['kind'], string> = { bill: 'var(--text-link)', payment: 'var(--text-green-700)', word: 'var(--text-700)', line: 'var(--text-muted)' }

export function BidMoneyTrail({ line, onClose, loadLines = loadJobMessages }: BidMoneyTrailProps) {
  const lines = useJobMessages({ id: line.job.id, status: line.job.status, createdAt: line.job.createdAt }, 0, loadLines)
  const items = useMemo(() => buildMoneyTrail(line, lines), [line, lines])
  const title = `${line.job.number ? `#${line.job.number} · ` : ''}${line.job.name || 'Job'}`
  let lastDay = ''
  return (
    <ResponsiveModalShell title={title} onRequestClose={onClose} maxWidthDesktop={560}>
      <div data-bid-money-trail={line.job.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.25rem 0 0.5rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          The money's story: the bills, the payments, the customer's words and their lines, newest first.
          {lines === null ? ' Reading their lines…' : ''}
        </p>
        {items.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{TRAIL_EMPTY}</p>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {items.map((it) => {
              const day = it.ymd !== lastDay ? trailDayWords(it.ymd) : null
              lastDay = it.ymd
              return (
                <li key={it.key} data-trail-kind={it.kind}>
                  {day ? <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0.5rem 0 0.15rem' }}>{day}</div> : null}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', borderLeft: `3px solid ${it.theirs ? 'var(--border-orange)' : 'var(--border)'}`, paddingLeft: '0.5rem', background: it.theirs ? 'var(--bg-orange-tint)' : 'transparent', borderRadius: '0 6px 6px 0' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: it.theirs ? 'var(--text-orange-700)' : KIND_COLOR[it.kind], whiteSpace: 'nowrap' }}>{it.who}</span>
                    <span style={{ fontSize: '0.8125rem', overflowWrap: 'anywhere', color: 'var(--text-base)' }}>
                      {it.href ? (
                        <>
                          {it.words.replace(/ · pay page$/, '')}{' · '}
                          <a href={it.href} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)' }}>
                            pay page
                          </a>
                        </>
                      ) : (
                        it.words
                      )}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
