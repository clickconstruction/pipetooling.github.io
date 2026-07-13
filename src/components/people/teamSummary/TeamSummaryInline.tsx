import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  FieldHoursBody,
  GrossPerHourBody,
  GrossRevenueBody,
  HoursBreakdownBody,
  NetPerHourBody,
  NetRevenueBody,
  OverheadBurdenBody,
  OverheadHoursBody,
  OverheadLaborBody,
  OverheadRateBody,
  ProfitBody,
  ProfitPerHourBody,
} from './drilldowns'
import { TeamSummaryDrilldownModal } from './TeamSummaryDrilldownModal'
import { TEAM_SUMMARY_INLINE_CSS } from './teamSummaryStyles'
import { fmtH, fmtMoney } from './formatters'
import type {
  OverheadRateDecomp,
  TeamSummaryBreakdown,
  TeamSummaryDrilldownType,
  TeamSummarySortKey,
} from './types'

/** Imperative handle exposed to the parent so the after-save flow can
 * re-open the Hours drilldown after the data refresh, and so a
 * lifted-out meta header can still open the Overhead rate drilldown.
 * Mirrors the `team-summary-open-hours-drilldown` postMessage path the
 * iframe used. */
export type TeamSummaryInlineHandle = {
  openDrilldown: (personName: string, type: TeamSummaryDrilldownType) => void
  /** Open the global "overhead_rate" drilldown — used when the meta
   * header is rendered outside this component (showInlineMeta=false)
   * and needs to wire its info button back to the same modal. */
  openOverheadRateDrilldown: (triggerEl?: HTMLElement | null) => void
}

export function TeamSummaryInline(props: {
  /** Stable handle for parent-driven imperative operations. Optional —
   * omit if you don't need to drive the drilldown from outside. */
  handleRef?: React.MutableRefObject<TeamSummaryInlineHandle | null>
  breakdowns: TeamSummaryBreakdown[]
  overheadRate: number | null
  overheadRateLoading: boolean
  overheadDecomp: OverheadRateDecomp
  periodLabel: string
  /** Currently expanded person, or null for none. Drives row tint
   * + chevron icon + per-person detail panel below the table. */
  selectedPersonName: string | null
  onTogglePerson: (personName: string) => void
  /** Click on the day header inside Hours breakdown → opens
   * DashboardMyTimeDayEditorModal for (personName, workDate) in the
   * parent. When undefined, day headers render as plain text. */
  onOpenDayEditor?: (personName: string, workDate: string) => void
  /** Called when the user opens or closes a drilldown modal. The
   * parent uses this to defer Team Summary auto-refresh while a
   * drilldown is mounted (otherwise the body would change under
   * the user mid-read). */
  onDrilldownOpenChange?: (open: boolean) => void
  /** Whether a refresh is in flight; renders a small "Refreshing…"
   * pill in the top-right corner of the table area. */
  refreshing?: boolean
  /** When false, the meta header (Team Summary period label + overhead
   * rate line) is NOT rendered inline. Use when the parent wants to
   * place those lines elsewhere in the page layout (e.g. beside a
   * controls column). The imperative handle's
   * `openOverheadRateDrilldown` still wires up the info-button click.
   * Defaults to true (legacy single-section layout). */
  showInlineMeta?: boolean
  /** When provided, renders an "Open in new window" button in the
   * toolbar after Print — clicking it calls this handler. Use to
   * give the parent a place to hook in a popup-window opener (e.g.
   * `openTeamSummaryWindow('popup')`) without forcing the parent to
   * duplicate the toolbar layout. */
  onOpenInNewWindow?: () => void
}) {
  const {
    handleRef,
    breakdowns,
    overheadRate,
    overheadRateLoading,
    overheadDecomp,
    periodLabel,
    selectedPersonName,
    onTogglePerson,
    onOpenDayEditor,
    onDrilldownOpenChange,
    refreshing,
    showInlineMeta = true,
    onOpenInNewWindow,
  } = props

  // Inject the shared stylesheet exactly once per page-load, regardless
  // of how many Team Summary instances mount. Doing this in a static
  // initializer keeps it out of React's render path.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'team-summary-inline-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = TEAM_SUMMARY_INLINE_CSS
    document.head.appendChild(style)
  }, [])

  const [sortKey, setSortKey] = useState<TeamSummarySortKey>('profitAfterOverhead')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  // Drilldown router. `triggerEl` is the cell the user clicked so we
  // can return focus there on close — matches the iframe's
  // lastFocusedTrigger behavior.
  const [drilldown, setDrilldown] = useState<{
    idx: number
    type: TeamSummaryDrilldownType
    triggerEl: HTMLElement | null
  } | null>(null)

  // Expose openDrilldown imperatively so the parent can re-open the
  // Hours drilldown after a day-editor save (replaces the postMessage
  // round-trip the iframe used).
  useImperativeHandle(
    handleRef,
    () => ({
      openDrilldown: (personName, type) => {
        // overhead_rate is a global drilldown — no per-person row
        // lookup needed (matches the inline button's behavior of
        // sending { idx: -1, type: 'overhead_rate' }).
        if (type === 'overhead_rate') {
          setDrilldown({ idx: -1, type, triggerEl: null })
          return
        }
        const idx = breakdowns.findIndex((b) => b.name === personName)
        if (idx < 0) return
        setDrilldown({ idx, type, triggerEl: null })
      },
      openOverheadRateDrilldown: (triggerEl) => {
        setDrilldown({ idx: -1, type: 'overhead_rate', triggerEl: triggerEl ?? null })
      },
    }),
    [breakdowns],
  )

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const arr = q
      ? breakdowns.filter((r) => r.name.toLowerCase().includes(q))
      : breakdowns.slice()
    arr.sort((a, b) => compareRows(a, b, sortKey, sortDir))
    return arr
  }, [breakdowns, searchQuery, sortKey, sortDir])

  const totals = useMemo(() => computeFooterTotals(visibleRows), [visibleRows])

  const overheadPartsRate =
    overheadDecomp.fieldHours90d > 0
      ? overheadDecomp.officeParts90d / overheadDecomp.fieldHours90d
      : null
  const overheadMetaText = overheadRateLoading
    ? 'Overhead (split): loading…'
    : overheadRate == null || overheadPartsRate == null
      ? 'Overhead (split): unavailable'
      : `Overhead (split): own office/bid labor + $${overheadPartsRate.toFixed(2)}/field-hr office parts (90-day)`
  const overheadMetaClickable = !overheadRateLoading && overheadRate != null

  const handleHeaderSort = useCallback(
    (key: TeamSummarySortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir(key === 'name' ? 'asc' : 'desc')
      }
    },
    [sortKey],
  )

  const handleResetSort = useCallback(() => {
    setSortKey('profitAfterOverhead')
    setSortDir('desc')
  }, [])

  const isDefaultSort = sortKey === 'profitAfterOverhead' && sortDir === 'desc'
  const totalN = breakdowns.length
  const visibleN = visibleRows.length
  const visibleNoun = visibleN === 1 ? 'person' : 'people'
  const totalNoun = totalN === 1 ? 'person' : 'people'
  const footerLabel =
    visibleN === totalN
      ? `${visibleN} ${visibleNoun}`
      : `Filtered total · ${visibleN} of ${totalN} ${totalNoun}`

  // ---- Whole-table print ----
  // Toolbar Print → set body class → window.print() → afterprint
  // restores the screen. The print CSS in teamSummaryStyles hides every
  // sibling outside `.team-summary-print-target`.
  function handleWholeTablePrint() {
    document.body.classList.add('printing-team-summary')
    function onAfterPrint() {
      document.body.classList.remove('printing-team-summary')
      window.removeEventListener('afterprint', onAfterPrint)
    }
    window.addEventListener('afterprint', onAfterPrint)
    try {
      window.print()
    } catch {
      document.body.classList.remove('printing-team-summary')
    }
  }

  // ---- Drilldown router ----
  const currentEntry: TeamSummaryBreakdown | null =
    drilldown != null ? breakdowns[drilldown.idx] ?? null : null
  const drilldownTitle =
    drilldown == null
      ? ''
      : drilldownTitleFor(drilldown.type, currentEntry, overheadDecomp)
  const drilldownBody =
    drilldown == null
      ? null
      : renderDrilldownBody(
          drilldown.type,
          currentEntry,
          overheadRate,
          overheadDecomp,
          { onOpenDayEditor },
        )

  const closeDrilldown = useCallback(() => setDrilldown(null), [])

  return (
    <div
      className="team-summary-print-target"
      style={{ position: 'relative', width: '100%' }}
    >
      {showInlineMeta ? (
        <>
          <div className="team-summary-meta">
            {periodLabel} &middot; {totalN} {totalNoun}
          </div>
          <div className="team-summary-meta-sub">
            {overheadMetaClickable ? (
              <button
                type="button"
                className="team-summary-meta-sub-btn"
                title="Click for rate decomposition"
                onClick={(e) =>
                  setDrilldown({
                    idx: -1,
                    type: 'overhead_rate',
                    triggerEl: e.currentTarget,
                  })
                }
              >
                {overheadMetaText} <span aria-hidden="true">&#9432;</span>
              </button>
            ) : (
              overheadMetaText
            )}
          </div>
        </>
      ) : null}

      <div className="team-summary-tools" data-print-hide="true">
        <input
          type="search"
          placeholder="Search by name…"
          aria-label="Filter people by name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery.trim() ? (
          <span className="team-summary-filter-status" aria-live="polite">
            Showing {visibleN} of {totalN} {totalNoun}
          </span>
        ) : null}
        <button
          type="button"
          className="team-summary-reset-sort-btn"
          title="Sort by Profit (after overhead), descending"
          onClick={handleResetSort}
          disabled={isDefaultSort}
        >
          Reset sort
        </button>
        <button
          type="button"
          className="team-summary-print-btn"
          title="Print the whole Team Summary table"
          onClick={handleWholeTablePrint}
        >
          Print
        </button>
        {onOpenInNewWindow ? (
          <button
            type="button"
            className="team-summary-open-window-btn"
            title="Open the same fully-interactive summary in a new browser window (handy for printing or sharing)"
            onClick={onOpenInNewWindow}
          >
            Open in new window
          </button>
        ) : null}
      </div>

      <div className="team-summary-scroll">
        <table className="team-summary-table">
          <thead>
            <tr>
              <th
                aria-label="Rank"
                style={{ textAlign: 'center', verticalAlign: 'middle', color: 'var(--text-muted)', width: '1%' }}
              >
                #
              </th>
              <SortableTh sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort}>
                Name
              </SortableTh>
              <SortableTh sortKey="totalHours" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Hours
              </SortableTh>
              <SortableTh sortKey="overheadHours" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Overhead<br />Hours
              </SortableTh>
              <SortableTh sortKey="overheadLaborCost" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Overhead<br />Labor
              </SortableTh>
              <SortableTh sortKey="overheadBurden" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Overhead<br />Burden
              </SortableTh>
              <SortableTh sortKey="fieldHours" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Field<br />hrs
              </SortableTh>
              <SortableTh sortKey="gross" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Gross<br />Revenue
              </SortableTh>
              <SortableTh sortKey="net" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Net<br />Revenue
              </SortableTh>
              <SortableTh sortKey="profitAfterOverhead" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Profit
              </SortableTh>
              <SortableTh sortKey="revPerHour" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Gross<br />Revenue/hr
              </SortableTh>
              <SortableTh sortKey="netPerHour" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Net<br />Revenue/hr
              </SortableTh>
              <SortableTh sortKey="profitPerHourAfterOverhead" currentKey={sortKey} currentDir={sortDir} onSort={handleHeaderSort} num>
                Profit/hr<br />(after overhead)
              </SortableTh>
            </tr>
          </thead>
          <tbody className={visibleRows.length === 0 ? 'empty-state' : undefined}>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={13}>
                  No matches
                  {searchQuery.trim() ? ` for \u201C${searchQuery.trim()}\u201D` : ''}.
                </td>
              </tr>
            ) : (
              visibleRows.map((r, i) => (
                <Row
                  key={r.name}
                  rank={i + 1}
                  r={r}
                  isSelected={selectedPersonName != null && r.name === selectedPersonName}
                  onTogglePerson={onTogglePerson}
                  onOpenDrilldown={(type, triggerEl) =>
                    setDrilldown({ idx: r.idx, type, triggerEl })
                  }
                />
              ))
            )}
          </tbody>
          <tfoot>
            <FooterRow label={footerLabel} totals={totals} />
          </tfoot>
        </table>
      </div>

      <p className="team-summary-footer-caption">
        {searchQuery.trim() && visibleN < totalN
          ? 'Footer totals reflect only the people shown above. '
          : ''}
        Workers archived or external-only contribute to job revenue but are
        not in this table; their share of those jobs is not summed here.
      </p>

      {refreshing ? (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.85)',
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
          }}
        >
          Refreshing…
        </div>
      ) : null}

      <TeamSummaryDrilldownModal
        title={drilldownTitle}
        open={drilldown != null}
        onClose={closeDrilldown}
        triggerEl={drilldown?.triggerEl ?? null}
        onOpenChange={onDrilldownOpenChange}
      >
        {drilldownBody}
      </TeamSummaryDrilldownModal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function SortableTh(props: {
  sortKey: TeamSummarySortKey
  currentKey: TeamSummarySortKey
  currentDir: 'asc' | 'desc'
  onSort: (key: TeamSummarySortKey) => void
  num?: boolean
  children: React.ReactNode
}) {
  const { sortKey, currentKey, currentDir, onSort, num, children } = props
  const isActive = sortKey === currentKey
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? currentDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'
  const indicator = isActive ? (currentDir === 'asc' ? '▲' : '▼') : ''
  return (
    <th
      className={num ? 'num' : undefined}
      data-sort={sortKey}
      tabIndex={0}
      role="columnheader"
      aria-sort={ariaSort}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault()
          onSort(sortKey)
        }
      }}
    >
      {children}
      <span className="sort-indicator" aria-hidden="true">{indicator}</span>
    </th>
  )
}

function Row(props: {
  rank: number
  r: TeamSummaryBreakdown
  isSelected: boolean
  onTogglePerson: (personName: string) => void
  onOpenDrilldown: (type: TeamSummaryDrilldownType, triggerEl: HTMLElement) => void
}) {
  const { rank, r, isSelected, onTogglePerson, onOpenDrilldown } = props
  const hasHours = r.totalHours > 0
  // Salaried people earn 8 hrs/weekday regardless of clock — showing
  // "40.0" in the Hours column reads like a measurement when it's
  // actually an assumption. Render "(s)" instead, but keep r.totalHours
  // intact so the footer total still sums their 40 and the drilldown
  // shows the per-day breakdown.
  const isSalary = r.payConfigSource === 'salary'
  const hoursContent = isSalary ? '(s)' : fmtH(r.totalHours)
  const hoursAriaLabel = isSalary
    ? `Hours breakdown for ${r.name}: salary (${fmtH(r.totalHours)} hours assumed)`
    : `Hours breakdown for ${r.name}: ${fmtH(r.totalHours)} hours`
  const hoursTitle = isSalary
    ? `Salaried — ${fmtH(r.totalHours)} hrs assumed (8 hrs/weekday). Click for breakdown.`
    : 'Click for breakdown'
  return (
    <tr className={isSelected ? 'selected-person' : undefined}>
      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{rank}</td>
      <td>
        <NameCell name={r.name} isSelected={isSelected} onToggle={onTogglePerson} />
      </td>
      <ClickCell
        type="hours"
        idx={r.idx}
        ariaLabel={hoursAriaLabel}
        title={hoursTitle}
        content={hoursContent}
        onOpen={onOpenDrilldown}
      />
      {r.overheadHours <= 0 ? <DashTd /> : (
        <ClickCell
          type="overhead_hours"
          idx={r.idx}
          ariaLabel={`Overhead hours breakdown for ${r.name}: ${fmtH(r.overheadHours)} hours`}
          title="Click for office vs bid breakdown"
          content={fmtH(r.overheadHours)}
          onOpen={onOpenDrilldown}
        />
      )}
      {!(r.overheadLaborCost < 0) ? <DashTd /> : (
        <ClickCell
          type="overhead_labor"
          idx={r.idx}
          ariaLabel={`Overhead labor breakdown for ${r.name}: ${fmtMoney(r.overheadLaborCost)}`}
          title="Click for overhead-labor breakdown"
          content={fmtMoney(r.overheadLaborCost)}
          colored={false}
          extraStyle={{ color: 'var(--text-red-700)' }}
          onOpen={onOpenDrilldown}
        />
      )}
      {r.overheadBurden == null || r.overheadBurden >= 0 ? <DashTd /> : (
        <ClickCell
          type="overhead_burden"
          idx={r.idx}
          ariaLabel={`Overhead burden breakdown for ${r.name}: ${fmtMoney(r.overheadBurden)}`}
          title="Click for overhead-burden breakdown"
          content={fmtMoney(r.overheadBurden)}
          colored={false}
          extraStyle={{ color: 'var(--text-red-700)' }}
          onOpen={onOpenDrilldown}
        />
      )}
      {r.fieldHours <= 0 ? <DashTd /> : (
        <ClickCell
          type="field_hours"
          idx={r.idx}
          ariaLabel={`Field hours breakdown for ${r.name}: ${fmtH(r.fieldHours)} hours`}
          title="Click for field-hours breakdown"
          content={fmtH(r.fieldHours)}
          onOpen={onOpenDrilldown}
        />
      )}
      <ClickCell
        type="gross"
        idx={r.idx}
        ariaLabel={`Gross revenue breakdown for ${r.name}: ${fmtMoney(r.gross)}`}
        content={fmtMoney(r.gross)}
        extraStyle={r.gross < 0 ? { color: 'var(--text-red-700)' } : undefined}
        onOpen={onOpenDrilldown}
      />
      <ClickCell
        type="net"
        idx={r.idx}
        ariaLabel={`Net revenue breakdown for ${r.name}: ${fmtMoney(r.net)}`}
        content={fmtMoney(r.net)}
        extraStyle={r.net < 0 ? { color: 'var(--text-red-700)' } : undefined}
        onOpen={onOpenDrilldown}
      />
      {r.profitAfterOverhead == null ? <DashTd /> : (
        <ClickCell
          type="profit"
          idx={r.idx}
          ariaLabel={`Profit after overhead breakdown for ${r.name}: ${fmtMoney(r.profitAfterOverhead)}`}
          content={fmtMoney(r.profitAfterOverhead)}
          extraStyle={r.profitAfterOverhead < 0 ? { color: 'var(--text-red-700)' } : undefined}
          onOpen={onOpenDrilldown}
        />
      )}
      {hasHours ? (
        <ClickCell
          type="rev_per_hr"
          idx={r.idx}
          ariaLabel={`Gross revenue per hour breakdown for ${r.name}: ${fmtMoney(r.revPerHour)} per hour`}
          content={fmtMoney(r.revPerHour)}
          extraStyle={r.revPerHour < 0 ? { color: 'var(--text-red-700)' } : undefined}
          onOpen={onOpenDrilldown}
        />
      ) : (
        <DashTd />
      )}
      {hasHours ? (
        <ClickCell
          type="net_per_hr"
          idx={r.idx}
          ariaLabel={`Net revenue per hour breakdown for ${r.name}: ${fmtMoney(r.netPerHour)} per hour`}
          content={fmtMoney(r.netPerHour)}
          extraStyle={r.netPerHour < 0 ? { color: 'var(--text-red-700)' } : undefined}
          onOpen={onOpenDrilldown}
        />
      ) : (
        <DashTd />
      )}
      {hasHours && r.profitPerHourAfterOverhead != null ? (
        <ClickCell
          type="profit_per_hr"
          idx={r.idx}
          ariaLabel={`Profit per hour after overhead breakdown for ${r.name}: ${fmtMoney(r.profitPerHourAfterOverhead)} per hour`}
          content={fmtMoney(r.profitPerHourAfterOverhead)}
          extraStyle={r.profitPerHourAfterOverhead < 0 ? { color: 'var(--text-red-700)' } : undefined}
          onOpen={onOpenDrilldown}
        />
      ) : (
        <DashTd />
      )}
    </tr>
  )
}

function NameCell(props: {
  name: string
  isSelected: boolean
  onToggle: (name: string) => void
}) {
  const { name, isSelected, onToggle } = props
  return (
    <button
      type="button"
      className="team-summary-person-name-btn"
      aria-pressed={isSelected}
      title={isSelected ? 'Hide breakdown' : 'Show breakdown'}
      onClick={() => onToggle(name)}
    >
      <span className="chevron" aria-hidden="true">
        {isSelected ? '▾' : '▸'}
      </span>
      <span className="person-name-text">{name}</span>
    </button>
  )
}

const CELL_STYLE_BASE: CSSProperties = {
  padding: '0.4rem 0.75rem',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
}
const CELL_STYLE_DASH: CSSProperties = {
  padding: '0.4rem 0.75rem',
  textAlign: 'center',
  color: 'var(--text-faint)',
}

function DashTd() {
  return <td style={CELL_STYLE_DASH}>&mdash;</td>
}

function ClickCell(props: {
  type: TeamSummaryDrilldownType
  idx: number
  ariaLabel: string
  title?: string
  content: string
  colored?: boolean
  extraStyle?: CSSProperties
  onOpen: (type: TeamSummaryDrilldownType, triggerEl: HTMLElement) => void
}) {
  const { type, ariaLabel, title = 'Click for breakdown', content, colored, extraStyle, onOpen } = props
  const style: CSSProperties = {
    ...CELL_STYLE_BASE,
    cursor: 'pointer',
    color: colored === false ? undefined : 'var(--text-link)',
    textDecoration: 'underline dotted',
    textUnderlineOffset: '2px',
    ...extraStyle,
  }
  function handleClick(e: ReactMouseEvent<HTMLTableCellElement>) {
    onOpen(type, e.currentTarget)
  }
  function handleKeyDown(e: ReactKeyboardEvent<HTMLTableCellElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      onOpen(type, e.currentTarget)
    }
  }
  return (
    <td
      className="click-cell"
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      title={title}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {content}
    </td>
  )
}

function FooterRow(props: {
  label: string
  totals: ReturnType<typeof computeFooterTotals>
}) {
  const { label, totals } = props
  const teamGrossPerHr = totals.hours > 0 ? totals.gross / totals.hours : 0
  const teamNetPerHr = totals.hours > 0 ? totals.net / totals.hours : 0
  const teamProfitPerHr = totals.profit != null && totals.hours > 0 ? totals.profit / totals.hours : null
  const tdStyle: CSSProperties = { padding: '0.5rem 0.75rem' }
  const baseNum: CSSProperties = { padding: '0.4rem 0.75rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }
  return (
    <tr style={{ fontWeight: 600, background: 'var(--bg-subtle)' }}>
      <td />
      <td style={tdStyle}>{label}</td>
      <td style={baseNum}>{fmtH(totals.hours)}</td>
      <td style={baseNum}>{fmtH(totals.overheadHours)}</td>
      <td style={{ ...baseNum, ...(totals.overheadLaborCost < 0 ? { color: 'var(--text-red-700)' } : {}) }}>
        {fmtMoney(totals.overheadLaborCost)}
      </td>
      {totals.overheadBurden == null ? <DashTd /> : (
        <td style={{ ...baseNum, ...(totals.overheadBurden < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(totals.overheadBurden)}</td>
      )}
      <td style={baseNum}>{fmtH(totals.fieldHours)}</td>
      <td style={{ ...baseNum, ...(totals.gross < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(totals.gross)}</td>
      <td style={{ ...baseNum, ...(totals.net < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(totals.net)}</td>
      {totals.profit == null ? <DashTd /> : (
        <td style={{ ...baseNum, ...(totals.profit < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(totals.profit)}</td>
      )}
      {totals.hours > 0 ? (
        <td style={{ ...baseNum, ...(teamGrossPerHr < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(teamGrossPerHr)}</td>
      ) : <DashTd />}
      {totals.hours > 0 ? (
        <td style={{ ...baseNum, ...(teamNetPerHr < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(teamNetPerHr)}</td>
      ) : <DashTd />}
      {totals.hours > 0 && teamProfitPerHr != null ? (
        <td style={{ ...baseNum, ...(teamProfitPerHr < 0 ? { color: 'var(--text-red-700)' } : {}) }}>{fmtMoney(teamProfitPerHr)}</td>
      ) : <DashTd />}
    </tr>
  )
}

function computeFooterTotals(visibleRows: TeamSummaryBreakdown[]) {
  const totals = {
    hours: 0,
    overheadHours: 0,
    fieldHours: 0,
    overheadLaborCost: 0,
    overheadBurden: null as number | null,
    gross: 0,
    net: 0,
    profit: null as number | null,
  }
  for (const r of visibleRows) {
    totals.hours += r.totalHours
    totals.overheadHours += r.overheadHours
    totals.fieldHours += r.fieldHours
    totals.overheadLaborCost += r.overheadLaborCost
    if (r.overheadBurden != null) {
      totals.overheadBurden = (totals.overheadBurden || 0) + r.overheadBurden
    }
    totals.gross += r.gross
    totals.net += r.net
    if (r.profitAfterOverhead != null) {
      totals.profit = (totals.profit || 0) + r.profitAfterOverhead
    }
  }
  return totals
}

function compareRows(
  a: TeamSummaryBreakdown,
  b: TeamSummaryBreakdown,
  sortKey: TeamSummarySortKey,
  sortDir: 'asc' | 'desc',
): number {
  const av = (a as unknown as Record<string, unknown>)[sortKey]
  const bv = (b as unknown as Record<string, unknown>)[sortKey]
  const aN = av == null
  const bN = bv == null
  if (aN && bN) return a.name.localeCompare(b.name)
  if (aN) return 1
  if (bN) return -1
  let d: number
  if (sortKey === 'name') {
    d = String(av).localeCompare(String(bv))
  } else {
    d = (av as number) < (bv as number) ? -1 : (av as number) > (bv as number) ? 1 : 0
  }
  if (d === 0) return a.name.localeCompare(b.name)
  return sortDir === 'asc' ? d : -d
}

function drilldownTitleFor(
  type: TeamSummaryDrilldownType,
  entry: TeamSummaryBreakdown | null,
  _overheadDecomp: OverheadRateDecomp,
): string {
  if (type === 'overhead_rate') {
    return 'Overhead rate decomposition (rolling 90 days)'
  }
  if (!entry) return ''
  switch (type) {
    case 'hours':
      return `Hours breakdown — ${entry.name} · ${fmtH(entry.hb.totals.totalHours)} hrs`
    case 'overhead_hours': {
      const ohTotalHrs = (entry.officeHours || 0) + (entry.bidHours || 0)
      return `Overhead hours breakdown — ${entry.name} · ${fmtH(ohTotalHrs)} hrs`
    }
    case 'field_hours':
      return `Field hours breakdown — ${entry.name} · ${fmtH(entry.fieldHours || 0)} hrs`
    case 'overhead_burden':
      return `Overhead burden breakdown — ${entry.name} · ${fmtMoney(entry.overheadBurden ?? 0)}`
    case 'overhead_labor': {
      // Surface the hourly_wage in the title so reviewers don't have
      // to open the modal to see what rate drives the cost column.
      // Falls back to "no wage" when people_pay_config has no row /
      // hourly_wage is null — matches OverheadLaborBody's body copy.
      const wage = entry.hourlyWage || 0
      const wageSuffix =
        wage > 0 ? ` · $${wage.toFixed(2)}/hr` : ' · no wage configured'
      return `Overhead labor breakdown — ${entry.name}${wageSuffix}`
    }
    case 'gross':
      return `Gross Revenue breakdown — ${entry.name} · ${fmtMoney((entry.gb && entry.gb.total) || 0)}`
    case 'net':
      return `Net Revenue breakdown — ${entry.name} · ${fmtMoney((entry.nb && entry.nb.total) || 0)}`
    case 'profit':
      return `Profit (after overhead) breakdown — ${entry.name}`
    case 'rev_per_hr':
      return `Gross Revenue/hr breakdown — ${entry.name}`
    case 'net_per_hr':
      return `Net Revenue/hr breakdown — ${entry.name}`
    case 'profit_per_hr':
      return `Profit/hr (after overhead) breakdown — ${entry.name}`
    default:
      return ''
  }
}

function renderDrilldownBody(
  type: TeamSummaryDrilldownType,
  entry: TeamSummaryBreakdown | null,
  overheadRate: number | null,
  overheadDecomp: OverheadRateDecomp,
  opts: { onOpenDayEditor?: (personName: string, workDate: string) => void },
): React.ReactNode {
  if (type === 'overhead_rate') {
    return <OverheadRateBody overheadDecomp={overheadDecomp} />
  }
  if (!entry) return null
  switch (type) {
    case 'hours':
      return (
        <HoursBreakdownBody
          hb={entry.hb}
          personName={entry.name}
          clickableDay={!!opts.onOpenDayEditor}
          onOpenDayEditor={opts.onOpenDayEditor}
        />
      )
    case 'overhead_hours':
      return <OverheadHoursBody entry={entry} />
    case 'overhead_labor':
      return <OverheadLaborBody entry={entry} />
    case 'field_hours':
      return <FieldHoursBody entry={entry} overheadRate={overheadRate} />
    case 'overhead_burden':
      return <OverheadBurdenBody entry={entry} overheadDecomp={overheadDecomp} />
    case 'gross':
      return <GrossRevenueBody gb={entry.gb} />
    case 'net':
      return <NetRevenueBody nb={entry.nb} />
    case 'profit':
      return <ProfitBody entry={entry} overheadDecomp={overheadDecomp} />
    case 'rev_per_hr':
      return <GrossPerHourBody entry={entry} />
    case 'net_per_hr':
      return <NetPerHourBody entry={entry} />
    case 'profit_per_hr':
      return <ProfitPerHourBody entry={entry} overheadDecomp={overheadDecomp} />
    default:
      return null
  }
}
