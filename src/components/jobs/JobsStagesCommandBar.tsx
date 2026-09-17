/**
 * The Pipeline board's command bar (Stages tab decomposition PR 3, v2.3533).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (the rest of region 2 of
 * `docs/JOBS_STAGES_TAB_ARCHITECTURE.md`, after the ⋯ menu left in v2.3532): New Job,
 * Follow-ups with its badge, Forecast, the search box with its two busy hints, the Session
 * notes chip, the # jump chip, the applied-filter chips (tap to clear; the hidden-groups chip
 * opens the manage modal instead, v2.1476), and the ⋯ menu handed in as `toolsMenu`. The
 * only state it owns is the search box's focus ring. The chips read the same `filters`
 * object the menu's selects do, so the bar can never show a filter the menu does not have.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import AccountManIcon from '../icons/AccountManIcon'
import { STAGES_CONTRACT_FILTER_LABELS } from '../../lib/jobs/jobContractCoverage'
import { STAGES_SORT_MODE_ACTIVE_CHIP_LABELS } from '../../lib/jobsStagesSortMode'
import { STAGES_ACCOUNT_MAN_FILTER_NONE, STAGES_DEVELOPMENT_FILTER_NONE, STAGES_GC_FILTER_NO_GC } from '../../lib/jobsStagesBoard'
import { StagesJobNumberJumpChip } from './StagesJobNumberJumpChip'
import type { StagesToolsFilters } from './JobsStagesToolsMenu'

export type JobsStagesCommandBarProps = {
  onNewJob: () => void
  shortNewJobButtonLabel: boolean
  followupQueueCount: number | null
  onOpenFollowups: () => void
  canSeeForecast: boolean
  onOpenForecast: () => void
  query: string
  onQueryChange: (value: string) => void
  includeScheduleTimeInSearch: boolean
  scheduleSessionSearchBusy: boolean
  serverSearchBusy: boolean
  /** Null hides the Session notes chip (office roles only). */
  onOpenSessionNotes: (() => void) | null
  onJumpToNumber: (digits: string) => boolean | Promise<boolean>
  filters: StagesToolsFilters
  onClearSort: () => void
  onClearContract: () => void
  onClearGc: () => void
  onClearDevelopment: () => void
  onClearAccountMan: () => void
  onOpenHideGroups: () => void
  /** The ⋯ tools menu, rendered at the bar's right edge. */
  toolsMenu: ReactNode
}

const stagesActiveFilterChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  flexShrink: 0,
  maxWidth: 'clamp(6rem, 30vw, 12rem)',
  padding: '0.2rem 0.6rem',
  border: 'none',
  borderRadius: 999,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-link)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export function JobsStagesCommandBar({
  onNewJob,
  shortNewJobButtonLabel,
  followupQueueCount,
  onOpenFollowups,
  canSeeForecast,
  onOpenForecast,
  query,
  onQueryChange,
  includeScheduleTimeInSearch,
  scheduleSessionSearchBusy,
  serverSearchBusy,
  onOpenSessionNotes,
  onJumpToNumber,
  filters,
  onClearSort,
  onClearContract,
  onClearGc,
  onClearDevelopment,
  onClearAccountMan,
  onOpenHideGroups,
  toolsMenu,
}: JobsStagesCommandBarProps) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '1rem' }}>
      <span
        id="stages-search-supplemental-desc"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        When Schedule and time in search is enabled, results can include jobs matched by dispatch schedule or clock
        session notes, people, or dates.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={onNewJob}
        aria-label="New job"
        style={{
          padding: '0.5rem 1rem',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {shortNewJobButtonLabel ? 'New' : 'New Job'}
      </button>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          onClick={() => onOpenFollowups()}
          aria-label={
            followupQueueCount != null && followupQueueCount > 0
              ? `Open job follow-ups — ${followupQueueCount} outstanding`
              : 'Open job follow-ups'
          }
          style={{
            padding: '0.5rem 0.9rem',
            background: 'var(--bg-amber-tint)',
            color: 'var(--text-amber-800)',
            border: '1px solid var(--border-amber-soft)',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Follow-ups
        </button>
        {followupQueueCount != null && followupQueueCount > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-0.5rem',
              right: '-0.5rem',
              fontSize: '0.68rem',
              fontWeight: 800,
              background: '#f59e0b',
              color: '#241a05',
              borderRadius: 999,
              padding: '0.1rem 0.4rem',
              minWidth: '1.4em',
              textAlign: 'center',
              lineHeight: 1.4,
              border: '2px solid var(--bg-page)',
              pointerEvents: 'none',
            }}
          >
            {followupQueueCount}
          </span>
        ) : null}
      </span>
      {canSeeForecast && (
        <button
          type="button"
          onClick={() => onOpenForecast()}
          title="Open billed dollars bucketed by expected payment date (bill date + customer pay speed)"
          aria-label="Payment forecast"
          style={{
            padding: '0.5rem 0.9rem',
            background: 'var(--bg-green-tint)',
            color: 'var(--text-green-700)',
            border: '1px solid var(--border-green)',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Forecast
        </button>
      )}
      {/* Unified command bar (v2.1187): search + jump chip + GC filter + tools in one container. */}
      <div
        style={{
          flex: '1 1 16rem',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          minHeight: '2.5rem',
          padding: '0 0.25rem 0 0.65rem',
          background: 'var(--surface)',
          border: `1px solid ${focused ? '#3b82f6' : 'var(--border-strong)'}`,
          borderRadius: 10,
          boxShadow: focused ? '0 0 0 3px var(--bg-blue-tint)' : 'none',
          boxSizing: 'border-box',
        }}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flexShrink: 0, color: 'var(--text-muted)' }}
        >
          <circle cx={11} cy={11} r={7} />
          <line x1={21} y1={21} x2={16.4} y2={16.4} />
        </svg>
        <input
          type="text"
          placeholder={
            includeScheduleTimeInSearch
              ? 'Search HCP, name, address, schedule notes, or clock notes'
              : 'Search HCP, name, address'
          }
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-busy={includeScheduleTimeInSearch && scheduleSessionSearchBusy}
          aria-describedby={
            includeScheduleTimeInSearch ? 'stages-search-supplemental-desc' : undefined
          }
          style={{
            flex: '1 1 6rem',
            minWidth: '3.5rem',
            padding: '0.45rem 0',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontSize: '0.9375rem',
          }}
        />
        {serverSearchBusy ? (
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            searching all jobs…
          </span>
        ) : null}
        {includeScheduleTimeInSearch && scheduleSessionSearchBusy ? (
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            + schedule &amp; clock…
          </span>
        ) : null}
        {onOpenSessionNotes ? (
          // Session notes door (v2.2683): lives in the command bar beside the
          // search it complements — same round chip grammar as the # jump.
          <button
            type="button"
            onClick={onOpenSessionNotes}
            title="Session notes — every clock session on one line: what people wrote and where the time landed"
            aria-label="Session notes"
            style={{
              width: '2.1rem',
              height: '2.1rem',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {/* Font Awesome Free 7 "clock" (solid) — owner-picked glyph. */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={17} height={17} aria-hidden>
              <path
                fill="currentColor"
                d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"
              />
            </svg>
          </button>
        ) : null}
        <StagesJobNumberJumpChip onJump={onJumpToNumber} />
        {/* v2.1232: the GC/development selects moved into the ⋯ tools menu.
            The bar only shows an APPLIED filter, as a tap-to-clear chip —
            hidden active filters would make the board look short. */}
        {filters.sortMode !== 'number' ? (
          <button
            type="button"
            onClick={() => onClearSort()}
            title={
              filters.sortMode === 'progress'
                ? 'Rows are sorted by % complete (0 → 100) — tap to go back to job-number order'
                : 'Rows are sorted by time added (newest first) — tap to go back to job-number order'
            }
            aria-label={`Sorted by ${STAGES_SORT_MODE_ACTIVE_CHIP_LABELS[filters.sortMode]} — tap to restore job-number order`}
            style={stagesActiveFilterChipStyle}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Sorted: {STAGES_SORT_MODE_ACTIVE_CHIP_LABELS[filters.sortMode]}</span>
            <span aria-hidden style={{ flexShrink: 0 }}>×</span>
          </button>
        ) : null}
        {filters.contract ? (
          <button
            type="button"
            onClick={() => onClearContract()}
            title="Filtered by contract state — tap to clear"
            aria-label={`Clear contract filter: ${STAGES_CONTRACT_FILTER_LABELS[filters.contract]}`}
            style={stagesActiveFilterChipStyle}
          >
            <span aria-hidden style={{ flexShrink: 0 }}>✍</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {STAGES_CONTRACT_FILTER_LABELS[filters.contract]}
            </span>
            <span aria-hidden style={{ flexShrink: 0 }}>
              ×
            </span>
          </button>
        ) : null}
        {filters.gc ? (
          <button
            type="button"
            onClick={() => onClearGc()}
            title="Filtered by GC/Builder — tap to clear"
            aria-label={`Clear GC filter: ${
              filters.gc === STAGES_GC_FILTER_NO_GC
                ? 'No GC set'
                : filters.gcOptions.find((o) => o.id === filters.gc)?.name ?? 'GC'
            }`}
            style={stagesActiveFilterChipStyle}
          >
            <GcHardHatIcon size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {filters.gc === STAGES_GC_FILTER_NO_GC
                ? 'No GC set'
                : filters.gcOptions.find((o) => o.id === filters.gc)?.name ?? 'GC'}
            </span>
            <span aria-hidden style={{ flexShrink: 0 }}>
              ×
            </span>
          </button>
        ) : null}
        {filters.development ? (
          <button
            type="button"
            onClick={() => onClearDevelopment()}
            title="Filtered by development — tap to clear"
            aria-label={`Clear development filter: ${
              filters.development === STAGES_DEVELOPMENT_FILTER_NONE
                ? 'No development set'
                : filters.developmentOptions.find((o) => o.id === filters.development)?.name ?? 'Development'
            }`}
            style={stagesActiveFilterChipStyle}
          >
            <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {filters.development === STAGES_DEVELOPMENT_FILTER_NONE
                ? 'No development set'
                : filters.developmentOptions.find((o) => o.id === filters.development)?.name ?? 'Development'}
            </span>
            <span aria-hidden style={{ flexShrink: 0 }}>
              ×
            </span>
          </button>
        ) : null}
        {filters.accountMan ? (
          <button
            type="button"
            onClick={() => onClearAccountMan()}
            title="Filtered by Account Man — tap to clear"
            aria-label={`Clear Account Man filter: ${
              filters.accountMan === STAGES_ACCOUNT_MAN_FILTER_NONE
                ? 'No Account Man'
                : filters.accountManOptions.find((o) => o.id === filters.accountMan)?.name ?? 'Account Man'
            }`}
            style={stagesActiveFilterChipStyle}
          >
            <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
              <AccountManIcon size={13} />
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {filters.accountMan === STAGES_ACCOUNT_MAN_FILTER_NONE
                ? 'No Account Man'
                : filters.accountManOptions.find((o) => o.id === filters.accountMan)?.name ?? 'Account Man'}
            </span>
            <span aria-hidden style={{ flexShrink: 0 }}>
              ×
            </span>
          </button>
        ) : null}
        {filters.exclusionCount > 0 ? (
          // Hidden-groups chip (v2.1476): same "the bar only shows an APPLIED
          // filter" rule as the GC/development chips above. Tap opens the
          // manage modal rather than clearing — several hides shouldn't
          // vanish on one accidental tap; "Show everything" lives inside.
          <button
            type="button"
            onClick={() => onOpenHideGroups()}
            title="Some groups are hidden from this board — tap to review"
            aria-label={`${filters.exclusionCount} group${filters.exclusionCount === 1 ? '' : 's'} hidden from the board — review`}
            style={{
              ...stagesActiveFilterChipStyle,
              background: 'var(--bg-red-tint)',
              color: 'var(--text-red-700)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              Hiding {filters.exclusionCount} group{filters.exclusionCount === 1 ? '' : 's'}
            </span>
          </button>
        ) : null}
        <span aria-hidden style={{ flexShrink: 0, width: 1, height: '1.25rem', background: 'var(--border)' }} />
        {toolsMenu}
      </div>
      </div>
    </div>
  )
}
