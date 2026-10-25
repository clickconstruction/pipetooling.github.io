/**
 * The Collect desk (punch list #177, PR B, v2.5853): the modal behind the
 * Bridge's Collect card. The pile by where each bill stands against its
 * payer's own pace, the three tiles, the bar and its legend, the payers that
 * hold the pile with where each stands, everyone else as one line, what
 * slows Collect folded under one line, and the footnote on how it reads.
 * The moves, the owner's decisions and the call record come in PR C. Pure
 * on its props: the page reads, the kernels under `src/lib/bridge/collect`
 * do the arithmetic and the words.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { LienArChip } from '../../lib/jobs/lienArChip'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { COLLECT_BAR_STATES, type CollectBillState, type CollectPile } from '../../lib/bridge/collect/collectPile'
import type { CollectPayer, CollectPayerCut } from '../../lib/bridge/collect/collectPayers'
import { collectHowItReads, collectLegend, collectPaceWords, collectRestWords, collectSlowFacts, collectStandsWords, collectTiles } from '../../lib/bridge/collect/collectWords'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--surface-2, var(--surface))', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }

const STATE_COLOR: Record<CollectBillState, string> = {
  notdue: 'var(--bg-300, var(--border))',
  promised: '#e0a526',
  broken: '#e0a526',
  late: '#c0392b',
  doubtful: '#7a2a26',
  collections: 'var(--bg-200, var(--border))',
}
const TONE_COLOR = { red: 'var(--text-red-600)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', plain: 'var(--text)', grey: 'var(--text-muted)' } as const

export type BridgeCollectDeskProps = {
  pile: CollectPile
  cut: CollectPayerCut
  pace: { paidPerWeekUsd: number; billedPerWeekUsd: number }
  /** The card's weeks to clear, for the header; null when the stage has no pace. */
  weeks: number | null
  segments: { commercial: number | null; residential: number | null; company: number | null }
  todayYmd: string
  /** "Sun, Oct 25 · pay week Oct 18–24". */
  readStamp: string
  dayLabel: (ymd: string) => string
  chipsByJob: ReadonlyMap<string, LienArChip | null> | null
  arDoor: { to: string; label: string }
  onClose: () => void
}

function edgeFor(p: CollectPayer): string {
  if (p.worstState === 'broken') return '#e0a526'
  if (p.worstState === 'doubtful' || p.worstState === 'late') return '#c0392b'
  if (p.worstState === 'promised') return '#e0a526'
  return 'var(--border)'
}

export function BridgeCollectDesk(props: BridgeCollectDeskProps) {
  const { pile, cut, pace, weeks, segments, todayYmd, readStamp, dayLabel, chipsByJob, arDoor, onClose } = props
  const [slowsOpen, setSlowsOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const largestNotDue = pile.bills.filter((b) => b.state === 'notdue' && b.expectedYmd).sort((a, b) => b.usd - a.usd)[0] ?? null
  const legend = collectLegend(pile, { largestNotDue: largestNotDue ? { name: largestNotDue.payerName, usd: largestNotDue.usd, dueYmd: largestNotDue.expectedYmd!, dueWords: dayLabel(largestNotDue.expectedYmd!) } : null })
  const tiles = collectTiles(pile, cut, pace)
  const rest = collectRestWords(cut)
  const slows = collectSlowFacts(pile, cut)
  const barTotal = COLLECT_BAR_STATES.reduce((s, st) => s + pile.byState[st].usd, 0)
  const chipFor = (p: CollectPayer): LienArChip | null => {
    if (!chipsByJob) return null
    for (const b of p.bills) {
      const c = b.jobId ? chipsByJob.get(b.jobId) : null
      if (c) return c
    }
    return null
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 16px 24px', overflow: 'auto' }} data-testid="bridge-collect-desk">
      <div role="dialog" aria-modal="true" aria-label="Collect, broken down" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(1040px, 100%)', padding: '1.1rem 1.3rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={label}>
              Collect · the work billed <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· read {readStamp}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-red-600)', lineHeight: 1.15 }} data-testid="bridge-collect-headline">
              {stageUsd(pile.headlineUsd)} billed, not yet paid
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              customers pay <b style={{ color: 'var(--text)' }}>{stageUsd(pace.paidPerWeekUsd)}</b> a week{weeks != null ? <> · <b style={{ color: 'var(--text-red-600)' }}>{weeks >= 100 ? Math.round(weeks) : weeks.toFixed(1)} weeks</b> to collect what is already billed</> : null} · {pile.headlineCount} bills, {pile.pastDueCount} past their expected day
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', flex: 'none' }}>
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {tiles.map((t) => (
            <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>{t.head}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TONE_COLOR[t.tone] }}>{t.value}</div>
              <div style={{ fontSize: '0.82rem' }}>{t.words}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>What is in the pile</div>
            <span style={det}>by where each bill stands against its payer's own pace, not by its age</span>
          </div>
          <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }} aria-hidden="true">
            {COLLECT_BAR_STATES.map((st) => {
              const usd = pile.byState[st].usd
              if (!(usd > 0) || !(barTotal > 0)) return null
              const share = usd / barTotal
              return <div key={st} title={st} style={{ width: `${share * 100}%`, background: STATE_COLOR[st], display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: '0.72rem', color: st === 'notdue' ? 'var(--text)' : '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>{share > 0.12 ? stageUsd(usd) : ''}</div>
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, fontSize: '0.8rem' }}>
            {legend.map((l) => (
              <div key={l.state} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLOR[l.state], display: 'inline-block', border: l.state === 'collections' ? '1px dashed var(--text-muted)' : undefined }} />
                  <b style={{ color: l.state === 'late' || l.state === 'broken' ? TONE_COLOR[l.state === 'late' ? 'red' : 'amber'] : 'var(--text)' }}>{l.label}</b>
                </div>
                <div style={det}>{l.words}</div>
              </div>
            ))}
          </div>
          <div style={{ ...det, borderTop: '1px solid var(--border)', paddingTop: 6 }}>{collectHowItReads(pile, segments)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>Who holds it</div>
            <span style={det}>biggest money first · the one move on each comes next</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.7fr 1fr 3fr', gap: '0 12px', ...label, padding: '0 10px' }}>
            <div>Payer</div>
            <div style={{ textAlign: 'right' }}>Open</div>
            <div style={{ textAlign: 'right' }}>Oldest</div>
            <div>They pay in</div>
            <div>Where it stands</div>
          </div>
          {cut.cut.map((p) => {
            const paceWords = collectPaceWords(p)
            const stands = collectStandsWords(p, chipFor(p), todayYmd)
            return (
              <div key={p.payerId ?? p.payerName} style={{ ...card, display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.7fr 1fr 3fr', gap: '0 12px', alignItems: 'start', borderLeft: `4px solid ${edgeFor(p)}`, fontSize: '0.86rem' }} data-testid="bridge-collect-payer">
                <div>
                  <b>{p.payerName}</b>
                  <div style={det}>
                    {p.billCount} {p.billCount === 1 ? 'bill' : 'bills'} on {p.jobCount} {p.jobCount === 1 ? 'job' : 'jobs'}
                    {p.isGc ? ' · GC' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700 }}>{stageUsd(p.usd)}</div>
                <div style={{ textAlign: 'right', color: p.oldestAgeDays != null && p.oldestAgeDays > 60 ? 'var(--text-red-600)' : undefined }}>{p.oldestAgeDays != null ? `${p.oldestAgeDays} d` : '—'}</div>
                <div>
                  {paceWords.value}
                  <div style={det}>{paceWords.sub}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
                  {stands.map((s, i) => (
                    <div key={i} style={i === 0 && p.promise.state === 'broken' ? { color: 'var(--text-amber-800)', fontWeight: 600 } : undefined}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.7fr 1fr 3fr', gap: '0 12px', padding: '4px 10px', ...det }}>
            <div>{rest.head}</div>
            <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{stageUsd(cut.rest.usd)}</div>
            <div style={{ textAlign: 'right' }}>{cut.rest.oldestAgeDays != null ? `${cut.rest.oldestAgeDays} d` : '—'}</div>
            <div>their own paces</div>
            <div>
              {rest.words} <Link to={arDoor.to}>{arDoor.label} ›</Link>
            </div>
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>What slows Collect, before any call</div>
            <button type="button" onClick={() => setSlowsOpen((v) => !v)} style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--primary, var(--text))', fontSize: '0.8rem', cursor: 'pointer' }}>
              {slowsOpen ? 'Hide' : `Show the ${slows.length}`}
            </button>
          </div>
          <div style={det}>
            {slows.length} {slows.length === 1 ? 'fact' : 'facts'} the pile alone can tell. {slows.filter((f) => f.tone === 'red').length} of them are on the office.
          </div>
          {slowsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
              {slows.map((f) => (
                <div key={f.head} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: TONE_COLOR[f.tone], marginTop: 6 }} />
                  <div>
                    <b>{f.head}</b> {f.words}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
          <span style={det}>The moves, the owner's decisions and the week's plan come next.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={arDoor.to} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>
              {arDoor.label}
            </Link>
            <button type="button" onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--primary, #4f8ff7)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
