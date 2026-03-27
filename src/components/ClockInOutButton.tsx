import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDailyGoalsGate } from '../contexts/DailyGoalsGateContext'
import { useToastContext } from '../contexts/ToastContext'
import {
  formatUnifiedResult,
  getBidServiceTypeTag,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { getTeamFeedbackEligibility } from '../lib/teamFeedback'
import TeamFeedbackWizard from './team-feedback/TeamFeedbackWizard'

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

type OpenSession = {
  id: string
  clocked_in_at: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
}

type TodaySession = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
}

function computeTotalSecondsToday(sessions: TodaySession[]): number {
  const now = Date.now()
  return sessions.reduce((sum, s) => {
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : now
    return sum + Math.floor((outMs - inMs) / 1000)
  }, 0)
}

type Props = {
  userId: string
  userName: string | null
}

export default function ClockInOutButton({ userId, userName }: Props) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const { notifyFirstClockInOfDay } = useDailyGoalsGate()
  const [openSession, setOpenSession] = useState<OpenSession | null>(null)
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [totalSecondsToday, setTotalSecondsToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clockInModalOpen, setClockInModalOpen] = useState(false)
  const [clockInNotes, setClockInNotes] = useState('')
  const [clockInError, setClockInError] = useState<string | null>(null)
  const clockInNotesRef = useRef<HTMLTextAreaElement>(null)
  const [updateFocusModalOpen, setUpdateFocusModalOpen] = useState(false)
  const [updateFocusNotes, setUpdateFocusNotes] = useState('')
  const [updateFocusError, setUpdateFocusError] = useState<string | null>(null)
  const [updateFocusLoading, setUpdateFocusLoading] = useState(false)
  const updateFocusNotesRef = useRef<HTMLTextAreaElement>(null)
  const [unifiedSearchText, setUnifiedSearchText] = useState('')
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([])
  const [selectedAssociation, setSelectedAssociation] = useState<UnifiedSearchResult | null>(null)
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string }>>([])
  const [selectedBidServiceTypeId, setSelectedBidServiceTypeId] = useState<string>('')
  const [subcontractorServiceTypeIds, setSubcontractorServiceTypeIds] = useState<string[] | null>(null)
  const [lastSelectedJobBid, setLastSelectedJobBid] = useState<UnifiedSearchResult | null>(null)
  const assignedJobsShownRef = useRef(false)
  const [teamFeedbackOpen, setTeamFeedbackOpen] = useState(false)

  function parseLastJobBidFromStorage(raw: string | null): UnifiedSearchResult | null {
    if (!raw?.trim()) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return null
      const o = parsed as Record<string, unknown>
      const source = o.source
      const id = o.id
      if (source === 'job' && typeof id === 'string') {
        if (typeof o.hcp_number === 'string' && typeof o.job_name === 'string' && typeof o.job_address === 'string') {
          return { source: 'job', id, hcp_number: o.hcp_number, job_name: o.job_name, job_address: o.job_address }
        }
      }
      if (source === 'bid' && typeof id === 'string') {
        if (
          typeof o.bid_number === 'string' &&
          typeof o.project_name === 'string' &&
          typeof o.address === 'string' &&
          typeof o.customer_name === 'string'
        ) {
          return {
            source: 'bid',
            id,
            bid_number: o.bid_number,
            project_name: o.project_name,
            address: o.address,
            customer_name: o.customer_name,
            service_type_name: typeof o.service_type_name === 'string' ? o.service_type_name : null,
          }
        }
      }
    } catch {
      // ignore parse errors
    }
    return null
  }

  useEffect(() => {
    if (!userId || typeof localStorage === 'undefined') return
    const stored = localStorage.getItem(`clock_in_last_job_bid_${userId}`)
    setLastSelectedJobBid(parseLastJobBidFromStorage(stored))
  }, [userId])

  const fetchSessions = useCallback(async () => {
    if (!userId) return
    const today = toLocalDateString(new Date())
    const { data, error: err } = await supabase
      .from('clock_sessions')
      .select('id, clocked_in_at, clocked_out_at, notes, job_ledger_id, bid_id')
      .eq('user_id', userId)
      .eq('work_date', today)
    if (err) {
      setError(err.message)
      setOpenSession(null)
      setTodaySessions([])
      return
    }
    setError(null)
    const sessions = (data ?? []) as TodaySession[]
    setTodaySessions(sessions)
    const open = sessions.find((s) => !s.clocked_out_at)
    setOpenSession(open ? { id: open.id, clocked_in_at: open.clocked_in_at, notes: open.notes, job_ledger_id: open.job_ledger_id, bid_id: open.bid_id } : null)
    if (sessions.length > 0) {
      setTotalSecondsToday(computeTotalSecondsToday(sessions))
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchSessions().finally(() => setLoading(false))
  }, [userId, fetchSessions])

  useEffect(() => {
    if (!openSession || todaySessions.length === 0) return
    const interval = setInterval(() => {
      setTotalSecondsToday(computeTotalSecondsToday(todaySessions))
    }, 1000)
    return () => clearInterval(interval)
  }, [openSession, todaySessions])

  useEffect(() => {
    if (clockInModalOpen) {
      setClockInNotes('')
      setClockInError(null)
      setUnifiedSearchText('')
      setUnifiedSearchResults([])
      setSelectedAssociation(null)
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (clockInModalOpen) {
      const id = setTimeout(() => clockInNotesRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (clockInModalOpen) {
      const scrollY = window.scrollY
      const prevOverflow = document.body.style.overflow
      const prevPosition = document.body.style.position
      const prevTop = document.body.style.top
      const prevLeft = document.body.style.left
      const prevRight = document.body.style.right

      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'

      return () => {
        document.body.style.overflow = prevOverflow
        document.body.style.position = prevPosition
        document.body.style.top = prevTop
        document.body.style.left = prevLeft
        document.body.style.right = prevRight
        window.scrollTo(0, scrollY)
      }
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (updateFocusModalOpen) {
      setUpdateFocusError(null)
      setUnifiedSearchText('')
      setUnifiedSearchResults([])
      setSelectedAssociation(null)
    }
  }, [updateFocusModalOpen])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!(clockInModalOpen || updateFocusModalOpen)) return
      if (!unifiedSearchText.trim()) {
        if (assignedJobsShownRef.current) {
          assignedJobsShownRef.current = false
          return
        }
        setUnifiedSearchResults([])
        return
      }
      const q = unifiedSearchText.trim()
      const bidsParams: { p_search_text: string; p_service_type_id?: string; p_service_type_ids?: string[] } = { p_search_text: q }
      if (subcontractorServiceTypeIds && subcontractorServiceTypeIds.length > 0) {
        bidsParams.p_service_type_ids = subcontractorServiceTypeIds
      } else if (selectedBidServiceTypeId) {
        bidsParams.p_service_type_id = selectedBidServiceTypeId
      }
      Promise.all([
        supabase.rpc('search_jobs_ledger', { search_text: q }),
        supabase.rpc('search_bids_for_clock', bidsParams),
      ]).then(([jobsRes, bidsRes]) => {
        const jobs = (jobsRes.data ?? []) as JobSearchResult[]
        const bids = (bidsRes.data ?? []) as BidSearchResult[]
        const merged: UnifiedSearchResult[] = [
          ...jobs.map((j) => ({ source: 'job' as const, ...j })),
          ...bids.map((b) => ({ source: 'bid' as const, ...b })),
        ]
        setUnifiedSearchResults(merged)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [clockInModalOpen, updateFocusModalOpen, unifiedSearchText, selectedBidServiceTypeId, subcontractorServiceTypeIds])

  useEffect(() => {
    if (!(clockInModalOpen || updateFocusModalOpen)) return
    const load = async () => {
      const { data: stData } = await supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true })
      const types = (stData ?? []) as Array<{ id: string; name: string }>
      if (authUser?.id) {
        const { data: meData } = await supabase.from('users').select('role, estimator_service_type_ids, primary_service_type_ids, subcontractor_service_type_ids').eq('id', authUser.id).single()
        const me = meData as { role?: string; estimator_service_type_ids?: string[] | null; primary_service_type_ids?: string[] | null; subcontractor_service_type_ids?: string[] | null } | null
        const estIds = me?.estimator_service_type_ids
        const primIds = me?.primary_service_type_ids
        const subIds = me?.subcontractor_service_type_ids ?? null
        if (me?.role === 'subcontractor') setSubcontractorServiceTypeIds(subIds && subIds.length > 0 ? subIds : null)
        else setSubcontractorServiceTypeIds(null)
        const filtered = (me?.role === 'estimator' && estIds && estIds.length > 0)
          ? types.filter((t) => estIds.includes(t.id))
          : (me?.role === 'primary' && primIds && primIds.length > 0)
            ? types.filter((t) => primIds.includes(t.id))
            : (me?.role === 'subcontractor' && subIds && subIds.length > 0)
              ? types.filter((t) => subIds.includes(t.id))
              : types
        if (filtered.length === 1) {
          setSelectedBidServiceTypeId(filtered[0]!.id)
        } else {
          setSelectedBidServiceTypeId((prev) => (prev === '' || (prev && filtered.some((t) => t.id === prev)) ? prev : ''))
        }
        setServiceTypes(filtered)
      } else {
        setSelectedBidServiceTypeId('')
        setServiceTypes(types)
        setSubcontractorServiceTypeIds(null)
      }
    }
    void load()
  }, [clockInModalOpen, updateFocusModalOpen, authUser?.id])

  useEffect(() => {
    if (updateFocusModalOpen) {
      const id = setTimeout(() => updateFocusNotesRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [updateFocusModalOpen])

  useEffect(() => {
    if (updateFocusModalOpen) {
      const scrollY = window.scrollY
      const prevOverflow = document.body.style.overflow
      const prevPosition = document.body.style.position
      const prevTop = document.body.style.top
      const prevLeft = document.body.style.left
      const prevRight = document.body.style.right

      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'

      return () => {
        document.body.style.overflow = prevOverflow
        document.body.style.position = prevPosition
        document.body.style.top = prevTop
        document.body.style.left = prevLeft
        document.body.style.right = prevRight
        window.scrollTo(0, scrollY)
      }
    }
  }, [updateFocusModalOpen])

  function handleOpenClockInModal() {
    if (!userId || !userName?.trim() || openSession) return
    setClockInModalOpen(true)
  }

  async function handleCompleteClockIn() {
    if (!userId || !userName?.trim() || !clockInNotes.trim()) {
      if (!clockInNotes.trim()) {
        showToast('Please describe what you intend to accomplish today', 'error')
      }
      return
    }
    setActionLoading(true)
    setClockInError(null)
    try {
      const now = new Date()
      let clockInLat: number | null = null
      let clockInLng: number | null = null
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
            })
          })
          clockInLat = pos.coords.latitude
          clockInLng = pos.coords.longitude
        } catch {
          // Proceed without location (permission denied, timeout, or unavailable)
        }
      }
      const { error: err } = await supabase.from('clock_sessions').insert({
        user_id: userId,
        clocked_in_at: now.toISOString(),
        work_date: toLocalDateString(now),
        notes: clockInNotes.trim(),
        job_ledger_id: selectedAssociation?.source === 'job' ? selectedAssociation?.id : null,
        bid_id: selectedAssociation?.source === 'bid' ? selectedAssociation?.id : null,
        ...(clockInLat != null &&
          clockInLng != null && { clock_in_lat: clockInLat, clock_in_lng: clockInLng }),
      })
      if (err) throw err
      if (selectedAssociation && userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`clock_in_last_job_bid_${userId}`, JSON.stringify(selectedAssociation))
        setLastSelectedJobBid(selectedAssociation)
      }
      setClockInModalOpen(false)
      const workDate = toLocalDateString(now)
      await fetchSessions()
      await notifyFirstClockInOfDay(workDate, userId)
    } catch (e) {
      setClockInError(e instanceof Error ? e.message : 'Failed to clock in')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChooseFromMyJobs() {
    setUnifiedSearchText('')
    setUnifiedSearchResults([])
    const { data, error } = await supabase.rpc('list_assigned_jobs_for_dashboard')
    if (error) {
      showToast('Could not load your jobs', 'error')
      return
    }
    const jobs = (data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
    const mapped: UnifiedSearchResult[] = jobs.map((j) => ({
      source: 'job' as const,
      id: j.id,
      hcp_number: j.hcp_number ?? '',
      job_name: j.job_name ?? '',
      job_address: j.job_address ?? '',
    }))
    setUnifiedSearchResults(mapped)
    if (mapped.length > 0) assignedJobsShownRef.current = true
    if (mapped.length === 0) {
      showToast('You have no assigned jobs', 'info')
    }
  }

  async function handleClockOut() {
    if (!openSession) return
    setActionLoading(true)
    setError(null)
    try {
      let clockOutLat: number | null = null
      let clockOutLng: number | null = null
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
            })
          })
          clockOutLat = pos.coords.latitude
          clockOutLng = pos.coords.longitude
        } catch {
          // Proceed without location (permission denied, timeout, or unavailable)
        }
      }
      const { error: err } = await supabase
        .from('clock_sessions')
        .update({
          clocked_out_at: new Date().toISOString(),
          ...(clockOutLat != null &&
            clockOutLng != null && { clock_out_lat: clockOutLat, clock_out_lng: clockOutLng }),
        })
        .eq('id', openSession.id)
      if (err) throw err
      setOpenSession(null)
      await fetchSessions()
      const elig = await getTeamFeedbackEligibility(userId)
      if (elig.eligible) setTeamFeedbackOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clock out')
    } finally {
      setActionLoading(false)
    }
  }

  function handleOpenUpdateFocusModal() {
    if (!openSession) return
    setUpdateFocusNotes('')
    setUpdateFocusError(null)
    setUpdateFocusModalOpen(true)
  }

  async function handleUpdateFocus() {
    if (!openSession || !userId || !userName?.trim() || !updateFocusNotes.trim()) return
    setUpdateFocusLoading(true)
    setUpdateFocusError(null)
    try {
      const now = new Date()
      let clockOutLat: number | null = null
      let clockOutLng: number | null = null
      let clockInLat: number | null = null
      let clockInLng: number | null = null
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
            })
          })
          clockOutLat = pos.coords.latitude
          clockOutLng = pos.coords.longitude
          clockInLat = pos.coords.latitude
          clockInLng = pos.coords.longitude
        } catch {
          // Proceed without location
        }
      }
      const { error: errOut } = await supabase
        .from('clock_sessions')
        .update({
          clocked_out_at: now.toISOString(),
          ...(clockOutLat != null &&
            clockOutLng != null && { clock_out_lat: clockOutLat, clock_out_lng: clockOutLng }),
        })
        .eq('id', openSession.id)
      if (errOut) throw errOut
      const { error: errIn } = await supabase.from('clock_sessions').insert({
        user_id: userId,
        clocked_in_at: now.toISOString(),
        work_date: toLocalDateString(now),
        notes: updateFocusNotes.trim(),
        job_ledger_id: selectedAssociation?.source === 'job' ? selectedAssociation?.id : null,
        bid_id: selectedAssociation?.source === 'bid' ? selectedAssociation?.id : null,
        ...(clockInLat != null &&
          clockInLng != null && { clock_in_lat: clockInLat, clock_in_lng: clockInLng }),
      })
      if (errIn) throw errIn
      if (selectedAssociation && userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`clock_in_last_job_bid_${userId}`, JSON.stringify(selectedAssociation))
        setLastSelectedJobBid(selectedAssociation)
      }
      setUpdateFocusModalOpen(false)
      const workDate = toLocalDateString(now)
      await fetchSessions()
      await notifyFirstClockInOfDay(workDate, userId)
    } catch (e) {
      setUpdateFocusError(e instanceof Error ? e.message : 'Failed to switch focus')
    } finally {
      setUpdateFocusLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
        Loading…
      </div>
    )
  }

  const canClockIn = userName?.trim() && !openSession
  const hasOpenSession = !!openSession

  return (
    <>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
      {hasOpenSession ? (
        <>
          <button
            type="button"
            onClick={handleClockOut}
            disabled={actionLoading || updateFocusLoading}
            title="Clock out"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #dc2626',
              borderRadius: 8,
              background: '#dc2626',
              color: 'white',
              cursor: (actionLoading || updateFocusLoading) ? 'not-allowed' : 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatElapsed(totalSecondsToday)} — Clock Out
          </button>
          <button
            type="button"
            onClick={handleOpenUpdateFocusModal}
            disabled={actionLoading || updateFocusLoading}
            title="Switch to a new focus (clocks out and starts new session)"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #3b82f6',
              borderRadius: 8,
              background: '#3b82f6',
              color: 'white',
              cursor: (actionLoading || updateFocusLoading) ? 'not-allowed' : 'pointer',
            }}
          >
            Update Focus
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleOpenClockInModal}
          disabled={!canClockIn || actionLoading}
          title={!userName?.trim() ? 'Set your name in Settings to clock in' : 'Clock in'}
          style={{
            width: '100%',
            padding: '0 1.5rem',
            minHeight: 48,
            height: 48,
            boxSizing: 'border-box',
            fontSize: '1.125rem',
            fontWeight: 600,
            border: '2px solid #ff6600',
            borderRadius: 8,
            background: canClockIn ? '#ff6600' : '#f3f4f6',
            color: canClockIn ? 'white' : '#9ca3af',
            cursor: canClockIn && !actionLoading ? 'pointer' : 'not-allowed',
          }}
        >
          Clock In
        </button>
      )}
      {error && (
        <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</span>
      )}
      {clockInModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clock-in-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !actionLoading && setClockInModalOpen(false)}
        >
          <div
            id="clock-in-modal"
            style={{ background: '#fefcfb', padding: '1.5rem', borderRadius: 12, maxWidth: 480, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', borderTop: '4px solid #ff6600' }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`#clock-in-modal textarea:focus,#clock-in-modal input:focus,#clock-in-modal button:focus-visible{outline:2px solid #ff6600;outline-offset:2px}`}</style>
            <h3 id="clock-in-modal-title" style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center' }}>Ready to clock in?</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>What do you plan to accomplish?</span>
              <textarea
                ref={clockInNotesRef}
                value={clockInNotes}
                onChange={(e) => setClockInNotes(e.target.value)}
                placeholder="e.g. Rough-in at 123 Main St, or finishing trim in Unit 4"
                rows={3}
                disabled={actionLoading}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
              />
            </label>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500 }}>Link to a job or bid (optional)</span>
                {lastSelectedJobBid && (
                  <button
                    type="button"
                    onClick={() => setSelectedAssociation(lastSelectedJobBid)}
                    disabled={actionLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #fed7aa', borderRadius: 6, background: '#fff7ed', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Use last: {formatUnifiedResult(lastSelectedJobBid)}
                  </button>
                )}
              </div>
              {selectedAssociation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {selectedAssociation.source === 'bid' && (() => {
                      const t = getBidServiceTypeTag(selectedAssociation.service_type_name)
                      return t ? (
                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {formatUnifiedResult(selectedAssociation)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedAssociation(null); setUnifiedSearchResults([]) }}
                    disabled={actionLoading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              <input
                type="text"
                value={unifiedSearchText}
                onChange={(e) => { setUnifiedSearchText(e.target.value); setSelectedAssociation(null); assignedJobsShownRef.current = false }}
                placeholder="Search by HCP #, bid #, project name, or address"
                disabled={actionLoading}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
              />
              {serviceTypes.length === 1 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                    Filtering by: {serviceTypes[0]!.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleChooseFromMyJobs()}
                    disabled={actionLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #2563eb', borderRadius: 6, background: '#eff6ff', color: '#2563eb', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Choose from my jobs?
                  </button>
                </div>
              ) : serviceTypes.length > 1 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={selectedBidServiceTypeId}
                    onChange={(e) => { setSelectedBidServiceTypeId(e.target.value); setUnifiedSearchResults([]) }}
                    disabled={actionLoading}
                    style={{ flex: 1, minWidth: 0, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                  >
                    <option value="">Show all types ({serviceTypes.map((st) => st.name).join(', ')})</option>
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleChooseFromMyJobs()}
                    disabled={actionLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #2563eb', borderRadius: 6, background: '#eff6ff', color: '#2563eb', cursor: actionLoading ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                  >
                    Choose from my jobs?
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => void handleChooseFromMyJobs()}
                    disabled={actionLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #2563eb', borderRadius: 6, background: '#eff6ff', color: '#2563eb', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Choose from my jobs?
                  </button>
                </div>
              )}
              {unifiedSearchResults.length > 0 && (
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginTop: '0.25rem' }}>
                  {unifiedSearchResults.map((r) => (
                    <button
                      key={`${r.source}-${r.id}`}
                      type="button"
                      onClick={() => { setSelectedAssociation(r); setUnifiedSearchResults([]); setUnifiedSearchText('') }}
                      style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedAssociation && selectedAssociation.source === r.source && selectedAssociation.id === r.id ? '#eff6ff' : 'white', cursor: 'pointer', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}
                    >
                      {r.source === 'bid' && (() => {
                        const t = getBidServiceTypeTag(r.service_type_name)
                        return t ? (
                          <span style={{ marginRight: '0.35rem', padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                            [{t.tag}]
                          </span>
                        ) : null
                      })()}
                      {formatUnifiedResult(r)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clockInError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>
                {clockInError.toLowerCase().includes('network') || clockInError.toLowerCase().includes('fetch')
                  ? "Something went wrong. Please check your connection and try again."
                  : clockInError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => !actionLoading && setClockInModalOpen(false)}
                disabled={actionLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteClockIn}
                disabled={actionLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #ff6600', borderRadius: 6, background: '#ff6600', color: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
              >
                {actionLoading ? 'Clocking in…' : 'Complete Clock In'}
              </button>
            </div>
          </div>
        </div>
      )}
      {updateFocusModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-focus-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !updateFocusLoading && setUpdateFocusModalOpen(false)}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="update-focus-modal-title" style={{ marginTop: 0, marginBottom: '0.5rem', textAlign: 'center' }}>Update Focus</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              This will clock out your current session and start a new one with the focus below.
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>What are you working on?</span>
              <textarea
                ref={updateFocusNotesRef}
                value={updateFocusNotes}
                onChange={(e) => setUpdateFocusNotes(e.target.value)}
                placeholder="e.g. Trim set at 456 Oak Ave"
                rows={3}
                disabled={updateFocusLoading}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </label>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500 }}>Job or Bid (optional)</span>
                {lastSelectedJobBid && (
                  <button
                    type="button"
                    onClick={() => setSelectedAssociation(lastSelectedJobBid)}
                    disabled={updateFocusLoading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: updateFocusLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Use last: {formatUnifiedResult(lastSelectedJobBid)}
                  </button>
                )}
              </div>
              {selectedAssociation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {selectedAssociation.source === 'bid' && (() => {
                      const t = getBidServiceTypeTag(selectedAssociation.service_type_name)
                      return t ? (
                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {formatUnifiedResult(selectedAssociation)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedAssociation(null)}
                    disabled={updateFocusLoading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: updateFocusLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              <input
                type="text"
                value={unifiedSearchText}
                onChange={(e) => { setUnifiedSearchText(e.target.value); setSelectedAssociation(null); assignedJobsShownRef.current = false }}
                placeholder="Search by HCP #, bid #, project name, or address"
                disabled={updateFocusLoading}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
              {serviceTypes.length === 1 ? (
                <p style={{ marginBottom: '0.5rem', marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Filtering by: {serviceTypes[0]!.name}
                </p>
              ) : serviceTypes.length > 1 ? (
                <select
                  value={selectedBidServiceTypeId}
                  onChange={(e) => { setSelectedBidServiceTypeId(e.target.value); setUnifiedSearchResults([]) }}
                  disabled={updateFocusLoading}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value="">Show all types ({serviceTypes.map((st) => st.name).join(', ')})</option>
                  {serviceTypes.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              ) : null}
              {unifiedSearchResults.length > 0 && (
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginTop: '0.25rem' }}>
                  {unifiedSearchResults.map((r) => (
                    <button
                      key={`${r.source}-${r.id}`}
                      type="button"
                      onClick={() => { setSelectedAssociation(r); setUnifiedSearchResults([]); setUnifiedSearchText('') }}
                      style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedAssociation && selectedAssociation.source === r.source && selectedAssociation.id === r.id ? '#eff6ff' : 'white', cursor: 'pointer', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}
                    >
                      {r.source === 'bid' && (() => {
                        const t = getBidServiceTypeTag(r.service_type_name)
                        return t ? (
                          <span style={{ marginRight: '0.35rem', padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                            [{t.tag}]
                          </span>
                        ) : null
                      })()}
                      {formatUnifiedResult(r)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {updateFocusError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>{updateFocusError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => !updateFocusLoading && setUpdateFocusModalOpen(false)}
                disabled={updateFocusLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: updateFocusLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateFocus}
                disabled={!updateFocusNotes.trim() || updateFocusLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: updateFocusNotes.trim() && !updateFocusLoading ? 'pointer' : 'not-allowed' }}
              >
                {updateFocusLoading ? 'Switching…' : 'Switch Focus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <TeamFeedbackWizard
      open={teamFeedbackOpen}
      onClose={() => setTeamFeedbackOpen(false)}
      userId={userId}
      source="clock_out_prompt"
    />
    </>
  )
}
