import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { salaryZonedWallClockToUtcMs } from '../lib/salaryZonedWallClock'
import { supabase } from '../lib/supabase'
import { DatabaseError, formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect'

const USER_PICK_LIMIT = 500

function parseHm24(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m: min }
}

function formatUserOptionLabel(name: string, email: string): string {
  const n = name.trim() || 'Unknown'
  const e = email.trim()
  return e ? `${n} (${e})` : n
}

export function ScheduleDayEmailModal({
  open,
  onClose,
  workDateYmd,
  authUserId,
  onScheduled,
}: {
  open: boolean
  onClose: () => void
  workDateYmd: string
  authUserId: string
  onScheduled?: () => void
}) {
  const { showToast } = useToastContext()
  const { role } = useAuth()
  const isDev = role === 'dev'

  const [timeLocal, setTimeLocal] = useState('17:00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipientUserId, setRecipientUserId] = useState(authUserId)
  const [userOptions, setUserOptions] = useState<SearchableSelectOption[]>([])
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null)

  const dateLabel = useMemo(() => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDateYmd.trim())
    if (!d) return workDateYmd
    const dt = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]))
    return dt.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [workDateYmd])

  const recipientLabel = useMemo(() => {
    const row = userOptions.find(
      (o) => 'value' in o && o.value === recipientUserId,
    ) as { value: string; label: string } | undefined
    return row?.label ?? (recipientUserId === authUserId ? 'you' : recipientUserId.slice(-8))
  }, [userOptions, recipientUserId, authUserId])

  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setRecipientUserId(authUserId)
  }, [open, workDateYmd, authUserId])

  useEffect(() => {
    if (!open || !isDev) {
      setUserOptions([])
      setUsersLoadError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          () =>
            supabase
              .from('users')
              .select('id,name,email')
              .is('archived_at', null)
              .order('name', { ascending: true })
              .limit(USER_PICK_LIMIT),
          'schedule email user list',
        )
        if (cancelled) return
        const list = (rows ?? []) as { id: string; name: string; email: string }[]
        setUserOptions(
          list.map((u) => ({
            value: u.id,
            label: formatUserOptionLabel(u.name ?? '', u.email ?? ''),
          })),
        )
        setUsersLoadError(null)
      } catch (e: unknown) {
        if (!cancelled) {
          setUserOptions([])
          setUsersLoadError(formatErrorMessage(e, 'Could not load users'))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, isDev])

  const resetAndClose = useCallback(() => {
    setError(null)
    setBusy(false)
    onClose()
  }, [onClose])

  const insertRequest = useCallback(
    async (recipientId: string, sendAtIso: string) => {
      await withSupabaseRetry(
        () =>
          supabase.from('schedule_day_email_requests').insert({
            recipient_user_id: recipientId,
            work_date: workDateYmd,
            send_at: sendAtIso,
            timezone: APP_CALENDAR_TZ,
            status: 'pending',
          }),
        'schedule day email request',
      )
    },
    [workDateYmd],
  )

  const pendingDuplicateMessage = useCallback(
    (forRecipientId: string) => {
      if (forRecipientId === authUserId) {
        return 'You already have a pending schedule email for that day.'
      }
      const row = userOptions.find(
        (o) => 'value' in o && o.value === forRecipientId,
      ) as { label: string } | undefined
      const who = row?.label ?? 'that person'
      return `A pending schedule email for that day already exists for ${who}.`
    },
    [userOptions, authUserId],
  )

  const handleSchedule = useCallback(async () => {
    const hm = parseHm24(timeLocal)
    if (!hm) {
      setError('Use a valid time like 17:00 (Central).')
      return
    }
    const ms = salaryZonedWallClockToUtcMs(workDateYmd, hm.h, hm.m, 0, APP_CALENDAR_TZ)
    if (ms == null) {
      setError('Could not interpret that time on this date (Central).')
      return
    }
    const sendAt = new Date(ms)
    if (sendAt.getTime() <= Date.now()) {
      setError('Choose a time in the future (Central).')
      return
    }
    const targetId = isDev ? recipientUserId : authUserId
    setBusy(true)
    setError(null)
    try {
      await insertRequest(targetId, sendAt.toISOString())
      showToast(
        targetId === authUserId
          ? 'Schedule email queued'
          : `Schedule email queued for ${recipientLabel}`,
        'success',
      )
      onScheduled?.()
      resetAndClose()
    } catch (e: unknown) {
      if (e instanceof DatabaseError && e.code === '23505') {
        setError(pendingDuplicateMessage(targetId))
      } else {
        setError(formatErrorMessage(e, 'Could not save'))
      }
    } finally {
      setBusy(false)
    }
  }, [
    timeLocal,
    workDateYmd,
    insertRequest,
    onScheduled,
    resetAndClose,
    showToast,
    isDev,
    recipientUserId,
    authUserId,
    recipientLabel,
    pendingDuplicateMessage,
  ])

  const handleSendSoon = useCallback(async () => {
    const targetId = isDev ? recipientUserId : authUserId
    setBusy(true)
    setError(null)
    try {
      await insertRequest(targetId, new Date().toISOString())
      showToast(
        targetId === authUserId
          ? 'Schedule email queued for the next send window'
          : `Schedule email queued for ${recipientLabel} (next send window)`,
        'success',
      )
      onScheduled?.()
      resetAndClose()
    } catch (e: unknown) {
      if (e instanceof DatabaseError && e.code === '23505') {
        setError(pendingDuplicateMessage(targetId))
      } else {
        setError(formatErrorMessage(e, 'Could not save'))
      }
    } finally {
      setBusy(false)
    }
  }, [
    insertRequest,
    onScheduled,
    resetAndClose,
    showToast,
    isDev,
    recipientUserId,
    authUserId,
    recipientLabel,
    pendingDuplicateMessage,
  ])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={busy ? undefined : resetAndClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="schedule-day-email-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: isDev ? 480 : 420,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          padding: '1rem 1.1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="schedule-day-email-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
          Email schedule
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.4 }}>
          {isDev && recipientUserId !== authUserId ? (
            <>
              Send a copy of the dispatch schedule for <strong>{dateLabel}</strong> to the selected user’s
              email at the wall time below. Content matches what they can see on Schedule Dispatch. Times are{' '}
              <strong>{APP_CALENDAR_TZ.replace(/_/g, ' ')}</strong>.
            </>
          ) : (
            <>
              Receive a copy of the dispatch schedule blocks for <strong>{dateLabel}</strong> at the wall time you
              pick. Times are <strong>{APP_CALENDAR_TZ.replace(/_/g, ' ')}</strong>. Delivery uses the same data as
              Schedule Dispatch (as of send time; cron runs about every 15 minutes).
            </>
          )}
        </p>
        {isDev ? (
          <div style={{ marginBottom: '0.65rem' }}>
            <span
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}
              id="schedule-day-email-recipient-label"
            >
              Send to
            </span>
            {usersLoadError ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#b91c1c' }}>{usersLoadError}</p>
            ) : (
              <SearchableSelect
                id="schedule-day-email-recipient"
                value={recipientUserId}
                onChange={setRecipientUserId}
                options={userOptions}
                placeholder="Select user…"
                disabled={busy || userOptions.length === 0}
                listAriaLabel="Recipient users"
                portalZIndex={1400}
              />
            )}
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: '#6b7280' }}>
              Non-archived users only (first {USER_PICK_LIMIT} by name).
            </p>
          </div>
        ) : null}
        <div style={{ marginBottom: '0.65rem' }}>
          <label
            htmlFor="schedule-day-email-time"
            style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}
          >
            Send at (Central, 24h)
          </label>
          <input
            id="schedule-day-email-time"
            type="time"
            step={900}
            value={timeLocal}
            onChange={(e) => setTimeLocal(e.target.value)}
            disabled={busy}
            style={{
              fontSize: '0.95rem',
              padding: '0.35rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          />
        </div>
        {error ? (
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', color: '#b91c1c' }}>{error}</p>
        ) : null}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: '0.5rem',
          }}
        >
          <button
            type="button"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            disabled={busy}
            onClick={resetAndClose}
          >
            Cancel
          </button>
          <button
            type="button"
            title="Queue for the next automated send window (typically within 15 minutes)"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              border: '1px solid #93c5fd',
              borderRadius: 6,
              background: '#eff6ff',
              color: '#1d4ed8',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            disabled={busy || (isDev && userOptions.length === 0)}
            onClick={() => void handleSendSoon()}
          >
            Queue soon
          </button>
          <button
            type="button"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              border: 'none',
              borderRadius: 6,
              background: '#ff6600',
              color: '#fff',
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            disabled={busy || (isDev && userOptions.length === 0)}
            onClick={() => void handleSchedule()}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
