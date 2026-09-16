/**
 * The Pipeline board's ⋯ tools menu (Stages tab decomposition PR 2, v2.3532).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (region 2 of `docs/JOBS_STAGES_TAB_ARCHITECTURE.md`).
 * The trigger tints blue while the menu is open or any filter / sort is applied. Picking a
 * sort or a filter keeps the menu open (several can be set at once); every door item closes
 * it first. `open` stays a controlled prop: the tab also reads it to decide the board needs
 * every row loaded (the filter selects derive their options from loaded rows).
 */
import type { CSSProperties } from 'react'
import { stagesToolsMenuItemStyle } from './stagesToolsMenuStyles'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import AccountManIcon from '../icons/AccountManIcon'
import {
  parseStagesContractFilter,
  STAGES_CONTRACT_FILTER_LABELS,
  STAGES_CONTRACT_FILTERS,
  type StagesContractFilter,
} from '../../lib/jobs/jobContractCoverage'
import { STAGES_SORT_MODE_LABELS, STAGES_SORT_MODES, type StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import {
  STAGES_ACCOUNT_MAN_FILTER_NONE,
  STAGES_DEVELOPMENT_FILTER_NONE,
  STAGES_GC_FILTER_NO_GC,
} from '../../lib/jobsStagesBoard'

type FilterOption = { id: string; name: string }

/** What the board is currently narrowed or ordered by — the menu shows it and tints on it. */
export type StagesToolsFilters = {
  sortMode: StagesBoardSortMode
  contract: StagesContractFilter | ''
  gc: string
  gcOptions: readonly FilterOption[]
  development: string
  developmentOptions: readonly FilterOption[]
  accountMan: string
  accountManOptions: readonly FilterOption[]
  /** Groups hidden through "Hide groups…" (v2.1476). */
  exclusionCount: number
}

/** The per-device board modes the bottom of the menu toggles. */
export type StagesToolsToggles = {
  includeScheduleTimeInSearch: boolean
  followMoves: boolean
  hamMode: boolean
  editMode: boolean
  mobileCards: boolean
}

/** Who sees which items — decided by the tab through `lib/jobs/stagesRoleGates.ts`. */
export type StagesToolsGates = {
  lienDesk: boolean
  jobContracts: boolean
  officeTools: boolean
  powerToggles: boolean
}

export type JobsStagesToolsMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: StagesToolsFilters
  onSortModeChange: (mode: StagesBoardSortMode) => void
  onContractFilterChange: (value: StagesContractFilter | '') => void
  onGcFilterChange: (value: string) => void
  onDevelopmentFilterChange: (value: string) => void
  onAccountManFilterChange: (value: string) => void
  gates: StagesToolsGates
  lienDeskCount: number | null
  contractSweepCount: number
  onOpenLienDesk: () => void
  /** Only offered while a real GC filter is applied; receives that GC's id. */
  onPutGcOnNotice: (gcId: string) => void
  onOpenContractSweep: () => void
  onOpenHideGroups: () => void
  onOpenJobBook: () => void
  onOpenTotalByName: () => void
  onOpenCombineSeparate: () => void
  toggles: StagesToolsToggles
  onToggleIncludeScheduleTimeInSearch: () => void
  onToggleFollowMoves: () => void
  onToggleHamMode: () => void
  onToggleEditMode: () => void
  onToggleMobileCards: () => void
}

const stagesToolsMenuFilterSelectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  textOverflow: 'ellipsis',
  cursor: 'pointer',
}

function renderStagesToolsMenuToggleState(on: boolean) {
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        padding: '0.1rem 0.45rem',
        borderRadius: 999,
        background: on ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
        color: on ? 'var(--text-link)' : 'var(--text-faint)',
      }}
    >
      {on ? 'On' : 'Off'}
    </span>
  )
}

export function JobsStagesToolsMenu({
  open,
  onOpenChange,
  filters,
  onSortModeChange,
  onContractFilterChange,
  onGcFilterChange,
  onDevelopmentFilterChange,
  onAccountManFilterChange,
  gates,
  lienDeskCount,
  contractSweepCount,
  onOpenLienDesk,
  onPutGcOnNotice,
  onOpenContractSweep,
  onOpenHideGroups,
  onOpenJobBook,
  onOpenTotalByName,
  onOpenCombineSeparate,
  toggles,
  onToggleIncludeScheduleTimeInSearch,
  onToggleFollowMoves,
  onToggleHamMode,
  onToggleEditMode,
  onToggleMobileCards,
}: JobsStagesToolsMenuProps) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      title="Pipeline tools"
      aria-label="Pipeline tools"
      aria-haspopup="menu"
      aria-expanded={open}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        padding: 0,
        border: 'none',
        borderRadius: 8,
        background:
          open || filters.gc || filters.development || filters.accountMan || filters.exclusionCount > 0 || filters.sortMode !== 'number'
            ? 'var(--bg-blue-tint)'
            : 'transparent',
        cursor: 'pointer',
        color:
          open || filters.gc || filters.development || filters.accountMan || filters.exclusionCount > 0 || filters.sortMode !== 'number'
            ? 'var(--text-link)'
            : 'var(--text-muted)',
        fontSize: '1.2rem',
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      ⋯
    </button>
    {open ? (
      <>
        <div
          onClick={() => onOpenChange(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 120 }}
        />
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 121,
            minWidth: 250,
            padding: '0.3rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {gates.lienDesk ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false)
                onOpenLienDesk()
              }}
              title="Lien notices due per unpaid work month on sub jobs — draft, approve, send"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', borderRadius: 4, fontSize: '0.8125rem' }}
            >
              <span aria-hidden>⏱</span>
              <span>Lien desk</span>
              {typeof lienDeskCount === 'number' && lienDeskCount > 0 ? <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lienDeskCount}</span> : null}
            </button>
          ) : null}
          {gates.lienDesk && filters.gc && filters.gc !== STAGES_GC_FILTER_NO_GC ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false)
                onPutGcOnNotice(filters.gc)
              }}
              title="Every owner on every job with this GC gets the § 53.056 notice for every unnoticed month, in one approved run"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', border: 'none', background: 'var(--bg-amber-tint)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-amber-800)', borderRadius: 4, fontWeight: 600 }}
            >
              <span aria-hidden>⚠</span>
              <span>Put {filters.gcOptions.find((o) => o.id === filters.gc)?.name ?? 'this GC'} on notice…</span>
            </button>
          ) : null}
          {/* Sort group (v2.1807) — row order inside every section.
              Picking keeps the menu open, matching the filters below. */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.25rem 0.75rem 0.1rem' }}>
            Sort
          </div>
          {STAGES_SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={filters.sortMode === mode}
              onClick={() => onSortModeChange(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.3rem 0.75rem',
                border: 'none',
                borderRadius: 4,
                background: filters.sortMode === mode ? 'var(--bg-blue-tint)' : 'transparent',
                color: filters.sortMode === mode ? 'var(--text-link)' : 'var(--text-700)',
                fontSize: '0.8125rem',
                fontWeight: filters.sortMode === mode ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span aria-hidden style={{ width: 14, flexShrink: 0 }}>{filters.sortMode === mode ? '✓' : ''}</span>
              {STAGES_SORT_MODE_LABELS[mode]}
            </button>
          ))}
          {/* Filters group (v2.1232) — moved out of the search bar.
              Selecting keeps the menu open so several can be set at once.
              Always rendered since v2.1477 so "Hide groups…" has a stable home. */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.35rem 0.75rem 0.1rem', borderTop: '1px solid var(--border)', marginTop: 2 }}>
            Filters
          </div>
              {gates.jobContracts ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem' }}>
                  <span aria-hidden style={{ color: 'var(--text-muted)', flexShrink: 0, width: 15, textAlign: 'center' }}>✍</span>
                  <select
                    value={filters.contract}
                    onChange={(e) => onContractFilterChange(parseStagesContractFilter(e.target.value))}
                    aria-label="Filter the Pipeline board by contract state"
                    title="Filter the Pipeline board by contract state"
                    style={{
                      ...stagesToolsMenuFilterSelectStyle,
                      background: filters.contract ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: filters.contract ? 'var(--text-link)' : 'inherit',
                    }}
                  >
                    <option value="">Any contract state</option>
                    {STAGES_CONTRACT_FILTERS.map((f) => (
                      <option key={f} value={f}>
                        {STAGES_CONTRACT_FILTER_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {filters.gcOptions.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem' }}>
                  <GcHardHatIcon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <select
                    value={filters.gc}
                    onChange={(e) => onGcFilterChange(e.target.value)}
                    aria-label="Filter the Pipeline board by GC/Builder"
                    title="Filter the Pipeline board by GC/Builder"
                    style={{
                      ...stagesToolsMenuFilterSelectStyle,
                      background: filters.gc ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: filters.gc ? 'var(--text-link)' : 'inherit',
                    }}
                  >
                    <option value="">All GCs</option>
                    {filters.gcOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                    <option value={STAGES_GC_FILTER_NO_GC}>No GC set</option>
                  </select>
                </div>
              ) : null}
              {filters.developmentOptions.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem 0.35rem' }}>
                  <DevelopmentHouseIcon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <select
                    value={filters.development}
                    onChange={(e) => onDevelopmentFilterChange(e.target.value)}
                    aria-label="Filter the Pipeline board by development"
                    title="Filter the Pipeline board by development"
                    style={{
                      ...stagesToolsMenuFilterSelectStyle,
                      background: filters.development ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: filters.development ? 'var(--text-link)' : 'inherit',
                    }}
                  >
                    <option value="">All developments</option>
                    {filters.developmentOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                    <option value={STAGES_DEVELOPMENT_FILTER_NONE}>No development set</option>
                  </select>
                </div>
              ) : null}
          {filters.accountManOptions.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.75rem 0.35rem' }}>
              <span aria-hidden style={{ display: 'inline-flex', color: 'var(--text-muted)', flexShrink: 0 }}>
                <AccountManIcon size={15} />
              </span>
              <select
                value={filters.accountMan}
                onChange={(e) => onAccountManFilterChange(e.target.value)}
                aria-label="Filter the Pipeline board by Account Man"
                title="Filter the Pipeline board by Account Man"
                style={{
                  ...stagesToolsMenuFilterSelectStyle,
                  background: filters.accountMan ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: filters.accountMan ? 'var(--text-link)' : 'inherit',
                }}
              >
                <option value="">All Account Men</option>
                {filters.accountManOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
                <option value={STAGES_ACCOUNT_MAN_FILTER_NONE}>No Account Man</option>
              </select>
            </div>
          ) : null}
          {gates.jobContracts ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false)
                onOpenContractSweep()
              }}
              title="Every live job with no agreement on file, one row each, with Send"
              style={stagesToolsMenuItemStyle}
            >
              <span>Contract sweep…</span>
              {contractSweepCount > 0 ? (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>
                  {contractSweepCount} without
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenChange(false)
              onOpenHideGroups()
            }}
            title="Hide chosen GCs, developments, or Account Men from the board"
            style={stagesToolsMenuItemStyle}
          >
            <span>Hide groups…</span>
            {filters.exclusionCount > 0 ? (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)' }}>
                {filters.exclusionCount} hidden
              </span>
            ) : null}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '0.2rem 0.3rem' }} />
          {gates.officeTools ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false)
                onOpenJobBook()
              }}
              style={stagesToolsMenuItemStyle}
            >
              <span>Job Book…</span>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenChange(false)
              onOpenTotalByName()
            }}
            style={stagesToolsMenuItemStyle}
          >
            <span>Total by Name…</span>
          </button>
          {gates.officeTools ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false)
                onOpenCombineSeparate()
              }}
              title="Combine two jobs or split Specific Work into a new job"
              style={stagesToolsMenuItemStyle}
            >
              <span>Combine / Separate…</span>
            </button>
          ) : null}
          <div style={{ height: 1, background: 'var(--border)', margin: '0.2rem 0.3rem' }} />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={toggles.includeScheduleTimeInSearch}
            onClick={onToggleIncludeScheduleTimeInSearch}
            title="Also match dispatch schedule and clock sessions (notes, names, dates) while searching"
            style={stagesToolsMenuItemStyle}
          >
            <span>Schedule &amp; time in search</span>
            {renderStagesToolsMenuToggleState(toggles.includeScheduleTimeInSearch)}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={toggles.followMoves}
            onClick={onToggleFollowMoves}
            title="After you move a card, scroll to it in its new section and highlight it"
            style={stagesToolsMenuItemStyle}
          >
            <span>Follow cards I move</span>
            {renderStagesToolsMenuToggleState(toggles.followMoves)}
          </button>
          {gates.powerToggles ? (
            <>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={toggles.hamMode}
                onClick={onToggleHamMode}
                title={toggles.hamMode ? 'Ham mode on: faster shortcuts for some stage actions' : 'Ham mode off: all stage confirmations'}
                style={stagesToolsMenuItemStyle}
              >
                <span>Ham mode</span>
                {renderStagesToolsMenuToggleState(toggles.hamMode)}
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={toggles.editMode}
                onClick={onToggleEditMode}
                title={
                  toggles.editMode
                    ? 'Edit mode on: every job row wears an EDIT tab that opens Edit Job in one tap'
                    : 'Edit mode off: open Edit Job through Job Detail as usual'
                }
                style={stagesToolsMenuItemStyle}
              >
                <span>Edit mode</span>
                {renderStagesToolsMenuToggleState(toggles.editMode)}
              </button>
            </>
          ) : null}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={toggles.mobileCards}
            onClick={onToggleMobileCards}
            title={
              toggles.mobileCards
                ? 'Mobile cards on: sections render as full-width cards built for phones'
                : 'Mobile cards off: sections render as the classic desktop tables'
            }
            style={stagesToolsMenuItemStyle}
          >
            <span>Mobile cards</span>
            {renderStagesToolsMenuToggleState(toggles.mobileCards)}
          </button>
        </div>
      </>
    ) : null}
  </div>
  )
}
