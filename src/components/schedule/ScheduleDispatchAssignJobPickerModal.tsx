import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { isFinishedJobPickerStatus, jobPickerStatusChip } from '../../lib/scheduleDispatchHub'
import { formatDaysAgoShort } from '../../lib/duplicateJobAddressGroups'
import type { JobSearchEvidence, JobSearchEvidenceMode } from '../../lib/jobSearchEvidence'

function railDollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}
import { splitTextForQueryHighlight } from '../../lib/assignJobPickerHighlight'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight'

/** Query occurrences render tinted+bold; plain text passes through untouched. */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segs = splitTextForQueryHighlight(text, query)
  if (segs.length === 0 || (segs.length === 1 && !segs[0]?.match)) return <>{text}</>
  return (
    <>
      {segs.map((s, i) =>
        s.match ? (
          <mark
            key={i}
            style={{
              background: 'var(--bg-blue-tint)',
              color: 'var(--text-blue-800)',
              fontWeight: 700,
              borderRadius: 2,
              padding: 0,
            }}
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

export type ScheduleDispatchAssignJobPickerRow = {
  id: string
  displayTitle: string
  /** Service type name (e.g. Plumbing) — rendered as the PLUM/ELEC/HVAC trade pill. */
  serviceTypeName?: string | null
  /** Muted second line under the title (e.g. "07/14/26 | 123 Main St" — date added | address). */
  subline?: string
  /** Pipeline state (waiting/working/ready_to_bill/billed/paid) — renders a status chip; billed/paid rows
   * are greyed under a "Finished jobs" divider (caller sorts them last via sortJobPickerRowsFinishedLast). */
  status?: string | null
  /** Schedule blocks this hub week — renders "N this wk" on active rows. */
  blocksThisWeek?: number
  /** Evidence for the money rail (line items + payments). undefined = host doesn't enrich;
   * null = enrichment pending/unavailable for this row (renders the legacy compact row). */
  evidence?: JobSearchEvidence | null
  /** When set, show a muted hint (e.g. Quickfill: clocked on this job today). */
  sessionToday?: boolean
}

export function ScheduleDispatchAssignJobPickerModal({
  open,
  onClose,
  title = 'Add job to schedule',
  subtitle,
  jobRows,
  searchValue,
  onSearchChange,
  numberQuery,
  onNumberQueryChange,
  onPickJob,
  onOpenJobDetail,
  onCreateNewJob,
  searchPlaceholder = 'Search HCP or job name',
  duplicateAddressNotice,
  evidenceMode = 'lines-only',
  notComingIn,
  noCallNoShow,
}: {
  open: boolean
  onClose: () => void
  /** Heading (v2.2142): callers outside Schedule name the job they're picking for. */
  title?: ReactNode
  subtitle: ReactNode
  jobRows: ScheduleDispatchAssignJobPickerRow[]
  searchValue: string
  onSearchChange: (v: string) => void
  /** Digits-only "#" mode (C# / HCP numbers): when both props are wired, a # chip
   * renders beside the search box; non-empty digits switch the caller's filter
   * to number-only matching (the two modes are exclusive). */
  numberQuery?: string
  onNumberQueryChange?: (v: string) => void
  onPickJob: (jobId: string) => void
  /** When set, each row gets a "Job detail" briefcase button (opens above this modal). */
  onOpenJobDetail?: (jobId: string) => void
  onCreateNewJob?: () => void
  searchPlaceholder?: string
  /** Same-address ambiguity warning shown under the search box (e.g. "2 jobs at 109 Tuscarora Trail…"). */
  duplicateAddressNotice?: string | null
  /** Money rail mode: 'money' shows revenue + payment recency, 'lines-only' hides all dollars. */
  evidenceMode?: JobSearchEvidenceMode
  /**
   * When provided, the footer offers a "Not coming in today" action with an inline confirm step.
   * Only meaningful when the picker is being opened for a single person on a single day
   * (cell-add intent); leave undefined for toolbar / multi-cell intents.
   */
  notComingIn?: {
    personLabel: string
    workDateLabel: string
    existingBlockCount: number
    busy?: boolean
    onConfirm: () => void | Promise<void>
  }
  /**
   * When provided (alongside notComingIn), the footer also offers a quieter
   * "No call, no show" action (v2.2540). Its confirm step is sterner — it files
   * an attendance incident, rejects clock time, clears blocks, and marks the day
   * off — and takes an optional what-happened details string. Only pass it for
   * viewers who can actually record NCNS (payroll-side roles); the RPC enforces
   * regardless.
   */
  noCallNoShow?: {
    busy?: boolean
    onConfirm: (details: string) => void | Promise<void>
  }
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  /** Phones: pin to the top and size to the visual viewport so the picker fills
   * the space above the software keyboard and resizes as it opens/closes. */
  const isMobile = useIsMobile()
  const visualViewportHeight = useVisualViewportHeight()
  const [notComingInConfirming, setNotComingInConfirming] = useState(false)
  const [ncnsConfirming, setNcnsConfirming] = useState(false)
  const [ncnsDetails, setNcnsDetails] = useState('')
  /** Keyboard-highlighted result (-1 = none); ↓/↑ move it, Enter picks it, typing resets it. */
  const [activeIndex, setActiveIndex] = useState(-1)
  /** "#" number mode (live-filter variant of the Stages jump chip). */
  const numberInputRef = useRef<HTMLInputElement>(null)
  const [numberOpen, setNumberOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const hasNumberMode = numberQuery !== undefined && onNumberQueryChange !== undefined
  const numberActive = hasNumberMode && (numberQuery ?? '').trim() !== ''
  const highlightQuery = numberActive ? (numberQuery ?? '') : searchValue

  useEffect(() => {
    if (numberOpen) numberInputRef.current?.focus()
  }, [numberOpen])

  useEffect(() => {
    if (!open) setNumberOpen(false)
  }, [open])

  const closeNumberMode = () => {
    setNumberOpen(false)
    onNumberQueryChange?.('')
  }

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      setNcnsConfirming(false)
      setNcnsDetails('')
    }
    if (!open) setNotComingInConfirming(false)
  }, [open])

  useEffect(() => {
    setActiveIndex(-1)
  }, [searchValue, open])

  const moveActive = (delta: 1 | -1) => {
    const n = jobRows.length
    if (n === 0) return
    // Functional update so held-down key repeats never read a stale index.
    setActiveIndex((prev) => {
      const cur = prev >= 0 && prev < n ? prev : -1
      const next = cur < 0 ? (delta > 0 ? 0 : n - 1) : (cur + delta + n) % n
      queueMicrotask(() =>
        document
          .getElementById(`assign-job-picker-option-${next}`)
          ?.scrollIntoView({ block: 'nearest' }),
      )
      return next
    })
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        zIndex: 1003,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="hub-assign-job-picker-title"
        style={{
          background: 'var(--surface)',
          borderRadius: isMobile ? '0 0 12px 12px' : 8,
          padding: isMobile ? 'calc(0.85rem + env(safe-area-inset-top)) 0.85rem 0.85rem' : '1.25rem',
          maxWidth: 480,
          width: isMobile ? '100%' : '92%',
          height: isMobile ? (visualViewportHeight ?? '100dvh') : undefined,
          maxHeight: isMobile ? undefined : '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '0.75rem',
          }}
        >
          <h2 id="hub-assign-job-picker-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            {title}
          </h2>
          {onCreateNewJob ? (
            <button
              type="button"
              onClick={onCreateNewJob}
              style={{
                boxSizing: 'border-box',
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.75rem',
                border: '1px solid #2563eb',
                borderRadius: 4,
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Create new job
            </button>
          ) : null}
        </div>
        {subtitle ? (
          <div style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>{subtitle}</div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <input
          ref={searchRef}
          type="search"
          value={searchValue}
          onChange={(e) => {
            if (numberActive || numberOpen) closeNumberMode()
            onSearchChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (jobRows.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              moveActive(1)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              moveActive(-1)
              return
            }
            if (e.key === 'Enter') {
              const row =
                activeIndex >= 0 && activeIndex < jobRows.length
                  ? jobRows[activeIndex]
                  : jobRows.length === 1
                    ? jobRows[0]
                    : undefined
              if (row) {
                e.preventDefault()
                onPickJob(row.id)
              }
            }
          }}
          placeholder={searchPlaceholder}
          aria-label="Search jobs"
          role="combobox"
          aria-expanded={jobRows.length > 0}
          aria-controls="assign-job-picker-results"
          aria-activedescendant={
            activeIndex >= 0 && activeIndex < jobRows.length
              ? `assign-job-picker-option-${activeIndex}`
              : undefined
          }
          aria-autocomplete="list"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0.45rem 0.85rem',
            fontSize: '0.875rem',
            border: searchFocused ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
            boxShadow: searchFocused ? '0 0 0 1px #3b82f6' : undefined,
            outline: 'none',
            borderRadius: 999,
            background: 'var(--surface)',
            color: 'var(--text-base)',
            boxSizing: 'border-box',
          }}
        />
        {hasNumberMode ? (
          !numberOpen ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('')
                setNumberOpen(true)
              }}
              title="Search by C# or HCP number only"
              aria-label="Search by job number"
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
                fontWeight: 700,
                fontSize: '0.9375rem',
                cursor: 'pointer',
              }}
            >
              #
            </button>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                flexShrink: 0,
                border: '2px solid #3b82f6',
                borderRadius: 999,
                padding: '0.2rem 0.6rem',
                background: 'var(--surface)',
              }}
            >
              <span aria-hidden style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>
                #
              </span>
              <input
                ref={numberInputRef}
                type="text"
                inputMode="numeric"
                value={numberQuery ?? ''}
                onChange={(e) => onNumberQueryChange?.(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && jobRows.length === 1 && jobRows[0]) {
                    e.preventDefault()
                    onPickJob(jobRows[0].id)
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    closeNumberMode()
                  }
                }}
                onBlur={() => {
                  if ((numberQuery ?? '').trim() === '') setNumberOpen(false)
                }}
                placeholder="C# / HCP"
                aria-label="Job number (C# or HCP) — filters the list to number matches"
                title="Digits only — the list shows number matches; Esc closes"
                style={{
                  width: '4.6rem',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--text-base)',
                  fontSize: '0.875rem',
                  fontVariantNumeric: 'tabular-nums',
                  padding: '0.15rem 0',
                }}
              />
            </span>
          )
        ) : null}
        </div>
        {duplicateAddressNotice ? (
          <div
            role="note"
            style={{
              margin: '0.4rem 0 0',
              padding: '0.35rem 0.6rem',
              borderRadius: 6,
              background: 'var(--bg-amber-tint)',
              color: 'var(--text-amber-800)',
              fontSize: '0.75rem',
            }}
          >
            ⚠ {duplicateAddressNotice}
          </div>
        ) : null}
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 6, marginTop: duplicateAddressNotice ? '0.4rem' : undefined }}>
          {jobRows.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No jobs match.</div>
          ) : (
            <ul id="assign-job-picker-results" role="listbox" aria-label="Matching jobs" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {jobRows.map((r, idx) => {
                const rowFinished = isFinishedJobPickerStatus(r.status)
                const firstFinished =
                  rowFinished && idx > 0 && !isFinishedJobPickerStatus(jobRows[idx - 1]?.status)
                return (
                <Fragment key={r.id}>
                {firstFinished ? (
                  <li
                    aria-hidden="true"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0.75rem 0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    Finished jobs
                  </li>
                ) : null}
                <li
                  id={`assign-job-picker-option-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'stretch',
                    background: r.sessionToday ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    opacity: rowFinished ? 0.6 : undefined,
                  }}
                >
                  {onOpenJobDetail ? (
                    <button
                      type="button"
                      onClick={() => onOpenJobDetail(r.id)}
                      tabIndex={-1}
                      title="Job detail"
                      aria-label={`Open job detail for ${r.displayTitle}`}
                      style={{
                        flexShrink: 0,
                        padding: '0 0.45rem 0 0.6rem',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-700)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                      </svg>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onPickJob(r.id)}
                    tabIndex={-1}
                    aria-label={
                      r.sessionToday ? `${r.displayTitle}, clocked today` : r.displayTitle
                    }
                    style={{
                      width: '100%',
                      minWidth: 0,
                      flex: 1,
                      textAlign: 'left',
                      padding: onOpenJobDetail ? '0.55rem 0.75rem 0.55rem 0.25rem' : '0.55rem 0.75rem',
                      border: 'none',
                      background: 'none',
                      boxShadow: idx === activeIndex ? 'inset 0 0 0 2px #2563eb' : undefined,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {(() => {
                          const pill = buildServiceTypeTradePill(r.serviceTypeName)
                          return pill ? (
                            <span aria-label={`Service type ${pill.label}`} style={{ ...pill.style, marginTop: 0, flexShrink: 0 }}>
                              {pill.label}
                            </span>
                          ) : null
                        })()}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <HighlightedText text={r.displayTitle} query={highlightQuery} />
                        </span>
                        {(() => {
                          const chip = jobPickerStatusChip(r.status)
                          return chip ? (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '0.06rem 0.5rem',
                                borderRadius: 999,
                                background: chip.background,
                                color: chip.color,
                              }}
                            >
                              {chip.label}
                            </span>
                          ) : null
                        })()}
                      </span>
                      {r.subline ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <HighlightedText text={r.subline} query={highlightQuery} />
                        </span>
                      ) : null}
                      {r.evidence && r.evidence.lineCount > 0 ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-600)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={r.evidence.lineSummary}
                        >
                          {r.evidence.lineSummary}
                        </span>
                      ) : null}
                    </span>
                    {r.evidence ? (
                      <span
                        style={{
                          flexShrink: 0,
                          alignSelf: 'center',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '0.25rem 0.55rem',
                          textAlign: 'right',
                          display: 'inline-flex',
                          flexDirection: 'column',
                          gap: 1,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1.25,
                        }}
                      >
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                          {evidenceMode === 'money' ? railDollars(r.evidence.lineRevenue) : `${r.evidence.lineCount} ${r.evidence.lineCount === 1 ? 'line' : 'lines'}`}
                        </span>
                        {evidenceMode === 'money' ? (
                          r.evidence.lastPaidDaysAgo !== null ? (
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-green-800)' }}>
                              paid {formatDaysAgoShort(r.evidence.lastPaidDaysAgo)}
                            </span>
                          ) : r.evidence.lineRevenue > 0 ? (
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>unpaid</span>
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>no lines</span>
                          )
                        ) : null}
                        {typeof r.blocksThisWeek === 'number' && r.blocksThisWeek > 0 ? (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{r.blocksThisWeek} this wk</span>
                        ) : null}
                      </span>
                    ) : typeof r.blocksThisWeek === 'number' && r.blocksThisWeek > 0 && !rowFinished ? (
                      <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.blocksThisWeek} this wk
                      </span>
                    ) : null}
                    {r.sessionToday ? (
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-blue-800)',
                          background: 'var(--bg-blue-200)',
                          padding: '0.12rem 0.4rem',
                          borderRadius: 4,
                        }}
                      >
                        Clocked today
                      </span>
                    ) : null}
                  </button>
                </li>
                </Fragment>
                )
              })}
            </ul>
          )}
        </div>
        {notComingIn && noCallNoShow && ncnsConfirming ? (
          <div
            role="alertdialog"
            aria-label="Confirm record no-call-no-show"
            style={{
              border: '1px solid var(--border-red)',
              background: 'var(--bg-red-tint)',
              borderRadius: 6,
              padding: '0.6rem 0.75rem',
              marginTop: '0.75rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-red-900)', lineHeight: 1.4 }}>
              Record a <strong>no-call-no-show</strong> for <strong>{notComingIn.personLabel}</strong>
              {notComingIn.workDateLabel ? (
                <>
                  {' '}on <strong>{notComingIn.workDateLabel}</strong>
                </>
              ) : null}
              ? This files an <strong>attendance incident</strong> (visible in write-ups and review),
              rejects any clock time for the day
              {notComingIn.existingBlockCount > 0 ? (
                <>
                  , removes their{' '}
                  <strong>
                    {notComingIn.existingBlockCount} schedule block
                    {notComingIn.existingBlockCount === 1 ? '' : 's'}
                  </strong>
                </>
              ) : null}
              , and marks the day off.
            </p>
            <textarea
              value={ncnsDetails}
              onChange={(e) => setNcnsDetails(e.target.value)}
              placeholder="What happened? (optional — saved on the incident)"
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: '0.5rem',
                padding: '0.4rem 0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                fontSize: '0.8125rem',
                font: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={noCallNoShow.busy}
                onClick={() => setNcnsConfirming(false)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: noCallNoShow.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={noCallNoShow.busy}
                onClick={() => {
                  if (noCallNoShow.busy) return
                  void noCallNoShow.onConfirm(ncnsDetails.trim())
                }}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: noCallNoShow.busy ? '#fca5a5' : '#b91c1c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: noCallNoShow.busy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {noCallNoShow.busy ? 'Saving…' : 'Record NCNS'}
              </button>
            </div>
          </div>
        ) : notComingIn && notComingInConfirming ? (
          <div
            role="alertdialog"
            aria-label="Confirm mark not coming in today"
            style={{
              border: '1px solid #fecaca',
              background: 'var(--bg-red-tint)',
              borderRadius: 6,
              padding: '0.6rem 0.75rem',
              marginTop: '0.75rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-red-900)', lineHeight: 1.4 }}>
              Mark <strong>{notComingIn.personLabel}</strong> as not coming in
              {notComingIn.workDateLabel ? (
                <>
                  {' '}on <strong>{notComingIn.workDateLabel}</strong>
                </>
              ) : null}
              ?
              {notComingIn.existingBlockCount > 0 ? (
                <>
                  {' '}
                  This will also remove their{' '}
                  <strong>
                    {notComingIn.existingBlockCount} existing schedule block
                    {notComingIn.existingBlockCount === 1 ? '' : 's'}
                  </strong>{' '}
                  for the day.
                </>
              ) : null}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={notComingIn.busy}
                onClick={() => setNotComingInConfirming(false)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: notComingIn.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={notComingIn.busy}
                onClick={() => {
                  if (notComingIn.busy) return
                  void notComingIn.onConfirm()
                }}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: notComingIn.busy ? '#fca5a5' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: notComingIn.busy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {notComingIn.busy ? 'Saving…' : 'Confirm not coming in'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              {notComingIn ? (
                <button
                  type="button"
                  disabled={notComingIn.busy}
                  onClick={() => setNotComingInConfirming(true)}
                  style={{
                    padding: '0.45rem 0.6rem',
                    fontSize: '0.8125rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-red-700)',
                    cursor: notComingIn.busy ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    fontWeight: 500,
                  }}
                >
                  Not coming in today
                </button>
              ) : null}
              {notComingIn && noCallNoShow ? (
                <button
                  type="button"
                  disabled={noCallNoShow.busy}
                  onClick={() => setNcnsConfirming(true)}
                  title="Record a no-call-no-show — files an attendance incident"
                  style={{
                    padding: '0.45rem 0.6rem',
                    fontSize: '0.8125rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-red-700)',
                    cursor: noCallNoShow.busy ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    fontWeight: 500,
                    opacity: 0.85,
                  }}
                >
                  No call, no show
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
