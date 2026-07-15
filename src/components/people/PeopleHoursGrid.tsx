import { type Dispatch, type RefObject, type SetStateAction, useState } from 'react'
import type { UserRow } from '../../hooks/usePeopleRoster'
import { HOURS_GRID_FIRST_COL_LABEL } from '../../constants/hoursGridFirstCol'
import { decimalToHms, hmsToDecimal } from '../../lib/people/hoursGridTime'
import { shouldOfferManualHoursSession } from '../../lib/people/shouldOfferManualHoursSession'
import {
  type PeopleHoursPendingByCellMap,
  type PeopleHoursPendingCellEntry,
  pendingByCellKey,
  personPendingExcessHours,
  workDateHasAnyPendingExcess,
} from '../../lib/peopleHoursPendingByCell'

type PendingCellPopover = { anchorEl: HTMLElement; entry: PeopleHoursPendingCellEntry } | null

export interface PeopleHoursGridProps {
  hoursTableScrollRef: RefObject<HTMLDivElement>
  hoursGridFirstColW: number
  hoursDays: string[]
  showPeopleForHours: string[]
  peopleHoursPendingByCellMap: PeopleHoursPendingByCellMap
  jobHighlightPeople: Set<string>
  jobHighlightCells: Set<string>
  hoursFlashWorkDate: string | null
  hoursFlashPersonName: string | null
  hoursDaysCorrect: Set<string>
  users: UserRow[]
  canEditCrewJobs: boolean
  canAccessHours: boolean
  canAccessPay: boolean
  hasUnassignedCorrectDays: (personName: string) => boolean
  canEditHours: (personName: string) => boolean
  isCorrectDayMissingJob: (personName: string, workDate: string) => boolean
  getHoursGridDisplayHours: (personName: string, workDate: string) => number
  moveHoursRow: (personName: string, direction: 'up' | 'down') => void
  setHoursUnassignedModal: (value: { personName: string }) => void
  setHoursDayAuditModal: (value: { personName: string; workDate: string }) => void
  openHoursMyTimeForGridCell: (personName: string, workDate: string) => void
  setPendingCellPopover: Dispatch<SetStateAction<PendingCellPopover>>
  toggleHoursDayCorrect: (workDate: string) => void
  saveHours: (personName: string, workDate: string, hours: number) => void | Promise<void>
  openManualHoursDraftFromBlur: (personName: string, workDate: string, hoursDecimal: number) => void
}

/** Hours grid table: per-person daily-hours matrix with inline cell editing, pending badges, job
 * highlighting, flash, and the totals/Correct footer. Owns the local cell-edit state; reads shared
 * hours/cost data and helpers via props. */
export function PeopleHoursGrid({
  hoursTableScrollRef,
  hoursGridFirstColW,
  hoursDays,
  showPeopleForHours,
  peopleHoursPendingByCellMap,
  jobHighlightPeople,
  jobHighlightCells,
  hoursFlashWorkDate,
  hoursFlashPersonName,
  hoursDaysCorrect,
  users,
  canEditCrewJobs,
  canAccessHours,
  canAccessPay,
  hasUnassignedCorrectDays,
  canEditHours,
  isCorrectDayMissingJob,
  getHoursGridDisplayHours,
  moveHoursRow,
  setHoursUnassignedModal,
  setHoursDayAuditModal,
  openHoursMyTimeForGridCell,
  setPendingCellPopover,
  toggleHoursDayCorrect,
  saveHours,
  openManualHoursDraftFromBlur,
}: PeopleHoursGridProps) {
  const [editingHoursCell, setEditingHoursCell] = useState<{ personName: string; workDate: string } | null>(null)
  const [editingHoursValue, setEditingHoursValue] = useState('')

  return (
    <div ref={hoursTableScrollRef} style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: hoursGridFirstColW }} />
        {/* 88 = the 72px cell input + 0.5rem td padding per side; narrower and the input
            overflows the fixed-layout cell, so highlight rings render offset to the left. */}
        {hoursDays.map((d) => (
          <col key={d} style={{ width: 88 }} />
        ))}
        <col style={{ width: 90 }} />
        <col style={{ width: 90 }} />
      </colgroup>
      <thead style={{ background: 'var(--bg-subtle)' }}>
        <tr>
          <th
            style={{
              padding: '0.5rem 0.75rem',
              textAlign: 'left',
              borderBottom: '1px solid var(--border)',
              position: 'sticky',
              left: 0,
              zIndex: 3,
              background: 'var(--bg-subtle)',
              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
              maxWidth: hoursGridFirstColW,
              minWidth: 0,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            Person
          </th>
          {hoursDays.map((d) => {
            const dayHasPending = workDateHasAnyPendingExcess(peopleHoursPendingByCellMap, d)
            return (
              <th
                key={d}
                id={`people-hours-col-${d}`}
                style={{
                  padding: '0.5rem 0.5rem',
                  textAlign: 'right',
                  borderBottom: '1px solid var(--border)',
                  ...(hoursFlashWorkDate === d
                    ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                    : {}),
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    justifyContent: 'flex-end',
                  }}
                >
                  {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                  {dayHasPending ? (
                    <span
                      aria-label="Some people have pending hours on this day not yet in payroll"
                      title="Some people have pending hours on this day not yet in payroll"
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#f59e0b',
                        boxShadow: '0 0 0 1px rgba(146,64,14,0.35)',
                      }}
                    />
                  ) : null}
                </span>
              </th>
            )
          })}
          <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>HH:MM:SS</th>
          <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Decimal</th>
        </tr>
      </thead>
      <tbody>
        {showPeopleForHours.map((personName, idx) => {
          const isUnassigned = hasUnassignedCorrectDays(personName)
          const isClickable = isUnassigned && canEditCrewJobs
          return (
            <tr
              key={personName}
              data-hours-person={personName}
              style={{
                borderBottom: '1px solid var(--border)',
                ...(isClickable && { cursor: 'pointer' }),
                ...(jobHighlightPeople.has(personName)
                  ? { backgroundColor: 'rgba(219, 234, 254, 0.45)' }
                  : {}),
                ...(hoursFlashPersonName === personName
                  ? {
                      backgroundColor: 'rgba(254, 243, 199, 0.25)',
                      boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.45)',
                    }
                  : {}),
              }}
              onClick={isClickable ? () => setHoursUnassignedModal({ personName }) : undefined}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setHoursUnassignedModal({ personName })
                }
              } : undefined}
            >
              <td
                style={{
                  padding: '0.5rem 0.75rem',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  // Opaque theme tokens: the cell is sticky, so translucent washes let scrolled
                  // columns bleed through, and literal white hid names entirely in dark mode.
                  background:
                    hoursFlashPersonName === personName
                      ? 'var(--bg-amber-100)'
                      : jobHighlightPeople.has(personName)
                        ? 'var(--bg-blue-200)'
                        : 'var(--surface)',
                  boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                  maxWidth: hoursGridFirstColW,
                  minWidth: 0,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                  <span style={{ display: 'flex', flexDirection: 'row', gap: 0, marginRight: '0.25rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveHoursRow(personName, 'up') }}
                      disabled={idx === 0}
                      title="Move up"
                      style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', lineHeight: 1 }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveHoursRow(personName, 'down') }}
                      disabled={idx === showPeopleForHours.length - 1}
                      title="Move down"
                      style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForHours.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForHours.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', lineHeight: 1 }}
                    >
                      ▼
                    </button>
                  </span>
                  <span style={{ minWidth: 0 }}>{personName}</span>
                </div>
              </td>
              {hoursDays.map((d) => {
                const dayLocked = hoursDaysCorrect.has(d)
                const canEdit = canEditHours(personName)
                const missingJob = isCorrectDayMissingJob(personName, d)
                const missingJobTitle = 'Correct day with hours but no job assignment — assign in Crew Jobs / Bids'
                const gridDisplayHrs = getHoursGridDisplayHours(personName, d)
                const hoursRowUser = users.find((x) => (x.name ?? '').trim() === personName.trim())
                const showMyTimeCorner = gridDisplayHrs > 0 && !!hoursRowUser?.id
                const pendingEntry = peopleHoursPendingByCellMap.get(pendingByCellKey(personName, d))
                const showPendingBadge = !!pendingEntry && (canAccessHours || canAccessPay)
                return (
                  <td
                    key={d}
                    title={missingJob ? missingJobTitle : undefined}
                    style={{
                      padding: '0.35rem 0.5rem',
                      textAlign: canEdit ? 'right' : 'center',
                      ...(showMyTimeCorner || showPendingBadge ? { position: 'relative' } : {}),
                      ...(missingJob && {
                        background: 'rgba(254, 242, 242, 0.9)',
                        boxShadow: 'inset 0 0 0 1px rgba(252, 165, 165, 0.45)',
                        borderRadius: 8,
                      }),
                      ...(jobHighlightCells.has(`${personName}:${d}`) && !missingJob
                        ? {
                            backgroundColor: 'rgba(219, 234, 254, 0.35)',
                            boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.25)',
                          }
                        : {}),
                      ...(showPendingBadge && !missingJob
                        ? {
                            backgroundColor: 'rgba(254, 243, 199, 0.55)',
                            boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.55)',
                            borderRadius: 8,
                          }
                        : {}),
                      ...(hoursFlashWorkDate === d
                        ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                        : {}),
                    }}
                  >
                    {!canEdit ? (
                      <span style={{ color: 'var(--text-muted)' }}>{decimalToHms(gridDisplayHrs) || '-'}</span>
                    ) : dayLocked ? (
                      canEdit ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setHoursDayAuditModal({ personName, workDate: d })
                          }}
                          title="Day marked Correct — click to view clock sessions and job assignments"
                          style={{
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'right',
                            padding: '0.15rem 0',
                            border: 'none',
                            background: 'none',
                            font: 'inherit',
                          }}
                        >
                          {decimalToHms(gridDisplayHrs) || '-'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }} title="Day marked Correct — locked">
                          {decimalToHms(gridDisplayHrs) || '-'}
                        </span>
                      )
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingHoursCell?.personName === personName && editingHoursCell?.workDate === d ? editingHoursValue : decimalToHms(gridDisplayHrs)}
                        placeholder="-"
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          setEditingHoursCell({ personName, workDate: d })
                          setEditingHoursValue(decimalToHms(gridDisplayHrs) || '')
                          e.target.select()
                        }}
                        onChange={(e) => setEditingHoursValue(e.target.value)}
                        onBlur={() => {
                          const v = hmsToDecimal(editingHoursValue)
                          const shouldOfferManualSession = shouldOfferManualHoursSession({
                            hoursDecimal: v,
                            canAccessHours,
                            canAccessPay,
                            canEditHours: canEditHours(personName),
                            dayIsMarkedCorrect: hoursDaysCorrect.has(d),
                          })
                          if (shouldOfferManualSession) {
                            openManualHoursDraftFromBlur(personName, d, v)
                          } else {
                            void saveHours(personName, d, v)
                          }
                          setEditingHoursCell(null)
                        }}
                        style={{ width: 72, padding: '0.25rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                      />
                    )}
                    {showMyTimeCorner ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          width: 24,
                          height: 24,
                          zIndex: 6,
                          pointerEvents: 'none',
                        }}
                      >
                        <button
                          type="button"
                          aria-label={`Open My Time for ${personName} on ${d}`}
                          title="Open My Time for this person and day"
                          onClick={(e) => {
                            e.stopPropagation()
                            openHoursMyTimeForGridCell(personName, d)
                          }}
                          style={{
                            pointerEvents: 'auto',
                            width: '100%',
                            height: '100%',
                            padding: 0,
                            margin: 0,
                            border: 'none',
                            cursor: 'pointer',
                            clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
                            background: '#0f766e',
                            color: '#fff',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'flex-start',
                            paddingLeft: 3,
                            paddingBottom: 2,
                            fontFamily: 'inherit',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                          }}
                        >
                          {'\u2022'}
                        </button>
                      </div>
                    ) : null}
                    {showPendingBadge && pendingEntry ? (
                      <button
                        type="button"
                        aria-label={`${pendingEntry.count} pending session${pendingEntry.count === 1 ? '' : 's'} for ${personName} on ${d} — adds ${pendingEntry.diffHours.toFixed(2)} hours to payroll. Click to review and approve.`}
                        title={`+${pendingEntry.diffHours.toFixed(2)} h pending — click to approve`}
                        onClick={(e) => {
                          e.stopPropagation()
                          const target = e.currentTarget
                          setPendingCellPopover((prev) => {
                            if (
                              prev &&
                              prev.entry.personName === pendingEntry.personName &&
                              prev.entry.workDate === pendingEntry.workDate
                            ) {
                              return null
                            }
                            return { anchorEl: target, entry: pendingEntry }
                          })
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          zIndex: 7,
                          height: 16,
                          padding: '0 5px',
                          border: '1px solid rgba(217,119,6,0.55)',
                          background: '#fbbf24',
                          // Theme-invariant dark-on-amber: the pill background never changes with
                          // the theme, so --text-amber-900 went light-on-amber in dark mode.
                          color: 'var(--text-on-amber-solid)',
                          borderRadius: 9999,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        }}
                      >
                        <span aria-hidden>!</span>
                        {pendingEntry.count}
                      </button>
                    ) : null}
                  </td>
                )
              })}
              {(() => {
                const personPendingHours = personPendingExcessHours(peopleHoursPendingByCellMap, personName)
                return (
                  <>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                      {decimalToHms(hoursDays.reduce((s, d) => s + getHoursGridDisplayHours(personName, d), 0)) || '-'}
                      {personPendingHours > 0 ? (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-amber-800)',
                            lineHeight: 1.1,
                            marginTop: 1,
                          }}
                          title={`${personPendingHours.toFixed(2)} h on this row are pending and not yet in payroll`}
                        >
                          +{personPendingHours.toFixed(2)} pending
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                      {(hoursDays.reduce((s, d) => s + getHoursGridDisplayHours(personName, d), 0)).toFixed(2)}
                    </td>
                  </>
                )
              })()}
            </tr>
          )
        })}
      </tbody>
      <tfoot style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
        {(() => {
          const grandTotal = showPeopleForHours.reduce((s, p) => s + hoursDays.reduce((ds, d) => ds + getHoursGridDisplayHours(p, d), 0), 0)
          return (
            <>
              <tr>
                <td
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderTop: '1px solid var(--border)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--bg-subtle)',
                    boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {HOURS_GRID_FIRST_COL_LABEL}
                </td>
                {hoursDays.map((d) => {
                  const daySum = showPeopleForHours.reduce((s, p) => s + getHoursGridDisplayHours(p, d), 0)
                  return (
                    <td
                      key={d}
                      style={{
                        padding: '0.5rem 0.5rem',
                        textAlign: 'center',
                        borderTop: '1px solid var(--border)',
                        ...(hoursFlashWorkDate === d
                          ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                          : {}),
                      }}
                    >
                      {decimalToHms(daySum) || '-'}
                    </td>
                  )
                })}
                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                  {decimalToHms(grandTotal) || '-'}
                </td>
                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>-</td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderTop: '1px solid var(--border)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--bg-subtle)',
                    boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  Total (Decimal):
                </td>
                {hoursDays.map((d) => {
                  const daySum = showPeopleForHours.reduce((s, p) => s + getHoursGridDisplayHours(p, d), 0)
                  return (
                    <td
                      key={d}
                      style={{
                        padding: '0.5rem 0.5rem',
                        textAlign: 'center',
                        borderTop: '1px solid var(--border)',
                        ...(hoursFlashWorkDate === d
                          ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                          : {}),
                      }}
                    >
                      {daySum.toFixed(2)}
                    </td>
                  )
                })}
                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>-</td>
                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                  {grandTotal.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderTop: '1px solid var(--border)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--bg-subtle)',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                  }}
                  title="Mark day as verified to lock from edits"
                >
                  Correct:
                </td>
                {hoursDays.map((d) => {
                  const checked = hoursDaysCorrect.has(d)
                  return (
                    <td
                      key={d}
                      style={{
                        padding: '0.35rem 0.5rem',
                        textAlign: 'center',
                        borderTop: '1px solid var(--border)',
                        ...(hoursFlashWorkDate === d
                          ? { backgroundColor: 'rgba(254, 243, 199, 0.9)', boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.65)' }
                          : {}),
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title={checked ? 'Uncheck to allow edits' : 'Check to lock this day'}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHoursDayCorrect(d)}
                        />
                      </label>
                    </td>
                  )
                })}
                <td colSpan={2} style={{ padding: '0.5rem 0.5rem', borderTop: '1px solid var(--border)' }} />
              </tr>
            </>
          )
        })()}
      </tfoot>
    </table>
    </div>
  )
}
