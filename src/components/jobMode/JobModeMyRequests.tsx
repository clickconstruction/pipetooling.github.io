import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { DISPATCH_REQUESTS_CHANGED_EVENT } from '../../lib/dispatchRequestHelpers'
import {
  MY_DISPATCH_REQUESTS_COPY,
  splitMyDispatchRequests,
  type MyDispatchRequestRow,
  type MyDispatchRequestView,
} from '../../lib/myDispatchRequests'

const MY_REQUESTS_SELECT =
  'id, title, status, created_at, closed_at, closed_note, pending_action, closed_by:users!dispatch_requests_closed_by_user_id_fkey(name)'
const MY_REQUESTS_LIMIT = 60

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
}

const subheadStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

function RequestRow({ view }: { view: MyDispatchRequestView }) {
  const answered = view.state === 'answered'
  return (
    <li
      style={{
        listStyle: 'none',
        borderLeft: `3px solid ${answered ? '#16a34a' : '#d97706'}`,
        paddingLeft: '0.6rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '0.9rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{view.title}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{view.headline}</div>
      {answered ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
          {view.answer ? (
            <>
              <span style={{ fontWeight: 600 }}>{MY_DISPATCH_REQUESTS_COPY.answeredPrefix}:</span>{' '}
              <span>&ldquo;{view.answer}&rdquo;</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{MY_DISPATCH_REQUESTS_COPY.noNote}</span>
          )}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Job Mode → Inbox: the tech's own dispatch requests (v2.2880, journey-map
 * Tier-2 #25 / J2-F4). What's still waiting on Dispatch, then what the office
 * answered — with the closing note as "Office answered: …". Reads
 * `dispatch_requests` by `from_user_id` (the requester's own rows are readable
 * under RLS); refreshes on realtime changes and the same-tab change event the
 * red-phone / red-photos senders fire.
 */
export default function JobModeMyRequests({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MyDispatchRequestRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('dispatch_requests')
      .select(MY_REQUESTS_SELECT)
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MY_REQUESTS_LIMIT)
    if (err) {
      setError(err.message)
      setLoaded(true)
      return
    }
    setError(null)
    setRows((data ?? []) as unknown as MyDispatchRequestRow[])
    setLoaded(true)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handler = () => void load()
    window.addEventListener(DISPATCH_REQUESTS_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DISPATCH_REQUESTS_CHANGED_EVENT, handler)
  }, [load])

  const filters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'dispatch_requests', filter: `from_user_id=eq.${userId}` }],
    [userId],
  )
  useRealtimeChannel(true, 'job-mode-my-requests', filters, () => void load(), { debounceMs: 400 })

  const split = useMemo(() => splitMyDispatchRequests(rows), [rows])

  return (
    <section aria-label={MY_DISPATCH_REQUESTS_COPY.heading} style={cardStyle}>
      <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>{MY_DISPATCH_REQUESTS_COPY.heading}</h2>
      {!loaded ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-red-600)' }}>Couldn&rsquo;t load your requests: {error}</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{MY_DISPATCH_REQUESTS_COPY.empty}</div>
      ) : (
        <>
          {split.open.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <h3 style={subheadStyle}>
                {MY_DISPATCH_REQUESTS_COPY.openHeading} · {split.open.length}
              </h3>
              <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {split.open.map((v) => (
                  <RequestRow key={v.id} view={v} />
                ))}
              </ul>
            </div>
          ) : null}
          {split.answered.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <h3 style={subheadStyle}>{MY_DISPATCH_REQUESTS_COPY.answeredHeading}</h3>
              <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {split.answered.map((v) => (
                  <RequestRow key={v.id} view={v} />
                ))}
              </ul>
              {split.answeredHidden > 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  + {split.answeredHidden} older answered
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
