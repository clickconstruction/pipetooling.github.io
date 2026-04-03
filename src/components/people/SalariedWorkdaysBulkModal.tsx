import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import { buildSalariedWorkdayPickerRows, type SalariedWorkdayPickerRow } from '../../lib/buildSalariedWorkdayPickerRows'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useToastContext } from '../../contexts/ToastContext'
import { payStaffBulkInsertUserTimeOff, type PayStaffBulkTimeOffResult } from '../../lib/payStaffBulkTimeOff'
import { SalaryWorkScheduleSettings } from '../SalaryWorkScheduleSettings'

export type SalariedWorkdaysBulkUser = { id: string; name: string }

export type SalariedWorkdaysBulkModalProps = {
  open: boolean
  onClose: () => void
  payConfig: Record<string, PayConfigRow>
  users: SalariedWorkdaysBulkUser[]
}

export function SalariedWorkdaysBulkModal({ open, onClose, payConfig, users }: SalariedWorkdaysBulkModalProps) {
  const narrowViewport = useNarrowViewport640()
  const { showToast } = useToastContext()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [bulkEndDate, setBulkEndDate] = useState('')
  const [bulkNote, setBulkNote] = useState('')
  const [bulkCheckedIds, setBulkCheckedIds] = useState<string[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [lastBulkResult, setLastBulkResult] = useState<PayStaffBulkTimeOffResult | null>(null)

  const rows = useMemo(() => buildSalariedWorkdayPickerRows(payConfig, users), [payConfig, users])

  const userNameById = useCallback(
    (id: string) => users.find((u) => u.id === id)?.name?.trim() || id.slice(0, 8),
    [users],
  )

  useEffect(() => {
    if (!open) return
    const firstId = rows.find((r) => r.userId != null)?.userId ?? null
    setSelectedUserId(firstId)
    setLastBulkResult(null)
  }, [open, rows])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const rowsWithLogin = useMemo(
    () => rows.filter((r): r is SalariedWorkdayPickerRow & { userId: string } => r.userId != null),
    [rows],
  )

  function toggleBulkChecked(userId: string, checked: boolean) {
    setBulkCheckedIds((prev) => {
      if (checked) return prev.includes(userId) ? prev : [...prev, userId]
      return prev.filter((id) => id !== userId)
    })
  }

  function selectAllBulk() {
    setBulkCheckedIds(rowsWithLogin.map((r) => r.userId))
  }

  function clearBulkSelection() {
    setBulkCheckedIds([])
  }

  async function submitBulkTimeOff() {
    if (!bulkStartDate || !bulkEndDate) {
      showToast('Start and end dates are required.', 'warning')
      return
    }
    if (bulkEndDate < bulkStartDate) {
      showToast('End date must be on or after start date.', 'warning')
      return
    }
    if (bulkCheckedIds.length === 0) {
      showToast('Select at least one person with a login user.', 'warning')
      return
    }
    if (
      !window.confirm(
        `Add unpaid time off ${bulkStartDate} → ${bulkEndDate} for ${bulkCheckedIds.length} people?`,
      )
    ) {
      return
    }
    setBulkSubmitting(true)
    setLastBulkResult(null)
    try {
      const res = await payStaffBulkInsertUserTimeOff({
        userIds: bulkCheckedIds,
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        note: bulkNote.trim() ? bulkNote.trim() : null,
      })
      if (res.error) {
        showToast(res.error, 'error')
        setLastBulkResult(res)
        return
      }
      const n = res.inserted.length
      const problems = res.failed.length + res.sync_failed.length
      if (problems > 0) {
        showToast(`Added time off for ${n} people; ${problems} issue(s) — see below.`, 'warning')
      } else {
        showToast(`Unpaid time off added for ${n} people.`, 'success')
      }
      setLastBulkResult(res.failed.length > 0 || res.sync_failed.length > 0 ? res : null)
    } finally {
      setBulkSubmitting(false)
    }
  }

  if (!open) return null

  const selectedRow = rows.find((r) => r.userId === selectedUserId)
  const selectedPayName = selectedRow?.personName ?? ''

  const listColumn = (
    <div
      style={{
        flex: narrowViewport ? '0 0 auto' : '0 0 220px',
        maxHeight: narrowViewport ? 'min(40vh, 280px)' : 'none',
        overflow: 'auto',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        background: '#fafafa',
      }}
    >
      {rows.length === 0 ? (
        <p style={{ margin: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
          No salaried people in pay config yet. Use the <strong>Pay</strong> tab to mark someone as Salary.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0.35rem 0' }}>
          {rows.map((r) => {
            const uid = r.userId
            const selectable = uid != null
            const active = selectable && uid === selectedUserId
            const bulkChecked = uid != null && bulkCheckedIds.includes(uid)
            return (
              <li key={r.personName}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', paddingLeft: '0.35rem' }}>
                  {uid != null ? (
                    <input
                      type="checkbox"
                      checked={bulkChecked}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleBulkChecked(uid, e.target.checked)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Include ${r.personName} in bulk time off`}
                      style={{ marginTop: '0.45rem', flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 14, flexShrink: 0 }} aria-hidden />
                  )}
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => uid != null && setSelectedUserId(uid)}
                    title={
                      selectable
                        ? undefined
                        : 'No matching login user — pay name must match the user display name in Users.'
                    }
                    style={{
                      display: 'block',
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      padding: '0.45rem 0.65rem',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: active ? '#eff6ff' : 'transparent',
                      color: selectable ? (active ? '#1d4ed8' : '#111827') : '#9ca3af',
                      cursor: selectable ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {r.personName}
                    {!selectable ? (
                      <span
                        style={{ display: 'block', fontSize: '0.72rem', fontWeight: 400, color: '#9ca3af', marginTop: 2 }}
                      >
                        No matching user
                      </span>
                    ) : null}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const detailColumn = (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 200,
        overflow: 'auto',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: '0.75rem 1rem',
        background: 'white',
      }}
    >
      {rows.length === 0 ? null : selectedUserId && selectedPayName ? (
        <SalaryWorkScheduleSettings
          key={selectedUserId}
          userId={selectedUserId}
          userPayName={selectedPayName}
          canEditPastDayOverrides
        />
      ) : (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          Select someone with a matching login user to edit their salaried workday.
        </p>
      )}
    </div>
  )

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="salaried-workdays-bulk-modal-title"
        aria-describedby="salaried-workdays-bulk-modal-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width: 'min(1100px, 100%)',
          maxHeight: 'min(90vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.5rem',
            flexShrink: 0,
          }}
        >
          <h2 id="salaried-workdays-bulk-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Salaried workdays
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p id="salaried-workdays-bulk-modal-desc" style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          Edit default schedule and day overrides for each salaried person. Saving matches Settings (including salary session sync).
        </p>
        <details
          style={{
            flexShrink: 0,
            marginBottom: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '0.5rem 0.75rem',
            background: '#fafafa',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
            Bulk unpaid time off (multiple people)
          </summary>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.5rem 0 0.75rem' }}>
            Company-wide calendar dates (Central). Check names in the list, set the range, then apply. Uses the same rules as Settings time off; salary sync runs for today when today falls in the range.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <label>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>Start</span>
              <input
                type="date"
                value={bulkStartDate}
                onChange={(e) => setBulkStartDate(e.target.value)}
                style={{ padding: '0.35rem' }}
              />
            </label>
            <label>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>End</span>
              <input
                type="date"
                value={bulkEndDate}
                onChange={(e) => setBulkEndDate(e.target.value)}
                style={{ padding: '0.35rem' }}
              />
            </label>
            <button
              type="button"
              onClick={selectAllBulk}
              disabled={rowsWithLogin.length === 0}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
            >
              Select all with login
            </button>
            <button
              type="button"
              onClick={clearBulkSelection}
              disabled={bulkCheckedIds.length === 0}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
            >
              Clear selection
            </button>
          </div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>Note (optional)</span>
            <input
              type="text"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              style={{ width: '100%', maxWidth: 420, padding: '0.35rem' }}
            />
          </label>
          <button
            type="button"
            onClick={() => void submitBulkTimeOff()}
            disabled={bulkSubmitting || bulkCheckedIds.length === 0}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: 600,
              background: '#ea580c',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: bulkSubmitting || bulkCheckedIds.length === 0 ? 'not-allowed' : 'pointer',
              opacity: bulkSubmitting || bulkCheckedIds.length === 0 ? 0.7 : 1,
            }}
          >
            {bulkSubmitting ? 'Applying…' : `Apply to ${bulkCheckedIds.length} selected`}
          </button>
          {lastBulkResult && (lastBulkResult.failed.length > 0 || lastBulkResult.sync_failed.length > 0) ? (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              {lastBulkResult.failed.length > 0 ? (
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#b91c1c' }}>Not saved</strong>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', color: '#374151' }}>
                    {lastBulkResult.failed.map((f) => (
                      <li key={`f-${f.user_id}-${f.message}`}>
                        {userNameById(f.user_id)}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lastBulkResult.sync_failed.length > 0 ? (
                <div>
                  <strong style={{ color: '#b45309' }}>Saved; salary sync warning</strong>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', color: '#374151' }}>
                    {lastBulkResult.sync_failed.map((f) => (
                      <li key={`s-${f.user_id}-${f.message}`}>
                        {userNameById(f.user_id)}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </details>
        <div
          style={{
            display: 'flex',
            flexDirection: narrowViewport ? 'column' : 'row',
            gap: '0.75rem',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {listColumn}
          {detailColumn}
        </div>
      </div>
    </div>
  )
}
