import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, type EmptyStateWords } from '../EmptyState'
import { gcNeeds, type GcBenchIn } from '../../lib/prospects/gcNeeds'
import { callNumbers, prospectTitle } from '../../lib/prospects/personBlock'
import { formatDateTime } from '../../lib/prospects/prospectFormat'
import type { ProspectKindWords } from '../../lib/prospects/prospectKinds'
import { lastTouchLabel, type ProspectLastCall } from '../../lib/prospects/prospectListGrouping'
import type { Prospect } from '../../lib/prospects/prospectRow'
import { NO_TRADE_GROUP, TRADE_PARTNERS_HREF, callForTradeHref, groupHeadWords, groupSubsByTrade, rowPress, stageTone, stageWords, subStage, type PlansChoice, type StageIn, type StageTone } from '../../lib/prospects/subsStages'
import { telHrefFor } from '../../lib/phoneContact'
import { SubsPathStrip } from './SubsPathStrip'
import { SubsPlansPicker } from './SubsPlansPicker'

/** The stage chip on a sub's row (v2.5807): green until called, amber once called, blue once talked, violet on the bench. */
const STAGE_TONE_STYLE: Record<StageTone, { background: string; color: string }> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  blue: { background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' },
  violet: { background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' },
  grey: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}

/**
 * The Subs lane's Prospect List (v2.5807): the strip, the For picker, then the lane by trade in the needs panel's
 * order, each row with its stage and its press. Moved out of `src/pages/Prospects.tsx` (`renderSubsList`)
 * unchanged. It holds no state: which folds are open stays with the page, so a fold survives a visit to another tab.
 */
export function SubsLaneList({
  filtered,
  calledIds,
  nowMs,
  answeredIds,
  quotedCompanyIds,
  benches,
  ownTrades,
  plans,
  plansFor,
  picked,
  onPick,
  sectionOpen,
  onToggleSection,
  selectedId,
  lastCalls,
  saving,
  kindWords,
  empty,
  onCall,
  onBench,
  onEdit,
  onSendBack,
  onDelete,
  onAddSub,
}: {
  /** The lane's rows after the search. */
  filtered: Prospect[]
  calledIds: ReadonlySet<string>
  nowMs: number
  answeredIds: ReadonlySet<string>
  quotedCompanyIds: ReadonlySet<string>
  benches: readonly GcBenchIn[]
  ownTrades: readonly string[]
  plans: readonly PlansChoice[]
  plansFor: string | null
  picked: PlansChoice | null
  onPick: (id: string | null) => void
  sectionOpen: Record<string, boolean>
  onToggleSection: (key: string, fallback: boolean) => void
  /** The row the caller last opened on the deck, shown tinted. */
  selectedId: string | null
  lastCalls: Record<string, ProspectLastCall>
  saving: boolean
  kindWords: ProspectKindWords
  /** What the list says, and offers, with nothing to list. */
  empty: EmptyStateWords
  onCall: (p: Prospect) => void
  onBench: (p: Prospect) => void
  onEdit: (p: Prospect) => void
  onSendBack: (p: Prospect) => void
  onDelete: (p: Prospect) => void
  onAddSub: (trade: string) => void
}) {
  const inp: StageIn = { calledIds, answeredIds, quotedCompanyIds }
  const needsForList = gcNeeds(benches, filtered, ownTrades)
  const live = filtered.filter((p) => p.prospect_fit_status == null)
  const landed = filtered.filter((p) => p.prospect_fit_status === 'converted')
  const exits = filtered.filter((p) => p.prospect_fit_status === 'cant_reach' || p.prospect_fit_status === 'not_a_fit')
  const { groups, noTrade } = groupSubsByTrade(live, needsForList, picked?.trades ?? null)
  const chip: CSSProperties = { padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }
  const smallBtn = (primary: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 6, border: `1px solid ${primary ? '#2563eb' : 'var(--border-strong)'}`, background: primary ? '#2563eb' : 'var(--surface)', color: primary ? 'white' : 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' })
  const isOpen = (key: string, fallback: boolean) => sectionOpen[key] ?? fallback
  const toggle = onToggleSection
  const row = (p: Prospect) => {
    const stage = subStage(p, inp)
    const press = rowPress(stage)
    const tone = STAGE_TONE_STYLE[stageTone(stage)]
    const landedRow = stage === 'on_bench' || stage === 'quoted'
    const exitRow = stage === 'cant_reach' || stage === 'not_a_fit'
    const nums = callNumbers(p)
    return (
      <div key={p.id} data-sub-row={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem 0.75rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', background: selectedId === p.id ? 'var(--bg-blue-tint)' : undefined }}>
        <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{prospectTitle(p)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!p.is_person && p.contact_name?.trim() ? <span>{p.contact_name.trim()}</span> : null}
            {nums.call ? (
              <a href={telHrefFor(nums.call)} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-link)' }}>
                {nums.call}
              </a>
            ) : (
              <span>no phone</span>
            )}
            {(p.trades ?? []).map((trade) => (
              <span key={trade} style={{ ...chip, fontWeight: 600, background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' }}>
                {trade}
              </span>
            ))}
          </div>
        </div>
        <span data-stage-chip style={{ ...chip, ...tone }}>{stageWords(stage)}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={p.last_contact ? `Last contact ${formatDateTime(p.last_contact)}` : undefined}>
          {lastTouchLabel(p, lastCalls[p.id], nowMs)}
        </span>
        <span style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {press && (
            <button type="button" onClick={() => onCall(p)} style={smallBtn(press === 'call')}>
              Call now →
            </button>
          )}
          {press === 'call_or_bench' && (
            <button type="button" onClick={() => onBench(p)} disabled={saving} title={kindWords.lastPressTitle} style={{ ...smallBtn(false), background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)', borderColor: '#8b5cf6' }}>
              {kindWords.lastPress}
            </button>
          )}
          {landedRow && (
            <Link to={TRADE_PARTNERS_HREF} style={smallBtn(false)}>
              On Trade partners →
            </Link>
          )}
          {(landedRow || exitRow) && (
            <>
              <button type="button" onClick={() => onEdit(p)} disabled={saving} style={smallBtn(false)}>Edit</button>
              <button type="button" onClick={() => onSendBack(p)} disabled={saving} style={smallBtn(false)}>Send back</button>
              <button type="button" onClick={() => onDelete(p)} disabled={saving} style={{ ...smallBtn(false), borderColor: '#dc2626', color: 'var(--text-red-600)' }}>Delete</button>
            </>
          )}
        </span>
      </div>
    )
  }
  const section = (key: string, title: string, head: string | null, subs: Prospect[], openByDefault: boolean, door?: { label: string; to?: string; onPress?: () => void; primary: boolean }) => {
    const open = isOpen(key, openByDefault)
    return (
      <div key={key} id={`subs-sec-${key}`} data-subs-section={key} style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
          <button type="button" onClick={() => toggle(key, openByDefault)} aria-expanded={open} style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}>
            <span aria-hidden>{open ? '▼' : '▶'}</span>
            {title}
          </button>
          {head && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{head}</span>}
          {door &&
            (door.to ? (
              <Link to={door.to} style={{ ...smallBtn(door.primary), marginLeft: 'auto' }}>
                {door.label}
              </Link>
            ) : (
              <button type="button" onClick={door.onPress} style={{ ...smallBtn(door.primary), marginLeft: 'auto' }}>
                {door.label}
              </button>
            ))}
        </div>
        {open && <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{subs.map(row)}</div>}
      </div>
    )
  }
  return (
    <div>
      <SubsPathStrip rows={filtered} calledIds={calledIds} answeredIds={answeredIds} quotedCompanyIds={quotedCompanyIds} />
      <SubsPlansPicker plans={plans} plansFor={plansFor} picked={picked} onPick={onPick} />
      {filtered.length === 0 ? (
        <EmptyState {...empty} />
      ) : (
        <>
          {groups.map((g) =>
            section(
              `trade-${g.trade.toLowerCase()}`,
              `${g.trade}${g.lit ? ' ★' : ''} (${g.subs.length})`,
              groupHeadWords(g, picked?.name ?? null),
              g.subs,
              picked ? g.lit : true,
              g.subs.length > 0 ? { label: `Call for ${g.trade} →`, to: callForTradeHref(g.trade, plansFor), primary: g.lit } : { label: 'Add a sub', onPress: () => onAddSub(g.trade), primary: g.lit },
            ),
          )}
          {noTrade.length > 0 && section('no-trade', `${NO_TRADE_GROUP} (${noTrade.length})`, 'Edit prospect names the trade', noTrade, true)}
          {landed.length > 0 && section('landed', `${kindWords.landed} (${landed.length})`, 'on Trade partners now', landed, false, { label: 'Trade partners →', to: TRADE_PARTNERS_HREF, primary: false })}
          {exits.length > 0 && section('exits', `Can't reach and Not a fit (${exits.length})`, 'out of the queue; Send back returns one', exits, false)}
        </>
      )}
    </div>
  )
}
