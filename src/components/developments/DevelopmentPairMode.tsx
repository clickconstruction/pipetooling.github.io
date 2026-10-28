/**
 * Pair mode on the Pieces card (punch list #208, design spike, the owner's ask): the site's unpaired
 * bids on the left and unpaired jobs on the right, the suggestions by shared words on top as rows
 * with Pair and Not these, a counted press for the ones kept, and pick-one-each-side with a button
 * that names the pair. On a phone one list: pick a bid, then a job, the same button. No drag.
 */
import { useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { countedLabel } from '../../lib/batchWords'
import { BID_STATUS_COLOR, bidMoney, bidStatusWord, type MemberBid, type MemberJob } from '../../lib/developments/overview'
import { suggestionConfidence, suggestionWhy, type PairSuggestion } from '../../lib/developments/pairing'
import { labelJobsLedgerStatusForDashboard } from '../../lib/jobsLedgerStatusPipeline'
import { Chip, LinkButton, money, shortDay, SmallButton } from './developmentPageBits'
import { DEVELOPMENT_PHONE_QUERY } from './DevelopmentJumpStrip'

export type PairModeProps = {
  bids: MemberBid[]
  jobs: MemberJob[]
  suggestions: PairSuggestion[]
  bidLabel: (b: MemberBid) => string
  jobLabel: (j: MemberJob) => string
  names: ReadonlyMap<string, string>
  busy: boolean
  onPair: (bidId: string, jobId: string) => void
  onPairMany: (pairs: Array<{ bidId: string; jobId: string }>) => void
  onNotThese: (s: PairSuggestion) => void
  onDone: () => void
}

function PickRow({ picked, onPick, children }: { picked: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        border: `1px solid ${picked ? 'var(--text-link)' : 'var(--border)'}`,
        borderRadius: 6,
        background: picked ? 'var(--bg-blue-tint)' : 'var(--surface)',
        font: 'inherit',
        color: 'var(--text-strong)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export function DevelopmentPairMode(p: PairModeProps) {
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  const [bidId, setBidId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const bidById = new Map(p.bids.map((b) => [b.id, b]))
  const jobById = new Map(p.jobs.map((j) => [j.id, j]))
  const pickedBid = bidId ? bidById.get(bidId) ?? null : null
  const pickedJob = jobId ? jobById.get(jobId) ?? null : null
  const pairLabel = pickedBid && pickedJob ? `Pair ${p.bidLabel(pickedBid)} with ${p.jobLabel(pickedJob)}` : pickedBid ? `Pair ${p.bidLabel(pickedBid)} with…` : pickedJob ? `Pair … with ${p.jobLabel(pickedJob)}` : 'Pick a bid and a job'

  const bidLine = (b: MemberBid) => {
    const status = bidStatusWord(b)
    const value = bidMoney(b)
    const est = b.estimator_id ? p.names.get(b.estimator_id) : null
    return (
      <>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--text-link)' }}>{p.bidLabel(b)}</strong>
          <span style={{ fontWeight: 600 }}>{(b.project_name ?? '').trim() || '—'}</span>
          <Chip label={status} color={BID_STATUS_COLOR[status]} soft={status === 'off the board' || status === 'working'} />
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          {value != null ? money(value) : 'no price yet'}
          {est ? ` · ${est}` : ''}
          {b.bid_date_sent ? ` · sent ${shortDay(b.bid_date_sent)}` : b.created_at ? ` · made ${shortDay(b.created_at)}` : ''}
        </div>
      </>
    )
  }
  const jobLine = (j: MemberJob) => (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-link)' }}>{p.jobLabel(j)}</strong>
        <span style={{ fontWeight: 600 }}>{(j.job_name ?? '').trim() || '—'}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{labelJobsLedgerStatusForDashboard(j.status)}</span>
      </div>
      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        {j.revenue ? money(j.revenue) : '$0'}
        {j.created_at ? ` · made ${shortDay(j.created_at)}` : ''}
        {j.last_work_date ? ` · last work ${shortDay(j.last_work_date)}` : ''}
      </div>
    </>
  )

  const kept = p.suggestions
  const bidsList = (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        Bids with no job yet · {p.bids.length}
      </div>
      {p.bids.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>Every bid here has its job.</span> : null}
      {p.bids.map((b) => (
        <PickRow key={b.id} picked={bidId === b.id} onPick={() => setBidId(bidId === b.id ? null : b.id)}>
          {bidLine(b)}
        </PickRow>
      ))}
    </div>
  )
  const jobsList = (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        Jobs with no bid · {p.jobs.length}
      </div>
      {p.jobs.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>Every job here came from a bid.</span> : null}
      {p.jobs.map((j) => (
        <PickRow key={j.id} picked={jobId === j.id} onPick={() => setJobId(jobId === j.id ? null : j.id)}>
          {jobLine(j)}
        </PickRow>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 12 }} data-testid="pair-mode">
      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
        A bid is paired with the job it became. The suggestions read the names for shared words, then a matching value and the dates. They are likely, not decided: you decide.
      </p>

      {kept.length > 0 ? (
        <div style={{ border: '1px solid var(--bg-amber-200)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 6 }} data-testid="pair-suggestions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-amber-800)', fontSize: '0.84rem' }}>
              {kept.length === 1 ? '1 likely pair' : `${kept.length} likely pairs`}
            </strong>
            <span style={{ marginLeft: 'auto' }}>
              <SmallButton onClick={() => p.onPairMany(kept.map((s) => ({ bidId: s.bidId, jobId: s.jobId })))} disabled={p.busy || kept.length === 0} primary title="Pairs every suggestion still on the list, one write each">
                {`${countedLabel('Pair the', kept.length)} you kept`}
              </SmallButton>
            </span>
          </div>
          {kept.map((s) => {
            const b = bidById.get(s.bidId)
            const j = jobById.get(s.jobId)
            if (!b || !j) return null
            return (
              <div key={`${s.bidId}:${s.jobId}`} style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 24px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} data-testid="pair-suggestion">
                <div>{bidLine(b)}</div>
                {!phone ? (
                  <span aria-hidden style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                    ↔
                  </span>
                ) : null}
                <div>{jobLine(j)}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip label={suggestionConfidence(s)} color={suggestionConfidence(s) === 'likely' ? '#d97706' : '#9ca3af'} soft />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{suggestionWhy(s)}</span>
                  <SmallButton onClick={() => p.onPair(s.bidId, s.jobId)} disabled={p.busy} primary>
                    Pair
                  </SmallButton>
                  <SmallButton onClick={() => p.onNotThese(s)} disabled={p.busy} title="Takes this pair off the list on this device">
                    Not these
                  </SmallButton>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint)' }}>No likely pairs by name. Pick one on each side.</p>
      )}

      {phone ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {pickedBid ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bid picked</div>
              <PickRow picked onPick={() => setBidId(null)}>
                {bidLine(pickedBid)}
              </PickRow>
              <LinkButton onClick={() => setBidId(null)}>Pick another bid</LinkButton>
            </div>
          ) : (
            bidsList
          )}
          {pickedBid ? jobsList : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
          {bidsList}
          {jobsList}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'sticky', bottom: 0, padding: '8px 0', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <SmallButton
          onClick={() => {
            if (pickedBid && pickedJob) {
              p.onPair(pickedBid.id, pickedJob.id)
              setBidId(null)
              setJobId(null)
            }
          }}
          disabled={!pickedBid || !pickedJob || p.busy}
          primary
          title="Writes the job's bid link, nothing else"
        >
          {pairLabel}
        </SmallButton>
        <span style={{ marginLeft: 'auto' }}>
          <SmallButton onClick={p.onDone} disabled={p.busy}>
            Done pairing
          </SmallButton>
        </span>
      </div>
    </div>
  )
}
