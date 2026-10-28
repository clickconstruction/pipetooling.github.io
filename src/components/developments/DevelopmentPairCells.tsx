/**
 * Pairing in the row (punch list #208, design spike, the owner's pick of 2026-10-28: *a toggle, and
 * when it is on it should look like B*). With the toggle on, the Pieces table stays and its gaps
 * become the tool: an unpaired job's Bid cell reads *no bid here · came from…*, an unpaired bid's Job
 * cell reads *no job yet · became…*, the likely one is already in the cell with Pair, and a paired
 * row's bid cell has Unpair. One line above the table counts the likely pairs and carries the
 * counted press. The picker is a small sheet in the cell with a search line, never a native select.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { countedLabel } from '../../lib/batchWords'
import { BID_STATUS_COLOR, bidMoney, bidStatusWord, type MemberBid, type MemberJob } from '../../lib/developments/overview'
import { suggestionConfidence, suggestionWhy, type PairSuggestion } from '../../lib/developments/pairing'
import { labelJobsLedgerStatusForDashboard } from '../../lib/jobsLedgerStatusPipeline'
import { Chip, LinkButton, money, SmallButton } from './developmentPageBits'

/** What the Pieces table needs to draw the pairing in its rows. */
export type PairingProps = {
  on: boolean
  suggestions: PairSuggestion[]
  unpairedBids: MemberBid[]
  unpairedJobs: MemberJob[]
  /** Bids that already have a job, for the picker's second section (a second job from one bid). */
  pairedBids: Array<{ bid: MemberBid; jobLabels: string[] }>
  busy: boolean
  onPair: (bidId: string, jobId: string) => void
  onUnpair: (jobId: string, bidId: string) => void
  onNotThese: (s: PairSuggestion) => void
  /** *It came from no bid*: hides the prompt on that job's row on this device. */
  onNoBid: (jobId: string) => void
  hiddenJobIds: ReadonlySet<string>
  /** The strip's counted press: every likely pair still on the list, one write each. */
  onPairAll: () => void
  /** The strip's Not these: every likely pair off the list on this device. */
  onNotAll: () => void
  /** Backfill (draft B of backfill-mockup.html): the sheet that makes the bid a job came from, born won, and pairs it. */
  onMakeBid: (job: MemberJob) => void
  /** New Job from this bid, prefilled, which pairs on save. */
  onMakeJob: (bid: MemberBid) => void
}

type PickItem = { id: string; label: string; name: string; meta: string; chip?: { label: string; color: string; soft?: boolean }; likely?: 'likely' | 'maybe' }
type PickSection = { title: string; items: PickItem[] }

/** The sheet in the cell: a search line, the sections, a press per row. Closes on Escape or a press outside. */
function RecordPicker({ sections, onPick, onClose, foot }: { sections: PickSection[]; onPick: (id: string) => void; onClose: () => void; foot?: ReactNode }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])
  const needle = q.trim().toLowerCase()
  const hit = (i: PickItem) => !needle || `${i.label} ${i.name}`.toLowerCase().includes(needle)
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pick a record"
      data-testid="record-picker"
      style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, marginTop: 4, width: 'min(380px, 90vw)', maxHeight: 340, overflow: 'auto', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', boxShadow: '0 6px 18px rgba(0,0,0,.12)', padding: '6px 0', fontSize: '0.82rem', fontWeight: 400 }}
    >
      <div style={{ padding: '2px 8px 6px' }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Number or name"
          aria-label="Search"
          style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
      </div>
      {sections.map((s) => {
        const items = s.items.filter(hit)
        if (items.length === 0) return null
        return (
          <div key={s.title}>
            <div style={{ padding: '2px 10px', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{s.title}</div>
            {items.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onPick(i.id)}
                style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', padding: '4px 10px', border: 'none', background: i.likely ? 'var(--bg-amber-tint)' : 'transparent', font: 'inherit', color: 'var(--text-strong)', cursor: 'pointer' }}
              >
                <span style={{ color: 'var(--text-link)', fontWeight: 700, whiteSpace: 'nowrap' }}>{i.label}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                {i.chip ? <Chip label={i.chip.label} color={i.chip.color} soft={i.chip.soft} /> : null}
                {i.likely ? <Chip label={i.likely === 'likely' ? 'likely match' : 'possible match'} color={i.likely === 'likely' ? '#d97706' : '#9ca3af'} soft /> : null}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.76rem' }}>{i.meta}</span>
              </button>
            ))}
          </div>
        )
      })}
      {sections.every((s) => s.items.filter(hit).length === 0) ? <div style={{ padding: '4px 10px', color: 'var(--text-faint)' }}>Nothing matches.</div> : null}
      {foot ? <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, padding: '6px 10px' }}>{foot}</div> : null}
    </div>
  )
}

function bidItem(b: MemberBid, label: string, names: ReadonlyMap<string, string>, likely?: 'likely' | 'maybe'): PickItem {
  const status = bidStatusWord(b)
  const value = bidMoney(b)
  const est = b.estimator_id ? names.get(b.estimator_id) : null
  return { id: b.id, label, name: (b.project_name ?? '').trim() || '—', meta: `${value != null ? money(value) : 'no price'}${est ? ` · ${est}` : ''}`, chip: { label: status, color: BID_STATUS_COLOR[status], soft: status === 'archived' || status === 'working' }, likely }
}

function jobItem(j: MemberJob, label: string, likely?: 'likely' | 'maybe'): PickItem {
  return { id: j.id, label, name: (j.job_name ?? '').trim() || '—', meta: `${labelJobsLedgerStatusForDashboard(j.status)} · ${j.revenue ? money(j.revenue) : '$0'}`, likely }
}

/** A small press in a gap cell: every action in pair mode is this one shape, so the rows line up. */
function GapButton({ onClick, children, primary, disabled, title, testId }: { onClick: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean; title?: string; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      style={{
        // Small, as the owner asked (2026-10-28): four of these fit a cell's row.
        height: 20,
        padding: '0 6px',
        border: `1px solid ${primary ? 'var(--text-link)' : 'var(--border-strong)'}`,
        borderRadius: 4,
        background: primary ? 'var(--text-link)' : 'var(--bg-subtle)',
        color: primary ? '#fff' : 'var(--text-700)',
        font: 'inherit',
        fontSize: '0.66rem',
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  )
}

/**
 * The gap cell's one shape (the owner, 2026-10-28: *it could look more uniform*): the first row is
 * the likely one by name with Pair and not this, or the quiet empty words; the second row is the two
 * actions as matching small presses, in the same place on every row.
 */
function GapCell({ empty, suggestion, actions, picker, testId }: { empty: string; suggestion: React.ReactNode | null; actions: React.ReactNode; picker: React.ReactNode; testId: string }) {
  return (
    <div style={{ position: 'relative', display: 'grid', gap: 4, minWidth: 0 }} data-testid={testId}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, minHeight: 20 }}>{suggestion ?? <span style={{ color: 'var(--text-faint)' }}>{empty}</span>}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div>
      {picker}
    </div>
  )
}

/** The chip's words (the owner's picks, 2026-10-28): *likely match* and *possible match*. */
function confidenceWords(s: PairSuggestion): { label: string; color: string } {
  return suggestionConfidence(s) === 'likely' ? { label: 'likely match', color: '#d97706' } : { label: 'possible match', color: '#9ca3af' }
}

/** The likely one's line: the chip, the record, the reason. One line, the name cut with an ellipsis. */
function SuggestionLine({ s, label, name }: { s: PairSuggestion; label: string; name: string }) {
  const chip = confidenceWords(s)
  return (
    <>
      <Chip label={chip.label} color={chip.color} soft />
      <span style={{ color: 'var(--text-link)', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-strong)' }} title={`${name} · ${suggestionWhy(s)}`}>
        {name}
      </span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{suggestionWhy(s)}</span>
    </>
  )
}

/** The likely one's two presses, drawn on the actions row with the rest: *Not a match* and *Pair with J…* (the owner's picks, 2026-10-28). */
function SuggestionPresses({ withLabel, onPair, onNotThis, busy }: { withLabel: string; onPair: () => void; onNotThis: () => void; busy: boolean }) {
  return (
    <>
      <GapButton onClick={onNotThis} disabled={busy} title="Takes this pair off the list on this device">
        Not a match
      </GapButton>
      <GapButton onClick={onPair} disabled={busy} primary title="Writes the job's bid link, nothing else">
        Pair {withLabel}
      </GapButton>
    </>
  )
}

/** The Bid cell of an unpaired job's row in pair mode: the likely bid with Pair, then *came from…* and *make the bid*. */
export function CameFromCell({ job, pairing, bidLabel, names }: { job: MemberJob; pairing: PairingProps; bidLabel: (b: MemberBid) => string; names: ReadonlyMap<string, string> }) {
  const [open, setOpen] = useState(false)
  const s = pairing.suggestions.find((x) => x.jobId === job.id) ?? null
  const likelyBid = s ? pairing.unpairedBids.find((b) => b.id === s.bidId) ?? null : null
  if (pairing.hiddenJobIds.has(job.id)) {
    return (
      <span style={{ color: 'var(--text-faint)' }}>
        no bid here · <LinkButton onClick={() => pairing.onNoBid(job.id)}>ask again</LinkButton>
      </span>
    )
  }
  const sections: PickSection[] = [
    { title: 'Bids on this site with no job yet', items: pairing.unpairedBids.map((b) => bidItem(b, bidLabel(b), names, s && s.bidId === b.id ? suggestionConfidence(s) : undefined)).sort((a, b) => (a.likely ? -1 : 0) - (b.likely ? -1 : 0)) },
    { title: 'Bids that already have a job', items: pairing.pairedBids.map(({ bid, jobLabels }) => ({ ...bidItem(bid, bidLabel(bid), names), meta: `→ ${jobLabels.join(', ')} · a second job` })) },
  ]
  return (
    <GapCell
      testId="came-from-cell"
      empty="no bid here"
      suggestion={s && likelyBid ? <SuggestionLine s={s} label={bidLabel(likelyBid)} name={(likelyBid.project_name ?? '').trim()} /> : null}
      actions={
        <>
          <GapButton onClick={() => setOpen((v) => !v)} title="Pick the bid this job came from">
            Pick the bid…
          </GapButton>
          <GapButton onClick={() => pairing.onMakeBid(job)} title="The bid is not in the app: make it from what the job knows, born won, and pair it">
            New bid from job
          </GapButton>
          {s && likelyBid ? <SuggestionPresses withLabel={bidLabel(likelyBid)} onPair={() => pairing.onPair(likelyBid.id, job.id)} onNotThis={() => pairing.onNotThese(s)} busy={pairing.busy} /> : null}
        </>
      }
      picker={
        open ? (
          <RecordPicker
            sections={sections}
            onPick={(bidId) => {
              setOpen(false)
              pairing.onPair(bidId, job.id)
            }}
            onClose={() => setOpen(false)}
            foot={
              <LinkButton
                onClick={() => {
                  setOpen(false)
                  pairing.onNoBid(job.id)
                }}
              >
                It came from no bid · hide this
              </LinkButton>
            }
          />
        ) : null
      }
    />
  )
}

/** The Job cell of an unpaired bid's row in pair mode: the likely job with Pair, then *became…* and *make the job*. */
export function BecameCell({ bid, pairing, jobLabel }: { bid: MemberBid; pairing: PairingProps; jobLabel: (j: MemberJob) => string }) {
  const [open, setOpen] = useState(false)
  const s = pairing.suggestions.find((x) => x.bidId === bid.id) ?? null
  const likelyJob = s ? pairing.unpairedJobs.find((j) => j.id === s.jobId) ?? null : null
  const sections: PickSection[] = [{ title: 'Jobs on this site with no bid', items: pairing.unpairedJobs.map((j) => jobItem(j, jobLabel(j), s && s.jobId === j.id ? suggestionConfidence(s) : undefined)).sort((a, b) => (a.likely ? -1 : 0) - (b.likely ? -1 : 0)) }]
  return (
    <GapCell
      testId="became-cell"
      empty="no job yet"
      suggestion={s && likelyJob ? <SuggestionLine s={s} label={jobLabel(likelyJob)} name={(likelyJob.job_name ?? '').trim()} /> : null}
      actions={
        <>
          <GapButton onClick={() => setOpen((v) => !v)} title="Pick the job this bid became">
            Pick the job…
          </GapButton>
          <GapButton onClick={() => pairing.onMakeJob(bid)} title="New Job from this bid: the customer, address, development and budget copy come across, and saving pairs it">
            New job from bid
          </GapButton>
          {s && likelyJob ? <SuggestionPresses withLabel={jobLabel(likelyJob)} onPair={() => pairing.onPair(bid.id, likelyJob.id)} onNotThis={() => pairing.onNotThese(s)} busy={pairing.busy} /> : null}
        </>
      }
      picker={
        open ? (
          <RecordPicker
            sections={sections}
            onPick={(jobId) => {
              setOpen(false)
              pairing.onPair(bid.id, jobId)
            }}
            onClose={() => setOpen(false)}
          />
        ) : null
      }
    />
  )
}

/** The strip above the table in pair mode: the likely pairs by name as line items, each with its own Pair and not this, the counted press for all. */
export function PairStrip({ pairing, bidLabel, jobLabel, names }: { pairing: PairingProps; bidLabel: (b: MemberBid) => string; jobLabel: (j: MemberJob) => string; names: ReadonlyMap<string, string> }) {
  const kept = pairing.suggestions
  const lines = kept
    .map((s) => {
      const b = pairing.unpairedBids.find((x) => x.id === s.bidId)
      const j = pairing.unpairedJobs.find((x) => x.id === s.jobId)
      return b && j ? { s, b, j } : null
    })
    .filter((x): x is { s: PairSuggestion; b: MemberBid; j: MemberJob } => x !== null)
  return (
    <div style={{ display: 'grid', gap: 6, padding: '8px 10px', marginBottom: 10, borderRadius: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--bg-amber-200)', fontSize: '0.84rem' }} data-testid="pair-strip">
      {lines.length > 0 ? (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-amber-800)' }}>{lines.length === 1 ? '1 likely pair by name' : `${lines.length} likely pairs by name`}</strong>
            <span style={{ color: 'var(--text-muted)' }}>Likely, not decided: you decide.</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
              <SmallButton onClick={pairing.onPairAll} disabled={pairing.busy} primary title="Pairs every likely pair still on the list, one write each">
                {countedLabel('Pair the', lines.length)}
              </SmallButton>
              <SmallButton onClick={pairing.onNotAll} disabled={pairing.busy} title="Takes every likely pair off the list on this device">
                Not these
              </SmallButton>
            </span>
          </div>
          {lines.map(({ s, b, j }) => {
            const status = bidStatusWord(b)
            const value = bidMoney(b)
            const est = b.estimator_id ? names.get(b.estimator_id) : null
            return (
              <div key={`${s.bidId}:${s.jobId}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 24px minmax(0, 1fr) auto', gap: 8, alignItems: 'center', padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} data-testid="pair-line">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{bidLabel(b)}</span>
                    <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(b.project_name ?? '').trim() || '—'}</span>
                    <Chip label={status} color={BID_STATUS_COLOR[status]} soft={status === 'archived' || status === 'working'} />
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {value != null ? money(value) : 'no price yet'}
                    {est ? ` · ${est}` : ''}
                  </div>
                </div>
                <span aria-hidden style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                  ↔
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>{jobLabel(j)}</span>
                    <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(j.job_name ?? '').trim() || '—'}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{labelJobsLedgerStatusForDashboard(j.status)}</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{j.revenue ? money(j.revenue) : '$0'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Chip label={confidenceWords(s).label} color={confidenceWords(s).color} soft />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{suggestionWhy(s)}</span>
                  <SmallButton onClick={() => pairing.onNotThese(s)} disabled={pairing.busy} title="Takes this pair off the list on this device">
                    Not a match
                  </SmallButton>
                  <SmallButton onClick={() => pairing.onPair(s.bidId, s.jobId)} disabled={pairing.busy} primary title="Writes the job's bid link, nothing else">
                    Pair {bidLabel(b)} with {jobLabel(j)}
                  </SmallButton>
                </div>
              </div>
            )
          })}
        </>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>
          No likely pairs by name. Use <strong>Pick the bid…</strong> on a job's row or <strong>Pick the job…</strong> on a bid's. A pair writes the job's bid link and nothing else; Unpair clears it.
        </span>
      )}
    </div>
  )
}
