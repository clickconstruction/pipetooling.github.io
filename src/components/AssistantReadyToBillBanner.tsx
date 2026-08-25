import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  READY_TO_BILL_BANNER_LINK,
  canRoleSeeReadyToBillBanner,
  readyToBillBannerLabel,
} from '../lib/readyToBillBanner'

const REFRESH_MS = 5 * 60 * 1000

/**
 * The assistants' ready-to-bill bar (v2.2276, mockup-approved): one slim
 * orange line under the header on EVERY page while jobs sit in Ready to
 * Bill. The whole bar is the tap target; it lands on Jobs with the Ready to
 * Bill section opened and scrolled (`?rtb=1`). Disappears at zero — the bar
 * existing IS the signal. Count refreshes on route change, window focus,
 * and a 5-minute tick; RLS scopes it to jobs the assistant can see.
 */
export default function AssistantReadyToBillBanner() {
  const { user: authUser, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [count, setCount] = useState<number | null>(null)
  const eligible = Boolean(authUser?.id) && canRoleSeeReadyToBillBanner(role)

  // withSupabaseRetry returns data (null for head-count queries) and drops the
  // count, so this query runs directly with a quiet failure path instead.
  const load = useCallback(async () => {
    if (!eligible) {
      setCount(null)
      return
    }
    const { count: n, error } = await supabase
      .from('jobs_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ready_to_bill')
    if (!error) setCount(n ?? 0)
  }, [eligible])

  useEffect(() => {
    void load()
  }, [load, location.pathname])

  useEffect(() => {
    if (!eligible) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(t)
    }
  }, [eligible, load])

  const label = readyToBillBannerLabel(count)
  if (!eligible || !label) return null

  return (
    <button
      type="button"
      onClick={() => navigate(READY_TO_BILL_BANNER_LINK)}
      title="Open Jobs at the Ready to Bill section"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '0.5rem 0.75rem',
        border: 'none',
        borderBottom: '1px solid #d97706',
        background: 'var(--bg-amber-tint)',
        color: 'var(--text-amber-800)',
        font: 'inherit',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden
        style={{
          background: '#f59e0b',
          color: '#201a05',
          borderRadius: 9999,
          minWidth: '1.35rem',
          height: '1.35rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.78rem',
          fontWeight: 800,
          padding: '0 0.35rem',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {count}
      </span>
      {label.replace(/^\d+ /, '')}
      <span aria-hidden style={{ marginLeft: 'auto', fontWeight: 700, opacity: 0.9 }}>
        ›
      </span>
    </button>
  )
}
