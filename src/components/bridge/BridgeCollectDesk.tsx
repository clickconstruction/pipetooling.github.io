/**
 * The Collect desk (punch list #177, PR B, v2.5853): the modal behind the
 * Bridge's Collect card. The pile by where each bill stands against its
 * payer's own pace, the three tiles, the bar and its legend, the payers that
 * hold the pile with where each stands, everyone else as one line, what
 * slows Collect folded under one line, and the footnote on how it reads.
 * Since PR C (v2.5854): the one move on each payer with the words to say and
 * the lien paper, the owner's decisions in a strip of their own, the what-if
 * tile, and the footer that records the sheet as the week's plan. Pure
 * on its props: the page reads, the kernels under `src/lib/bridge/collect`
 * do the arithmetic and the words.
 *
 * Punch list #334 (PR 1): the window opens in the shared frame
 * `BridgeStepWindow`. The payers lead, as *Call this week*, then the owner's decisions. The tiles, the bar's legend,
 * everyone else and what slows Collect wait behind the presses at the foot. Nothing is removed.
 */
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { LienArChip } from '../../lib/jobs/lienArChip'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { COLLECT_BAR_STATES, type CollectBillState, type CollectPile } from '../../lib/bridge/collect/collectPile'
import type { CollectPayer, CollectPayerCut } from '../../lib/bridge/collect/collectPayers'
import { collectLegend, collectPaceWords, collectRestWords, collectSlowFacts, collectStandsWords, collectTiles, type CollectTile } from '../../lib/bridge/collect/collectWords'
import type { CollectSheet } from '../../lib/bridge/collect/collectMoves'
import { collectSheetText } from '../../lib/bridge/collect/collectMoves'
import type { CollectDecision } from '../../lib/bridge/collect/collectDecisions'
import type { CollectWhatIf } from '../../lib/bridge/collect/collectWhatIf'
import { BridgeCollectOutcome, type CollectOutcomeWriter } from './BridgeCollectOutcome'
import { BridgeStepWindow, StepRows, type StepFoldSpec, type StepGroup, type StepPress, type StepRow } from './BridgeStepWindow'
import { collectCountedLines, collectHeadline, collectPileLead, collectPlanLine, collectThreeParts } from './BridgeCollectCounted'
import { TOUCH_QUIET_DAYS } from '../../lib/jobs/paymentChase'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
/** A door or a toggle inside the window: a link's colour, a finger's height. */
const linkPress: CSSProperties = { font: 'inherit', fontSize: '0.82rem', padding: 0, minHeight: 44, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
/** A press at the foot, drawn as the frame draws a row's plain press. */
const footPress: CSSProperties = { font: 'inherit', fontSize: '0.84rem', fontWeight: 700, minHeight: 44, padding: '0 0.85rem', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', textDecoration: 'none' }

const STATE_COLOR: Record<CollectBillState, string> = {
  notdue: 'var(--border)',
  promised: '#e0a526',
  broken: '#e0a526',
  late: '#c0392b',
  doubtful: '#7a2a26',
  collections: 'var(--bg-200, var(--border))',
}
const TONE_COLOR = { red: 'var(--text-red-600)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', plain: 'var(--text)', grey: 'var(--text-muted)' } as const
/** The bar under the headline: not yet due, late, doubtful. */
const PART_COLOR = { notDue: '#16a34a', late: '#dc2626', doubtful: 'var(--text-muted)' } as const

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
  /** PR C: the sheet, the owner's strip and the what-if. Absent, the modal reads only. */
  sheet?: CollectSheet | null
  decisions?: ReadonlyArray<CollectDecision> | null
  whatIf?: CollectWhatIf | null
  customerHref?: (payerId: string) => string
  /** PR D: the after-the-call sheet writes through this; absent, the rows offer no sheet. */
  outcomeWriter?: CollectOutcomeWriter | null
  onOutcomeRecorded?: () => void
  /** The customer the window was opened on, from the card What to do now (punch list #334, PR 8). It leads the list, with where it stands open under it. */
  focusPayerKey?: string | null
}

function edgeFor(p: CollectPayer): string {
  if (p.worstState === 'broken') return '#e0a526'
  if (p.worstState === 'doubtful' || p.worstState === 'late') return '#c0392b'
  if (p.worstState === 'promised') return '#e0a526'
  return 'var(--border)'
}

/** Why a payer waits off the sheet (v2.5873), under its row's move. */
const WAIT_WORDS: Partial<Record<string, string>> = {
  owner_dispute: 'Off the sheet. See Only you can decide.',
  quiet: 'Off the sheet. No call until then.',
  promised_wait: 'Off the sheet. No call unless it breaks.',
}

export function BridgeCollectDesk(props: BridgeCollectDeskProps) {
  const { pile, cut, pace, weeks, segments, todayYmd, readStamp, dayLabel, chipsByJob, arDoor, onClose, sheet, decisions, whatIf, customerHref, outcomeWriter, onOutcomeRecorded, focusPayerKey = null } = props
  const [outcomeFor, setOutcomeFor] = useState<CollectPayer | null>(null)
  const [standsOpen, setStandsOpen] = useState<ReadonlySet<string>>(() => new Set(focusPayerKey ? [focusPayerKey] : []))
  const [owners, setOwners] = useState<Map<string, string>>(() => new Map())
  const [copied, setCopied] = useState(false)

  const largestNotDue = pile.bills.filter((b) => b.state === 'notdue' && b.expectedYmd).sort((a, b) => b.usd - a.usd)[0] ?? null
  const legend = collectLegend(pile, { largestNotDue: largestNotDue ? { name: largestNotDue.payerName, usd: largestNotDue.usd, dueYmd: largestNotDue.expectedYmd!, dueWords: dayLabel(largestNotDue.expectedYmd!) } : null })
  const tiles = collectTiles(pile, cut, pace)
  if (whatIf) tiles[2] = { head: whatIf.head, value: whatIf.value, words: `${whatIf.words} ${whatIf.leftAlone.words}`, tone: 'green' }
  const rest = collectRestWords(cut)
  const slows = collectSlowFacts(pile, cut)
  const barTotal = COLLECT_BAR_STATES.reduce((s, st) => s + pile.byState[st].usd, 0)
  const headline = collectHeadline(pile, cut)
  const parts = collectThreeParts(pile)
  const partsTotal = parts.notDueUsd + parts.lateUsd + parts.doubtfulUsd
  const chipFor = (p: CollectPayer): LienArChip | null => {
    if (!chipsByJob) return null
    for (const b of p.bills) {
      const c = b.jobId ? chipsByJob.get(b.jobId) : null
      if (c) return c
    }
    return null
  }
  const toggleStands = (key: string) =>
    setStandsOpen((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /** One payer as a row: the payer and its open money, the move, one press, and what the row opens under itself. */
  const payerRow = (p: CollectPayer): StepRow => {
    const key = p.payerId ?? p.payerName
    const paceWords = collectPaceWords(p)
    const stands = collectStandsWords(p, chipFor(p), todayYmd)
    const move = sheet?.rows.find((r) => r.payer === p)?.move ?? null
    const href = p.payerId && customerHref ? customerHref(p.payerId) : null
    const ownerNow = owners.get(key) ?? move?.owner ?? ''
    const open = standsOpen.has(key)
    let press: StepPress | undefined
    if (move && move.isCall && outcomeWriter) press = { label: 'Record the answer', onClick: () => setOutcomeFor(p), testId: 'bridge-collect-after-call' }
    else if (move && href) press = { label: move.kind === 'statement' ? 'Send the statement' : 'Open the customer', to: href }
    const second = move ? (move.onSheet ? (move.opener ? null : (stands[0] ?? null)) : (WAIT_WORDS[move.kind] ?? null)) : null
    return {
      key,
      title: (
        <span data-testid="bridge-collect-payer">
          {p.payerName} · {stageUsd(p.usd)}
        </span>
      ),
      sub: move ? (
        <>
          <div style={{ color: 'var(--text-700)', fontWeight: 600 }} data-testid="bridge-collect-move">
            {move.title}
          </div>
          {second ? <div>{second}</div> : null}
        </>
      ) : (
        (stands[0] ?? null)
      ),
      press,
      under: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, borderLeft: `3px solid ${edgeFor(p)}`, paddingLeft: 10 }}>
          {move?.opener ? <div style={{ fontSize: '0.84rem', fontStyle: 'italic', color: 'var(--text-700)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{move.opener}</div> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 1rem' }}>
            {move?.onSheet ? <input aria-label={`Owner and day for ${p.payerName}`} placeholder="owner · day" value={ownerNow} onChange={(e) => setOwners((m) => new Map(m).set(key, e.target.value))} style={{ font: 'inherit', fontSize: '0.8rem', height: 32, padding: '0 10px', borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text)', width: 130, boxSizing: 'border-box' }} /> : null}
            {move?.paper ? (
              <Link to={move.paper.href} style={linkPress}>
                {move.paper.label} ›
              </Link>
            ) : null}
            {href && !press?.to ? (
              <Link to={href} style={linkPress}>
                Open the customer ›
              </Link>
            ) : null}
            <button type="button" onClick={() => toggleStands(key)} aria-expanded={open} style={linkPress} data-testid="bridge-collect-stands">
              Where it stands {open ? '▴' : '›'}
            </button>
          </div>
          {open ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', paddingBottom: 6 }} data-testid="bridge-collect-stands-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px 12px' }}>
                <div>
                  <div style={label}>Bills</div>
                  {p.billCount} {p.billCount === 1 ? 'bill' : 'bills'} on {p.jobCount} {p.jobCount === 1 ? 'job' : 'jobs'}
                  {p.isGc ? ' · GC' : ''}
                </div>
                <div>
                  <div style={label}>Oldest</div>
                  <span style={{ color: p.oldestAgeDays != null && p.oldestAgeDays > 60 ? 'var(--text-red-600)' : undefined }}>{p.oldestAgeDays != null ? `${p.oldestAgeDays} d` : '—'}</span>
                </div>
                <div>
                  <div style={label}>They pay in</div>
                  {paceWords.value}
                  <div style={det}>{paceWords.sub}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {stands.map((s, i) => (
                  <div key={i} style={i === 0 && p.promise.state === 'broken' ? { color: 'var(--text-amber-800)', fontWeight: 600 } : undefined}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ),
    }
  }

  // The payers still on the sheet lead, biggest first. A payer waiting off it follows.
  const onSheet = (p: CollectPayer): boolean => sheet?.rows.find((r) => r.payer === p)?.move.onSheet ?? true
  const sheetOrder = [...cut.cut.filter(onSheet), ...cut.cut.filter((p) => !onSheet(p))]
  const isFocus = (p: CollectPayer): boolean => focusPayerKey != null && (p.payerId ?? p.payerName) === focusPayerKey
  const payersInOrder = [...sheetOrder.filter(isFocus), ...sheetOrder.filter((p) => !isFocus(p))]
  const payerRows = payersInOrder.map(payerRow)
  const decisionRows: StepRow[] = (decisions ?? []).map((d) => ({
    key: d.kind + d.head,
    title: d.head,
    press: { label: d.door.label, to: d.door.href },
    under: <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{d.words}</div>,
  }))
  // The first press in the window is the first thing to do: drawn blue, once.
  const firstPayerPress = payerRows.findIndex((r) => r.press)
  const callRows = payerRows.map((r, i) => (i === firstPayerPress && r.press ? { ...r, press: { ...r.press, primary: true } } : r))
  const decideRows = firstPayerPress < 0 ? decisionRows.map((r, i) => (i === 0 && r.press ? { ...r, press: { ...r.press, primary: true } } : r)) : decisionRows
  const groups: StepGroup[] = [{ key: 'call', title: sheet ? 'Call this week' : 'Who holds it', rows: callRows, shown: 2, empty: 'Nothing waiting on a call.' }]

  const tileCard = (t: CollectTile) => (
    <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={label}>{t.head}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TONE_COLOR[t.tone] }}>{t.value}</div>
      <div style={{ fontSize: '0.82rem' }}>{t.words}</div>
    </div>
  )
  const whatIfTile = tiles[2]
  const folds: StepFoldSpec[] = []
  if (whatIfTile) folds.push({ key: 'whatif', label: whatIf ? 'What if half of it lands' : 'What if it is left alone', content: tileCard(whatIfTile) })
  folds.push({
    key: 'pile',
    label: 'What is in the pile',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
        <div style={{ fontSize: '0.86rem', color: 'var(--text-700)', lineHeight: 1.4 }}>{collectPileLead(pile, pace, weeks)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>{tiles.slice(0, 2).map(tileCard)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={det}>Each bill is placed by its payer&rsquo;s own pace, not by its age.</div>
          <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }} aria-hidden="true">
            {COLLECT_BAR_STATES.map((st) => {
              const usd = pile.byState[st].usd
              if (!(usd > 0) || !(barTotal > 0)) return null
              const share = usd / barTotal
              return <div key={st} title={st} style={{ width: `${share * 100}%`, background: STATE_COLOR[st], display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: '0.72rem', color: st === 'notdue' ? 'var(--text)' : 'var(--surface)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>{share > 0.12 ? stageUsd(usd) : ''}</div>
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
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: '0.82rem' }} data-testid="bridge-collect-rest">
          <b>{rest.head}</b>
          {cut.rest.payers > 0 ? (
            <div>
              {stageUsd(cut.rest.usd)} open{cut.rest.oldestAgeDays != null ? `, the oldest ${cut.rest.oldestAgeDays} days old` : ''}. They pay at their own paces.
            </div>
          ) : null}
          <div style={det}>{rest.words}</div>
          <Link to={arDoor.to} style={linkPress}>
            {arDoor.label} ›
          </Link>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="bridge-collect-slows">
          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>What slows Collect, before any call</div>
          <div style={det}>
            {slows.length} {slows.length === 1 ? 'fact' : 'facts'} the pile alone can tell. {slows.filter((f) => f.tone === 'red').length} of them are on the office.
          </div>
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
        </div>
      </div>
    ),
  })
  folds.push({
    key: 'counted',
    label: 'How this is counted',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.84rem', color: 'var(--text-700)', lineHeight: 1.4 }}>
        {collectCountedLines(pile, cut, segments).map((l) => (
          <div key={l}>{l}</div>
        ))}
        <div style={{ ...det, marginTop: 4 }}>Read {readStamp}</div>
      </div>
    ),
  })

  const summary =
    partsTotal > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, fontVariantNumeric: 'tabular-nums' }} data-testid="bridge-collect-summary">
        <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden' }} aria-hidden="true">
          {parts.notDueUsd > 0 ? <div style={{ width: `${(parts.notDueUsd / partsTotal) * 100}%`, background: PART_COLOR.notDue }} /> : null}
          {parts.lateUsd > 0 ? <div style={{ width: `${(parts.lateUsd / partsTotal) * 100}%`, background: PART_COLOR.late }} /> : null}
          {parts.doubtfulUsd > 0 ? <div style={{ width: `${(parts.doubtfulUsd / partsTotal) * 100}%`, background: PART_COLOR.doubtful }} /> : null}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {stageUsd(parts.notDueUsd)} not yet due · {stageUsd(parts.lateUsd)} late · {stageUsd(parts.doubtfulUsd)} doubtful
        </div>
      </div>
    ) : null

  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <span style={det} data-testid="bridge-collect-plan-line">
          {collectPlanLine(sheet)}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sheet && (
            <button
              type="button"
              onClick={() => {
                const text = collectSheetText({ ...sheet, rows: sheet.rows.map((r) => ({ ...r, move: { ...r.move, owner: owners.get(r.payer.payerId ?? r.payer.payerName) ?? r.move.owner } })) }, `The Collect desk, ${readStamp}`)
                void navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false))
              }}
              style={{ ...footPress, fontWeight: 600 }}
            >
              {copied ? 'Copied' : 'Copy the call sheet'}
            </button>
          )}
          <Link to={arDoor.to} style={{ ...footPress, fontWeight: 600 }}>
            {arDoor.label}
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <BridgeStepWindow testId="bridge-collect-desk" ariaLabel="Collect, broken down" eyebrow="Collect · the work billed" headline={headline.words} headlineTestId="bridge-collect-headline" tone={headline.bad ? 'bad' : 'plain'} summary={summary} groups={groups} folds={folds} footer={footer} onClose={onClose} escCloses={!outcomeFor}>
      {decideRows.length > 0 && (
        <div style={{ minWidth: 0 }} data-testid="bridge-collect-decisions">
          <StepRows group={{ key: 'decide', title: `Only you can decide · ${decideRows.length}`, rows: decideRows, shown: 1 }} />
        </div>
      )}
      {outcomeFor && outcomeWriter && (
        <BridgeCollectOutcome payer={outcomeFor} todayYmd={todayYmd} dayLabel={dayLabel} graceDays={pile.rules.brokenGraceDays} quietDays={TOUCH_QUIET_DAYS} customerHref={outcomeFor.payerId && customerHref ? customerHref(outcomeFor.payerId) : null} writer={outcomeWriter} onClose={() => setOutcomeFor(null)} onRecorded={() => onOutcomeRecorded?.()} />
      )}
    </BridgeStepWindow>
  )
}
