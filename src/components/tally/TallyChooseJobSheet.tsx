/**
 * The Choose job sheet on the Job Parts Tally (punch list #216): the search on top, not focused
 * so the keyboard stays down; Recent under it with the last three jobs the viewer was on and when,
 * Show N more to ten; then All jobs with its count. Typing narrows every section at once and lights
 * the typed run where it landed, number hits first, a customer hit showing the customer line. One
 * sheet for the Materials Estimate and On site tabs, on `PhoneSheet` so it stays above the
 * keyboard. The search is `lib/tally/chooseJobSearch.ts`; Recent is `lib/tally/recentJobs.ts` over
 * `fetchRecentJobMarks`.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PhoneSheet } from '../PhoneSheet'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { searchChooseJobs, type ChooseJobHit, type ChooseJobRow, type LitRun } from '../../lib/tally/chooseJobSearch'
import { RECENT_JOBS_SHOWN, recentHeadingSub, recentWhenWords, showMoreLabel, type RecentJobMark } from '../../lib/tally/recentJobs'
import { fetchRecentJobMarks } from '../../lib/tally/fetchRecentJobsForTally'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'

export type TallyChooseJobSheetProps = {
  jobs: readonly ChooseJobRow[]
  /** Show my jobs only: the ids All jobs is held to, null for every job. Recent ignores it. */
  onlyIds?: ReadonlySet<string> | null
  /** The press that lifts Show my jobs only, so an empty All jobs can offer it. */
  onClearOnly?: () => void
  selectedJobId: string | null
  /** Whose Recent: the signed-in user. Null draws no Recent section. */
  viewerUserId: string | null
  onPick: (jobId: string) => void
  onClose: () => void
}

const TOUCH_MIN = 48

const sectionHead: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '0.35rem 0 0', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const sectionSub: CSSProperties = { fontWeight: 500, letterSpacing: 0, textTransform: 'none', fontSize: '0.8rem' }
const rowBtn: CSSProperties = { minHeight: 56, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '0.6rem 0.9rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '1rem', lineHeight: 1.35, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' }
const line: CSSProperties = { display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const mark: CSSProperties = { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 2, padding: 0, fontWeight: 700 }

/** The field's runs, the lit ones as the Jobs page's amber mark. */
function Lit({ runs }: { runs: readonly LitRun[] }) {
  return (
    <>
      {runs.map((r, i) => (r.lit ? <mark key={i} style={mark}>{r.text}</mark> : <span key={i}>{r.text}</span>))}
    </>
  )
}

function JobRow({ hit, selected, when, onPick }: { hit: ChooseJobHit; selected: boolean; when: string | null; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} aria-current={selected ? 'true' : undefined} style={{ ...rowBtn, background: selected ? 'var(--bg-blue-tint)' : 'var(--surface)' }}>
      <span style={{ minWidth: 0, flex: '1 1 auto' }}>
        <span style={{ ...line, fontWeight: 600 }}>
          <Lit runs={hit.number} /> · <Lit runs={hit.name} />
        </span>
        {hit.address.length > 0 ? (
          <span style={{ ...line, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Lit runs={hit.address} />
          </span>
        ) : null}
        {hit.customer ? (
          <span style={{ ...line, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Lit runs={hit.customer} />
          </span>
        ) : null}
        {/* The when-line is the row's own line, not a right column: real job names run long, and a column beside them cut a name to ten letters at 375 px. */}
        {when ? <span style={{ ...line, color: 'var(--text-blue-700)', fontSize: '0.8rem', fontWeight: 500 }}>{when}</span> : null}
      </span>
    </button>
  )
}

type RecentState = { status: 'idle' | 'loading' | 'ready'; marks: RecentJobMark[]; failure: OfflineRecoveryLastError | null }

export function TallyChooseJobSheet({ jobs, onlyIds = null, onClearOnly, selectedJobId, viewerUserId, onPick, onClose }: TallyChooseJobSheetProps) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [query, setQuery] = useState('')
  const [unfolded, setUnfolded] = useState(false)
  const [recent, setRecent] = useState<RecentState>({ status: 'idle', marks: [], failure: null })

  const loadRecent = useCallback(async () => {
    if (!viewerUserId) return
    setRecent((r) => ({ ...r, status: 'loading', failure: null }))
    const read = await fetchRecentJobMarks(viewerUserId)
    setRecent({ status: 'ready', marks: read.marks, failure: read.failure })
  }, [viewerUserId])
  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j] as const)), [jobs])
  const today = todayYmdInAppTz()
  const typed = query.trim().length > 0

  // Recent: the marks whose job is on the sheet, newest first; typing searches all ten.
  const recentMarks = useMemo(() => recent.marks.filter((m) => byId.has(m.jobId)), [recent.marks, byId])
  const markById = useMemo(() => new Map(recentMarks.map((m) => [m.jobId, m] as const)), [recentMarks])
  const recentHits = useMemo(
    () => searchChooseJobs(recentMarks.map((m) => byId.get(m.jobId) as ChooseJobRow), query, prefixMap),
    [recentMarks, byId, query, prefixMap],
  )
  const recentShown = typed || unfolded ? recentHits : recentHits.slice(0, RECENT_JOBS_SHOWN)
  const moreLabel = typed || unfolded ? null : showMoreLabel(recentHits.length, RECENT_JOBS_SHOWN)

  // All jobs: held to Show my jobs only, then the search.
  const allJobs = useMemo(() => (onlyIds ? jobs.filter((j) => onlyIds.has(j.id)) : jobs), [jobs, onlyIds])
  const allHits = useMemo(() => searchChooseJobs(allJobs, query, prefixMap), [allJobs, query, prefixMap])

  const nothing = recentShown.length === 0 && allHits.length === 0
  const emptyState = nothing
    ? typed
      ? emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'jobs', query }), { onPress: () => setQuery('') })
      : onlyIds && onClearOnly
        ? emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'jobs', query: '' }), { onPress: onClearOnly })
        : emptyWords({ kind: 'data', noun: 'jobs', page: { label: 'Jobs', tail: 'is where a job is made.' } })
    : null

  return (
    <PhoneSheet label="Choose job" title="Choose job" width={480} onClose={onClose}>
      <div style={{ flex: 'none', padding: '0.6rem 1rem 0.5rem', position: 'relative' }}>
        <span aria-hidden style={{ position: 'absolute', left: '1.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.15rem', lineHeight: 1, pointerEvents: 'none' }}>
          ⌕
        </span>
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Number, name, address or customer"
          aria-label="Find a job"
          style={{ width: '100%', minHeight: TOUCH_MIN, boxSizing: 'border-box', padding: `0 ${query ? '3rem' : '0.9rem'} 0 2.4rem`, fontSize: '1rem', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--bg-subtle)', color: 'var(--text-strong)' }}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear what you typed"
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0 }}
          >
            ⊗
          </button>
        ) : null}
      </div>
      {/* The list is a grid of one column held to the sheet's width: a column left at auto grows to a row's nowrap text and pushes the when-words off the screen. */}
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0.25rem 1rem 1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem', alignContent: 'start' }}>
        {recent.failure ? <OfflineRetryPanel failure={recent.failure} onRetry={loadRecent} surface="tally-choose-job-recent" idempotent busy={recent.status === 'loading'} /> : null}
        {recentShown.length > 0 ? (
          <>
            <div style={sectionHead}>
              Recent{' '}
              {typed ? (
                <span style={sectionSub}>· {recentHits.length} match</span>
              ) : recentHeadingSub(recentMarks) ? (
                <span style={sectionSub}>· {recentHeadingSub(recentMarks)}</span>
              ) : null}
            </div>
            {recentShown.map((hit) => {
              const m = markById.get(hit.job.id)
              return <JobRow key={`r-${hit.job.id}`} hit={hit} selected={hit.job.id === selectedJobId} when={m ? recentWhenWords(m, today) : null} onPick={() => onPick(hit.job.id)} />
            })}
            {moreLabel ? (
              <button type="button" onClick={() => setUnfolded(true)} style={{ minHeight: 44, border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'transparent', color: 'var(--text-link)', font: 'inherit', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                {moreLabel}
              </button>
            ) : null}
          </>
        ) : null}
        {allHits.length > 0 ? (
          <>
            <div style={sectionHead}>
              All jobs <span style={sectionSub}>· {allHits.length}{typed ? ' match' : ''}</span>
            </div>
            {allHits.map((hit) => (
              <JobRow key={hit.job.id} hit={hit} selected={hit.job.id === selectedJobId} when={null} onPick={() => onPick(hit.job.id)} />
            ))}
          </>
        ) : null}
        {emptyState ? <EmptyState {...emptyState} /> : null}
      </div>
    </PhoneSheet>
  )
}
