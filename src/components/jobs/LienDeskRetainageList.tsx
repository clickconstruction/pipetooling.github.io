import { Fragment, type ReactNode } from 'react'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { RetainageUnrecordedRow } from '../../lib/ar/retainageSuggested'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { lienListFindEmptyWords, lienPileEmptyWords } from '../../lib/jobs/lienDeskEmptyWords'
import { contractEndedWords, retainageDeadlineWords, type LienRetainagePile, type LienRetainagePileShown } from '../../lib/jobs/lienDeskRetainage'
import { lienDeskJobLabel as jobLabel } from '../../lib/jobs/lienJobLabel'
import type { LienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { EmptyState } from '../EmptyState'
import { lienRowChipStyle as chip, lienSeverityColors as severityColors } from './lienDeskRowStyles'
import { LienSupplierMarkLine } from './LienJobSuppliers'
import { LienPileHead, lienPileHeadCount, type LienPileHeads } from './LienPileHeads'
import { LienRetainageUnrecorded } from './LienRetainageUnrecorded'

/** One empty list for every render with no such job, so the list's effect stays put. */
const NO_RETAINAGE_UNRECORDED: ReadonlyArray<RetainageUnrecordedRow> = []

/**
 * By paper → Retainage notices, the list (v2.3753; its own file since v2.7583, out of `LienDesk.tsx` as it
 * stood): the retainage nobody recorded above the piles, then each pile under its sticky title with one row a
 * job. What it lists comes from `lienRetainageListView`; the desk keeps the pick, the pressed pile, the find
 * box and the lit title (`useLienPileHeads`, so the title stays lit while the list is off screen), and hands
 * them in.
 */
export function LienDeskRetainageList({
  data,
  loading,
  isMobile,
  office,
  pilesShown,
  heads: retHeads,
  rowCount,
  selectedJobId,
  pile,
  onShowEveryPile,
  finding,
  find,
  onClearFind,
  focusJobId,
  pileChips,
  supplierMarks,
  onPick,
  onOpenLienContract,
  onChanged,
}: {
  data: LienDeskData | null
  loading: boolean
  isMobile: boolean
  office: boolean
  /** The piles to draw and the rows under each, and how many rows that is in all (`lienRetainageListView`). */
  pilesShown: ReadonlyArray<LienRetainagePileShown>
  /** The piles' sticky titles: the desk's `useLienPileHeads` over the same piles. */
  heads: LienPileHeads<LienRetainagePile>
  rowCount: number
  /** The row that is open, ringed in the list. */
  selectedJobId: string | null
  /** The pressed pile, and the press that shows every pile again. */
  pile: LienRetainagePile | null
  onShowEveryPile: () => void
  /** The find box: whether words are typed, the words, and the press that clears them. */
  finding: boolean
  find: string
  onClearFind: () => void
  /** The job a To do row opened *Looks held · not on the job* for: its row there is ringed. */
  focusJobId: string | null
  /** A phone's pile chips, at the top of the list where they scroll away with it; nothing on a computer. */
  pileChips: ReactNode
  supplierMarks: ReadonlyMap<string, LienSupplierMark>
  onPick: (jobId: string) => void
  onOpenLienContract: (jobId: string) => void
  onChanged: () => void
}) {
  return (
    <div ref={retHeads.listRef} onScroll={retHeads.onScroll} style={{ position: 'relative', borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }} data-lien-retainage-list>
      {pileChips}
      {finding || pile ? null : <LienRetainageUnrecorded rows={data?.retainageUnrecorded ?? NO_RETAINAGE_UNRECORDED} failure={data?.retainageUnrecordedFailure ?? null} office={office} focusJobId={focusJobId} onOpenLienContract={onOpenLienContract} onRecorded={onChanged} />}
      {rowCount === 0 ? (
        !loading && data != null && (finding || pile) ? (
          <div data-lien-retainage-empty={finding ? 'find' : pile ?? 'list'} style={{ fontSize: '0.8125rem' }}>
            <EmptyState compact {...(finding ? lienListFindEmptyWords(find, onClearFind) : lienPileEmptyWords(onShowEveryPile))} />
          </div>
        ) : (
          <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {loading || data == null ? 'Looking at every job with retainage…' : 'No job with a GC has retainage recorded. Edit Job → Our contract on this job is where it goes.'}
          </p>
        )
      ) : null}
      {pilesShown.map(({ p, label, rows, total }, i) => (
          <Fragment key={p}>
            <LienPileHead pile={p} label={label} count={lienPileHeadCount(rows.length, total, data?.retainage.counts[p], finding)} i={i} n={pilesShown.length} phone={isMobile} on={retHeads.lit === p} empty={finding && rows.length === 0} onPress={() => retHeads.scrollToPile(p, i)} onShowEvery={pile ? onShowEveryPile : null} />
            <div data-lien-pile-rows={p}>
            {rows.map((e) => {
              const j = data?.jobsById[e.jobId]
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === selectedJobId
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => onPick(e.jobId)}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{jobLabel(j, e.jobId)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> · {g?.name ?? ''}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.retainageHeld)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={chip(severityColors(e.severity).bg, severityColors(e.severity).fg)}>{retainageDeadlineWords(e, formatYmdMonthDay)}</span>
                    <span>{contractEndedWords(e.contractEndedHow, e.contractEndedOn, formatYmdMonthDay)}</span>
                    <span>· {e.inClaim ? 'in the § 53.056 claim' : 'not yet in a § 53.056 claim'}</span>
                    <LienSupplierMarkLine mark={supplierMarks.get(e.jobId)} />
                  </span>
                </button>
              )
            })}
            </div>
          </Fragment>
      ))}
    </div>
  )
}
