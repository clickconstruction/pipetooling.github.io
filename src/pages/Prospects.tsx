import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import NewCustomerForm, { type NewCustomerFormPayload } from '../components/NewCustomerForm'

type ProspectsTab = 'follow-up' | 'prospect-list' | 'convert'

type Prospect = {
  id: string
  master_user_id: string
  created_by: string
  warmth_count: number
  prospect_fit_status: string | null
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  links_to_website: string | null
  notes: string | null
  last_contact: string | null
  created_at: string | null
  updated_at: string | null
}

type ProspectComment = {
  id: string
  prospect_id: string
  created_by: string
  created_at: string
  comment_text: string
  interaction_type: string
  created_by_user?: { name: string | null; email: string | null } | null
}

const PROSPECTS_TABS: ProspectsTab[] = ['follow-up', 'prospect-list', 'convert']

const DIDNT_ANSWER_MOVE_NEXT_KEY = (userId: string) => `prospects_didnt_answer_move_next_${userId}`

const tabStyle = (active: boolean) => ({
  padding: '0.5rem 0.6rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
  fontSize: '0.9375rem',
})

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
}

function formatDaysSince(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return ' (today)'
  if (diffDays === 1) return ' (1 day ago)'
  return ` (${diffDays} days ago)`
}

function formatDueBadge(lastContact: string | null): string | null {
  const now = Date.now()
  if (!lastContact) return 'Due'
  const diffMs = now - new Date(lastContact).getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays >= 7) return `Due ${diffDays} days`
  return null
}

function formatInteractionType(type: string): string {
  switch (type) {
    case 'answered': return 'Answered'
    case 'didnt_answer': return "Didn't answer"
    case 'no_longer_fit': return 'No longer a fit'
    case 'user_comment': return 'Comment'
    default: return type
  }
}

function formatTimerButtonName(buttonName: string): string {
  switch (buttonName) {
    case 'no_longer_fit': return 'No Longer a Fit'
    case 'next_prospect': return 'Next Prospect'
    case 'cant_reach': return "Can't reach"
    default: return buttonName
  }
}

function formatTimerSeconds(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatWebsiteDisplay(url: string | null): string {
  if (!url || !url.trim()) return '—'
  let s = url.trim()
  s = s.replace(/^https?:\/\//i, '')
  s = s.replace(/^www\./i, '')
  s = s.replace(/\/+$/, '')
  return s || '—'
}

function getWebsiteHref(url: string | null): string {
  if (!url || !url.trim()) return '#'
  const s = url.trim()
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}

export default function Prospects() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser, role: authRole, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<ProspectsTab>('follow-up')

  // Follow Up state
  const [followUpProspects, setFollowUpProspects] = useState<Prospect[]>([])
  const [currentProspectIndex, setCurrentProspectIndex] = useState(0)
  const [comments, setComments] = useState<ProspectComment[]>([])
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  const [callbackModalOpen, setCallbackModalOpen] = useState(false)
  const [commentInputValue, setCommentInputValue] = useState('')
  const [commentInputRef, setCommentInputRef] = useState<HTMLTextAreaElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [scheduledCallback, setScheduledCallback] = useState<{ callback_date: string; note: string | null } | null>(null)
  const [followUpTimerSeconds, setFollowUpTimerSeconds] = useState(0)

  // Edit form state
  const [editCompanyName, setEditCompanyName] = useState('')
  const [editContactName, setEditContactName] = useState('')
  const [editPhoneNumber, setEditPhoneNumber] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editLinksToWebsite, setEditLinksToWebsite] = useState('')

  // Callback form state
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('12:00')
  const [callbackNote, setCallbackNote] = useState('')

  // Prospect List state
  const [prospectListProspects, setProspectListProspects] = useState<Prospect[]>([])
  const [prospectListLoading, setProspectListLoading] = useState(false)
  const [prospectListSectionOpen, setProspectListSectionOpen] = useState<Record<number, boolean>>({})
  const [selectedProspectForList, setSelectedProspectForList] = useState<Prospect | null>(null)
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [followUpNotesSaving, setFollowUpNotesSaving] = useState(false)

  // Per-user preference: move to next prospect when Didn't Answer is clicked
  const [didntAnswerMoveNext, setDidntAnswerMoveNext] = useState(false)

  // Timer history modal
  const [timerHistoryModalOpen, setTimerHistoryModalOpen] = useState(false)
  const [timerEvents, setTimerEvents] = useState<Array<{ id: string; created_at: string | null; timer_seconds: number; button_name: string; prospect: { company_name: string | null } | null }>>([])
  const [timerEventsLoading, setTimerEventsLoading] = useState(false)

  // My time modal
  const [myTimeModalOpen, setMyTimeModalOpen] = useState(false)
  const [myTimeStats, setMyTimeStats] = useState<{ today: number; yesterday: number; last7Days: number; lifetime: number } | null>(null)
  const [myTimeStatsLoading, setMyTimeStatsLoading] = useState(false)
  const [myTimeTodaySeconds, setMyTimeTodaySeconds] = useState(0)

  // Total time spent on current prospect (sum of past timer events for this prospect)
  const [prospectLedgerSeconds, setProspectLedgerSeconds] = useState(0)

  // Total time spent per prospect for Prospect List (prospect_id -> seconds)
  const [prospectLedgerSecondsMap, setProspectLedgerSecondsMap] = useState<Record<string, number>>({})

  // Convert tab state
  const [convertProspectId, setConvertProspectId] = useState<string | null>(null)
  const [convertContactPersons, setConvertContactPersons] = useState<{ name: string; phone: string; email: string; note: string }[]>([{ name: '', phone: '', email: '', note: '' }])
  const [convertBids, setConvertBids] = useState<{ project_name: string; service_type_id: string }[]>([{ project_name: '', service_type_id: '' }])
  const [convertServiceTypes, setConvertServiceTypes] = useState<{ id: string; name: string }[]>([])
  const [convertSaving, setConvertSaving] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertFirstInteractionDate, setConvertFirstInteractionDate] = useState<string>('')

  // New Prospect modal state
  const [newProspectModalOpen, setNewProspectModalOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newLinksToWebsite, setNewLinksToWebsite] = useState('')
  const [newProspectError, setNewProspectError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (tab && PROSPECTS_TABS.includes(tab as ProspectsTab)) {
      setActiveTab(tab as ProspectsTab)
    } else if (!tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'follow-up')
        return next
      }, { replace: true })
    }
  }, [location.search, setSearchParams])

  // Open New Prospect modal when navigating from Dashboard button
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('newProspect') === 'true') {
      setNewProspectModalOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newProspect')
        return next
      }, { replace: true })
    }
  }, [location.search, setSearchParams])

  const setTab = (tab: ProspectsTab) => {
    setActiveTab(tab)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', tab)
      next.delete('prospect_id')
      return next
    })
  }

  async function loadFollowUpProspects() {
    if (!authUser?.id) return
    setFollowUpLoading(true)
    const { data: locks } = await supabase
      .from('prospect_calling_locks')
      .select('prospect_id')
      .neq('user_id', authUser.id)
    const lockedByOthers = (locks ?? []).map((r) => r.prospect_id)
    let query = supabase
      .from('prospects')
      .select('id, master_user_id, created_by, warmth_count, prospect_fit_status, company_name, contact_name, phone_number, email, links_to_website, notes, last_contact, created_at, updated_at')
      .or('prospect_fit_status.is.null,prospect_fit_status.neq.not_a_fit')
    if (lockedByOthers.length > 0) {
      query = query.not('id', 'in', `(${lockedByOthers.join(',')})`)
    }
    const { data, error } = await query
      .order('last_contact', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
    if (error) {
      setFollowUpProspects([])
      setFollowUpLoading(false)
      return
    }
    const raw = (data ?? []) as Prospect[]
    const prospects = raw.filter((p) => p.prospect_fit_status !== 'not_a_fit' && p.prospect_fit_status !== 'cant_reach')
    setFollowUpProspects(prospects)

    const prospectId = searchParams.get('prospect_id')
    if (prospectId && prospects.length > 0) {
      const idx = prospects.findIndex((p) => p.id === prospectId)
      if (idx >= 0) setCurrentProspectIndex(idx)
      else setCurrentProspectIndex(0)
    } else {
      setCurrentProspectIndex(0)
    }
    setFollowUpLoading(false)
  }

  async function loadComments(prospectId: string) {
    const { data, error } = await supabase
      .from('prospect_comments')
      .select('id, prospect_id, created_by, created_at, comment_text, interaction_type, created_by_user:users!prospect_comments_created_by_fkey(name, email)')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
    if (error) {
      setComments([])
      return
    }
    setComments((data ?? []) as ProspectComment[])
  }

  async function loadTimerEvents() {
    if (!authUser?.id) return
    setTimerEventsLoading(true)
    const { data, error } = await (supabase as any)
      .from('prospect_timer_events')
      .select('id, created_at, timer_seconds, button_name, prospect:prospects(company_name)')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      setTimerEvents([])
    } else {
      const raw = (data ?? []) as Array<{ id: string; created_at: string | null; timer_seconds: number; button_name: string; prospect: { company_name: string | null } | { company_name: string | null }[] | null }>
      const rows = raw.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        timer_seconds: r.timer_seconds,
        button_name: r.button_name,
        prospect: Array.isArray(r.prospect) ? r.prospect[0] ?? null : r.prospect,
      }))
      setTimerEvents(rows)
    }
    setTimerEventsLoading(false)
  }

  async function loadMyTimeStats() {
    if (!authUser?.id) return
    setMyTimeStatsLoading(true)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const sum = (rows: { timer_seconds: number }[]) => rows.reduce((a, r) => a + r.timer_seconds, 0)

    const [todayRes, yesterdayRes, last7Res, lifetimeRes] = await Promise.all([
      (supabase as any).from('prospect_timer_events').select('timer_seconds').eq('user_id', authUser.id).gte('created_at', startOfToday.toISOString()).lte('created_at', endOfToday.toISOString()),
      (supabase as any).from('prospect_timer_events').select('timer_seconds').eq('user_id', authUser.id).gte('created_at', startOfYesterday.toISOString()).lt('created_at', startOfToday.toISOString()),
      (supabase as any).from('prospect_timer_events').select('timer_seconds').eq('user_id', authUser.id).gte('created_at', sevenDaysAgo.toISOString()),
      (supabase as any).from('prospect_timer_events').select('timer_seconds').eq('user_id', authUser.id),
    ])

    setMyTimeStats({
      today: sum((todayRes.data ?? []) as { timer_seconds: number }[]),
      yesterday: sum((yesterdayRes.data ?? []) as { timer_seconds: number }[]),
      last7Days: sum((last7Res.data ?? []) as { timer_seconds: number }[]),
      lifetime: sum((lifetimeRes.data ?? []) as { timer_seconds: number }[]),
    })
    setMyTimeStatsLoading(false)
  }

  async function loadMyTimeToday() {
    if (!authUser?.id) return
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const { data } = await (supabase as any)
      .from('prospect_timer_events')
      .select('timer_seconds')
      .eq('user_id', authUser.id)
      .gte('created_at', startOfToday.toISOString())
      .lte('created_at', endOfToday.toISOString())
    const sum = ((data ?? []) as { timer_seconds: number }[]).reduce((a, r) => a + r.timer_seconds, 0)
    setMyTimeTodaySeconds(sum)
  }

  async function loadProspectListProspects() {
    if (!authUser?.id) return
    setProspectListLoading(true)
    const { data, error } = await supabase
      .from('prospects')
      .select('id, master_user_id, created_by, warmth_count, prospect_fit_status, company_name, contact_name, phone_number, email, links_to_website, notes, last_contact, created_at, updated_at')
    if (error) {
      setProspectListProspects([])
      setProspectListLoading(false)
      return
    }
    setProspectListProspects((data ?? []) as Prospect[])
    setProspectListLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'follow-up' && authUser?.id) {
      loadFollowUpProspects()
      loadMyTimeToday()
    }
  }, [activeTab, authUser?.id, searchParams])

  useEffect(() => {
    if ((activeTab === 'prospect-list' || activeTab === 'convert') && authUser?.id) {
      loadProspectListProspects()
    }
  }, [activeTab, authUser?.id])

  // When on Prospect List with prospect_id in URL (e.g. from Quickfill Edit), select that prospect
  useEffect(() => {
    if (activeTab !== 'prospect-list') return
    const prospectId = searchParams.get('prospect_id')
    if (!prospectId || prospectListProspects.length === 0) return
    const p = prospectListProspects.find((x) => x.id === prospectId)
    if (p) {
      setSelectedProspectForList(p)
      if (p.prospect_fit_status === 'cant_reach') {
        setProspectListSectionOpen((prev) => ({ ...prev, [-2]: true }))
      } else if (p.prospect_fit_status === 'not_a_fit') {
        setProspectListSectionOpen((prev) => ({ ...prev, [-1]: true }))
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('prospect_id')
        return next
      }, { replace: true })
    }
  }, [activeTab, searchParams, prospectListProspects])

  const currentProspect = followUpProspects[currentProspectIndex] ?? null

  useEffect(() => {
    setFollowUpNotes(currentProspect?.notes ?? '')
  }, [currentProspect?.id, currentProspect?.notes])

  async function saveFollowUpNotes() {
    if (!currentProspect || followUpNotesSaving) return
    setFollowUpNotesSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ notes: followUpNotes.trim() || null })
      .eq('id', currentProspect.id)
    if (!error) {
      const updated = { ...currentProspect, notes: followUpNotes.trim() || null }
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? updated : p))
      )
      setProspectListProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? updated : p))
      )
    }
    setFollowUpNotesSaving(false)
  }

  function cancelFollowUpNotes() {
    setFollowUpNotes(currentProspect?.notes ?? '')
  }

  // When switching to Convert tab, default to current prospect from Follow Up
  useEffect(() => {
    if (activeTab === 'convert' && currentProspect?.id) {
      setConvertProspectId(currentProspect.id)
    }
  }, [activeTab, currentProspect?.id])

  // Load first interaction date for Convert (earliest prospect_comment)
  useEffect(() => {
    if (!convertProspectId) {
      setConvertFirstInteractionDate('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('prospect_comments')
          .select('created_at')
          .eq('prospect_id', convertProspectId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (data?.created_at) {
          const d = new Date(data.created_at)
          setConvertFirstInteractionDate(d.toISOString().slice(0, 10))
        } else {
          setConvertFirstInteractionDate('')
        }
      } catch {
        if (!cancelled) setConvertFirstInteractionDate('')
      }
    })()
    return () => { cancelled = true }
  }, [convertProspectId])

  // Load service types when Convert tab is active
  useEffect(() => {
    if (activeTab !== 'convert') return
    supabase
      .from('service_types' as any)
      .select('id, name')
      .order('sequence_order', { ascending: true })
      .then(({ data }) => setConvertServiceTypes((data as unknown as { id: string; name: string }[]) ?? []))
  }, [activeTab])

  // Pre-fill first contact person when prospect changes
  const convertProspect = prospectListProspects.find((p) => p.id === convertProspectId) ?? followUpProspects.find((p) => p.id === convertProspectId)
  useEffect(() => {
    if (!convertProspect) return
    setConvertContactPersons((prev) => {
      const first = prev[0]
      return [{ name: convertProspect.contact_name ?? '', phone: convertProspect.phone_number ?? '', email: first?.email ?? '', note: first?.note ?? '' }, ...prev.slice(1)]
    })
  }, [convertProspectId, convertProspect?.id])

  useEffect(() => {
    const prospectId = searchParams.get('prospect_id')
    if (prospectId && followUpProspects.length > 0) {
      const idx = followUpProspects.findIndex((p) => p.id === prospectId)
      if (idx >= 0) setCurrentProspectIndex(idx)
    }
  }, [searchParams.get('prospect_id'), followUpProspects])

  useEffect(() => {
    if (currentProspect?.id) {
      loadComments(currentProspect.id)
    } else {
      setComments([])
    }
  }, [currentProspect?.id])

  async function loadProspectLedgerSeconds(prospectId: string) {
    if (!authUser?.id) return
    const { data } = await (supabase as any)
      .from('prospect_timer_events')
      .select('timer_seconds')
      .eq('user_id', authUser.id)
      .eq('prospect_id', prospectId)
    const rows = (data ?? []) as Array<{ timer_seconds: number }>
    const sum = rows.reduce((acc, r) => acc + (r.timer_seconds ?? 0), 0)
    setProspectLedgerSeconds(sum)
  }

  useEffect(() => {
    if (currentProspect?.id && authUser?.id) {
      loadProspectLedgerSeconds(currentProspect.id)
    } else {
      setProspectLedgerSeconds(0)
    }
  }, [currentProspect?.id, authUser?.id])

  async function loadProspectLedgerSecondsMap() {
    if (!authUser?.id) return
    const { data } = await (supabase as any)
      .from('prospect_timer_events')
      .select('prospect_id, timer_seconds')
      .eq('user_id', authUser.id)
    const rows = (data ?? []) as Array<{ prospect_id: string | null; timer_seconds: number }>
    const map: Record<string, number> = {}
    for (const r of rows) {
      if (r.prospect_id) {
        map[r.prospect_id] = (map[r.prospect_id] ?? 0) + (r.timer_seconds ?? 0)
      }
    }
    setProspectLedgerSecondsMap(map)
  }

  useEffect(() => {
    if (activeTab === 'prospect-list' && authUser?.id) {
      loadProspectLedgerSecondsMap()
    } else {
      setProspectLedgerSecondsMap({})
    }
  }, [activeTab, authUser?.id])

  const loadScheduledCallback = useCallback(async () => {
    if (!currentProspect?.id || !authUser?.id) {
      setScheduledCallback(null)
      return
    }
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('prospect_callbacks')
      .select('callback_date, note')
      .eq('prospect_id', currentProspect.id)
      .eq('user_id', authUser.id)
      .gte('callback_date', now)
      .order('callback_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    const row = data as { callback_date?: string; note?: string | null } | null
    if (row?.callback_date) {
      setScheduledCallback({ callback_date: row.callback_date, note: row.note ?? null })
    } else {
      setScheduledCallback(null)
    }
  }, [currentProspect?.id, authUser?.id])

  useEffect(() => {
    loadScheduledCallback()
  }, [loadScheduledCallback])

  // Acquire lock when viewing a prospect; release on cleanup (switch prospect/tab)
  useEffect(() => {
    if (activeTab !== 'follow-up' || !currentProspect?.id || !authUser?.id) return
    const prospectId = currentProspect.id
    void supabase.from('prospect_calling_locks').upsert(
      { prospect_id: prospectId, user_id: authUser.id },
      { onConflict: 'prospect_id' }
    )
    return () => {
      void supabase.from('prospect_calling_locks').delete().eq('prospect_id', prospectId).eq('user_id', authUser!.id)
    }
  }, [activeTab, currentProspect?.id, authUser?.id])

  // Follow Up timer: counts up while on tab, resets when user leaves and comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setFollowUpTimerSeconds(0)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (activeTab !== 'follow-up' || document.visibilityState !== 'visible') return
    const interval = setInterval(() => {
      setFollowUpTimerSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTab])

  // Auto-resize comment textarea as text wraps
  useEffect(() => {
    const el = commentInputRef
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(72, el.scrollHeight) + 'px'
  }, [commentInputValue, commentInputRef])

  // Load "Didn't Answer move next" preference from localStorage
  useEffect(() => {
    if (!authUser?.id) return
    const stored = localStorage.getItem(DIDNT_ANSWER_MOVE_NEXT_KEY(authUser.id))
    setDidntAnswerMoveNext(stored === 'true')
  }, [authUser?.id])

  function updateUrlProspectId(id: string | null) {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'follow-up')
      if (id) next.set('prospect_id', id)
      else next.delete('prospect_id')
      return next
    })
  }

  async function handleWarmthDelta(delta: number) {
    if (!currentProspect || saving) return
    setSaving(true)
    const newVal = (currentProspect.warmth_count ?? 0) + delta
    const { error } = await supabase.from('prospects').update({ warmth_count: newVal }).eq('id', currentProspect.id)
    if (!error) {
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, warmth_count: newVal } : p))
      )
    }
    setSaving(false)
  }

  async function handleWarmthReset() {
    if (!currentProspect || saving) return
    setSaving(true)
    const { error } = await supabase.from('prospects').update({ warmth_count: 0 }).eq('id', currentProspect.id)
    if (!error) {
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, warmth_count: 0 } : p))
      )
    }
    setSaving(false)
  }

  function openEditModal() {
    if (!currentProspect) return
    setEditingProspect(null)
    setEditCompanyName(currentProspect.company_name ?? '')
    setEditContactName(currentProspect.contact_name ?? '')
    setEditPhoneNumber(currentProspect.phone_number ?? '')
    setEditEmail(currentProspect.email ?? '')
    setEditLinksToWebsite(currentProspect.links_to_website ?? '')
    setEditModalOpen(true)
  }

  function openEditModalForProspect(p: Prospect) {
    setEditingProspect(p)
    setEditCompanyName(p.company_name ?? '')
    setEditContactName(p.contact_name ?? '')
    setEditPhoneNumber(p.phone_number ?? '')
    setEditEmail(p.email ?? '')
    setEditLinksToWebsite(p.links_to_website ?? '')
    setEditModalOpen(true)
  }

  async function handleDeleteProspect() {
    const prospectToEdit = editingProspect ?? currentProspect
    if (!prospectToEdit || saving) return
    if (!confirm(`Delete prospect "${prospectToEdit.company_name || 'Unknown'}"? This cannot be undone.`)) return
    setSaving(true)
    const { error } = await supabase.from('prospects').delete().eq('id', prospectToEdit.id)
    if (!error) {
      setFollowUpProspects((prev) => prev.filter((p) => p.id !== prospectToEdit.id))
      setProspectListProspects((prev) => prev.filter((p) => p.id !== prospectToEdit.id))
      if (currentProspect?.id === prospectToEdit.id) {
        const nextList = followUpProspects.filter((p) => p.id !== prospectToEdit.id)
        const nextIdx = Math.min(currentProspectIndex, Math.max(0, nextList.length - 1))
        setCurrentProspectIndex(nextIdx)
        setFollowUpTimerSeconds(0)
        updateUrlProspectId(nextList[nextIdx]?.id ?? null)
      }
      setEditModalOpen(false)
      setEditingProspect(null)
    }
    setSaving(false)
  }

  async function saveEdit() {
    const prospectToEdit = editingProspect ?? currentProspect
    if (!prospectToEdit || saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({
        company_name: editCompanyName.trim() || null,
        contact_name: editContactName.trim() || null,
        phone_number: editPhoneNumber.trim() || null,
        email: editEmail.trim() || null,
        links_to_website: editLinksToWebsite.trim() || null,
      })
      .eq('id', prospectToEdit.id)
    if (!error) {
      const updated = {
        company_name: editCompanyName.trim() || null,
        contact_name: editContactName.trim() || null,
        phone_number: editPhoneNumber.trim() || null,
        email: editEmail.trim() || null,
        links_to_website: editLinksToWebsite.trim() || null,
      }
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === prospectToEdit.id ? { ...p, ...updated } : p))
      )
      setProspectListProspects((prev) =>
        prev.map((p) => (p.id === prospectToEdit.id ? { ...p, ...updated } : p))
      )
      setEditModalOpen(false)
      setEditingProspect(null)
    }
    setSaving(false)
  }

  function openCallbackModal() {
    const now = new Date()
    setCallbackDate(now.toISOString().slice(0, 10))
    setCallbackTime(now.toTimeString().slice(0, 5))
    setCallbackNote('')
    setCallbackModalOpen(true)
  }

  async function saveCallback() {
    if (!currentProspect || !authUser?.id || saving) return
    const dateTime = new Date(`${callbackDate}T${callbackTime}`).toISOString()
    const title = `Call back: ${(currentProspect.company_name || 'Unknown').trim()} - ${(currentProspect.contact_name || 'Unknown').trim()}`
    setSaving(true)
    const { error } = await supabase.from('prospect_callbacks').insert({
      prospect_id: currentProspect.id,
      user_id: authUser.id,
      callback_date: dateTime,
      title,
      note: callbackNote.trim() || null,
    })
    if (!error) {
      setCallbackModalOpen(false)
      loadScheduledCallback()
    }
    setSaving(false)
  }

  async function saveTimerEvent(buttonName: 'no_longer_fit' | 'next_prospect' | 'cant_reach') {
    if (!authUser?.id || !currentProspect) return
    await (supabase as any).from('prospect_timer_events').insert({
      user_id: authUser.id,
      prospect_id: currentProspect.id,
      timer_seconds: followUpTimerSeconds,
      button_name: buttonName,
    })
  }

  async function handleNoLongerFit() {
    if (!currentProspect || !authUser?.id || saving) return
    setSaving(true)
    const prospectId = currentProspect.id
    const { error: updErr } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'not_a_fit' })
      .eq('id', prospectId)
    if (updErr) {
      setSaving(false)
      return
    }
    await saveTimerEvent('no_longer_fit')
    void supabase.from('prospect_calling_locks').delete().eq('prospect_id', prospectId).eq('user_id', authUser.id)
    loadMyTimeToday()
    await supabase.from('prospect_comments').insert({
      prospect_id: currentProspect.id,
      created_by: authUser.id,
      comment_text: 'Marked as not a fit',
      interaction_type: 'no_longer_fit',
    })
    const nextList = followUpProspects.filter((p) => p.id !== currentProspect.id)
    setFollowUpProspects(nextList)
    const nextIdx = Math.min(currentProspectIndex, Math.max(0, nextList.length - 1))
    setCurrentProspectIndex(nextIdx)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(nextList[nextIdx]?.id ?? null)
    setSaving(false)
  }

  async function handleCantReach() {
    if (!currentProspect || !authUser?.id || saving) return
    setSaving(true)
    const prospectId = currentProspect.id
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'cant_reach' })
      .eq('id', prospectId)
    if (error) {
      setSaving(false)
      return
    }
    await saveTimerEvent('cant_reach')
    void supabase.from('prospect_calling_locks').delete().eq('prospect_id', prospectId).eq('user_id', authUser.id)
    loadMyTimeToday()
    const updated = { ...currentProspect, prospect_fit_status: 'cant_reach' as const }
    setProspectListProspects((prev) => prev.map((p) => (p.id === currentProspect.id ? updated : p)))
    const nextList = followUpProspects.filter((p) => p.id !== currentProspect.id)
    setFollowUpProspects(nextList)
    const nextIdx = Math.min(currentProspectIndex, Math.max(0, nextList.length - 1))
    setCurrentProspectIndex(nextIdx)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(nextList[nextIdx]?.id ?? null)
    setSaving(false)
  }

  async function handleSendBack(p: Prospect) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: null })
      .eq('id', p.id)
    if (!error) {
      setProspectListProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, prospect_fit_status: null } : x)))
      setFollowUpProspects((prev) => {
        const exists = prev.some((x) => x.id === p.id)
        if (exists) return prev
        const added = { ...p, prospect_fit_status: null }
        return [...prev, added].sort((a, b) => {
          const aLc = a.last_contact ? new Date(a.last_contact).getTime() : 0
          const bLc = b.last_contact ? new Date(b.last_contact).getTime() : 0
          if (aLc !== bLc) return aLc - bLc
          return (a.company_name ?? '').localeCompare(b.company_name ?? '')
        })
      })
    }
    setSaving(false)
  }

  async function handleNotAFitFromList(p: Prospect) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'not_a_fit' })
      .eq('id', p.id)
    if (!error) {
      setProspectListProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, prospect_fit_status: 'not_a_fit' } : x)))
    }
    setSaving(false)
  }

  async function handleDeleteFromList(p: Prospect) {
    if (saving) return
    if (!confirm(`Delete prospect "${p.company_name || 'Unknown'}"? This cannot be undone.`)) return
    setSaving(true)
    const { error } = await supabase.from('prospects').delete().eq('id', p.id)
    if (!error) {
      setFollowUpProspects((prev) => prev.filter((x) => x.id !== p.id))
      setProspectListProspects((prev) => prev.filter((x) => x.id !== p.id))
    }
    setSaving(false)
  }

  async function handleDidntAnswer() {
    if (!currentProspect || !authUser?.id || saving) return
    setSaving(true)
    const text = commentInputValue.trim() || 'Prospect did not answer'
    const { error } = await supabase.from('prospect_comments').insert({
      prospect_id: currentProspect.id,
      created_by: authUser.id,
      comment_text: text,
      interaction_type: 'didnt_answer',
    })
    if (!error) {
      const now = new Date().toISOString()
      await supabase.from('prospects').update({ last_contact: now }).eq('id', currentProspect.id)
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now } : p))
      )
      await loadComments(currentProspect.id)
      setCommentInputValue('')
      if (didntAnswerMoveNext && followUpProspects.length > 1) {
        handleNextProspect(true)
      }
    }
    setSaving(false)
  }

  async function handleAnswered() {
    if (!currentProspect || !authUser?.id || saving) return
    setSaving(true)
    const text = commentInputValue.trim() || 'Contacted'
    const { error } = await supabase.from('prospect_comments').insert({
      prospect_id: currentProspect.id,
      created_by: authUser.id,
      comment_text: text,
      interaction_type: 'answered',
    })
    if (!error) {
      const now = new Date().toISOString()
      await supabase.from('prospects').update({ last_contact: now }).eq('id', currentProspect.id)
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now } : p))
      )
      await loadComments(currentProspect.id)
      setCommentInputValue('')
    }
    setSaving(false)
  }

  async function handleAddComment() {
    if (!currentProspect || !authUser?.id || saving) return
    const text = commentInputValue.trim()
    if (!text) return
    setSaving(true)
    const { error } = await supabase.from('prospect_comments').insert({
      prospect_id: currentProspect.id,
      created_by: authUser.id,
      comment_text: text,
      interaction_type: 'user_comment',
    })
    if (!error) {
      const now = new Date().toISOString()
      await supabase.from('prospects').update({ last_contact: now }).eq('id', currentProspect.id)
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now } : p))
      )
      await loadComments(currentProspect.id)
      setCommentInputValue('')
    }
    setSaving(false)
  }

  async function handleNextProspect(skipTimerEvent?: boolean) {
    if (followUpProspects.length <= 1) return
    if (!skipTimerEvent && currentProspect && authUser?.id) {
      await saveTimerEvent('next_prospect')
      void supabase.from('prospect_calling_locks').delete().eq('prospect_id', currentProspect.id).eq('user_id', authUser.id)
      loadMyTimeToday()
    }
    const nextIdx = (currentProspectIndex + 1) % followUpProspects.length
    setCurrentProspectIndex(nextIdx)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(followUpProspects[nextIdx]?.id ?? null)
  }

  function toggleProspectListSection(warmth: number) {
    setProspectListSectionOpen((prev) => ({ ...prev, [warmth]: !(prev[warmth] ?? true) }))
  }

  function selectProspectForList(p: Prospect) {
    setSelectedProspectForList(p)
    setActiveTab('follow-up')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'follow-up')
      next.set('prospect_id', p.id)
      return next
    })
  }

  async function getEffectiveMasterId(): Promise<string | null> {
    if (!authUser?.id) return null
    if (authRole === 'dev' || authRole === 'master_technician') return authUser.id
    if (authRole === 'assistant') {
      const { data: adoptions } = await supabase
        .from('master_assistants')
        .select('master_id')
        .eq('assistant_id', authUser.id)
      const masterId = (adoptions as { master_id: string }[] | null)?.[0]?.master_id
      return masterId ?? authUser.id
    }
    return authUser.id
  }

  async function saveNewProspect() {
    if (!authUser?.id || saving) return
    setNewProspectError(null)
    setSaving(true)
    const effectiveMasterId = await getEffectiveMasterId()
    if (!effectiveMasterId) {
      setNewProspectError('Unable to determine prospect owner.')
      setSaving(false)
      return
    }
    const payload = {
      master_user_id: effectiveMasterId,
      created_by: authUser.id,
      warmth_count: 0,
      company_name: newCompanyName.trim() || null,
      contact_name: newContactName.trim() || null,
      phone_number: newPhoneNumber.trim() || null,
      email: newEmail.trim() || null,
      links_to_website: newLinksToWebsite.trim() || null,
    }
    const { error } = await supabase.from('prospects').insert(payload)
    setSaving(false)
    if (error) {
      setNewProspectError(error.message)
      return
    }
    setNewProspectModalOpen(false)
    setNewCompanyName('')
    setNewContactName('')
    setNewPhoneNumber('')
    setNewEmail('')
    setNewLinksToWebsite('')
    await loadFollowUpProspects()
    await loadProspectListProspects()
  }

  async function handleConvertSubmit(payload: NewCustomerFormPayload) {
    if (!authUser?.id || convertSaving) return
    setConvertSaving(true)
    setConvertError(null)
    try {
      const { data: customer, error: custErr } = await supabase.from('customers').insert(payload).select().single()
      if (custErr) throw new Error(custErr.message)
      if (!customer) throw new Error('Failed to create customer')
      const customerId = (customer as { id: string }).id

      for (const cp of convertContactPersons) {
        if (!cp.name.trim()) continue
        const phoneVal = cp.phone.trim() || null
        const { error: cpErr } = await supabase.from('customer_contact_persons').insert({
          customer_id: customerId,
          name: cp.name.trim(),
          phone: phoneVal,
          email: cp.email.trim() || null,
          note: cp.note.trim() || null,
        })
        if (cpErr) throw new Error(`Failed to add contact: ${cpErr.message}`)
      }

      for (const b of convertBids) {
        if (!b.project_name.trim() || !b.service_type_id) continue
        const { error: bidErr } = await supabase.from('bids').insert({
          customer_id: customerId,
          created_by: authUser.id,
          service_type_id: b.service_type_id,
          project_name: b.project_name.trim(),
        })
        if (bidErr) throw new Error(`Failed to add bid: ${bidErr.message}`)
      }

      navigate(`/customers/${customerId}`)
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Failed to convert')
      throw err
    } finally {
      setConvertSaving(false)
    }
  }

  const canAccessFollowUp =
    authUser && authRole && ['dev', 'master_technician', 'assistant'].includes(authRole)

  if (authLoading) {
    return (
      <div style={{ padding: '1rem 1.5rem' }}>
        <p style={{ color: '#6b7280' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Prospects</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {canAccessFollowUp && (
          <button
            type="button"
            onClick={() => {
              setNewCompanyName('')
              setNewContactName('')
              setNewPhoneNumber('')
              setNewLinksToWebsite('')
              setNewProspectError(null)
              setNewProspectModalOpen(true)
            }}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            New Prospect
          </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setTab('follow-up')}
          style={tabStyle(activeTab === 'follow-up')}
        >
          Follow Up
        </button>
        <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        <button
          type="button"
          onClick={() => setTab('prospect-list')}
          style={tabStyle(activeTab === 'prospect-list')}
        >
          Prospect List
        </button>
        <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        <button
          type="button"
          onClick={() => setTab('convert')}
          style={tabStyle(activeTab === 'convert')}
        >
          Convert
        </button>
      </div>

      {activeTab === 'follow-up' && (
        <>
          {!canAccessFollowUp ? (
            <p style={{ color: '#6b7280' }}>You do not have access to Follow Up.</p>
          ) : followUpLoading ? (
            <p style={{ color: '#6b7280' }}>Loading...</p>
          ) : followUpProspects.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              No prospects to follow up. Add prospects in Prospect List.
            </p>
          ) : currentProspect ? (
            <div>
              {/* Three button groups */}
              {(() => {
                const btnBase = {
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, opacity 0.15s',
                } as const
                const btnSecondary = { ...btnBase, background: 'white', color: '#374151', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }
                const btnPrimary = { ...btnBase, background: '#3b82f6', color: 'white', boxShadow: '0 1px 2px rgba(59,130,246,0.3)' }
                const btnGreen = { ...btnBase, background: '#059669', color: 'white', boxShadow: '0 1px 2px rgba(5,150,105,0.3)' }
                const btnDestructive = { ...btnBase, background: '#dc2626', color: 'white', boxShadow: '0 1px 2px rgba(220,38,38,0.3)' }
                const btnDisabled = (s: object) => ({ ...s, opacity: 0.6, cursor: 'not-allowed' as const })
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, padding: '0 0.5rem', color: '#6b7280' }}>Warmth</span>
                      <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 600, fontSize: '1rem', color: '#1f2937' }}>
                        {currentProspect.warmth_count ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleWarmthDelta(-1)}
                        disabled={saving}
                        style={saving ? btnDisabled(btnSecondary) : { ...btnSecondary, padding: '0.5rem 0.75rem' }}
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        onClick={handleWarmthReset}
                        disabled={saving}
                        style={saving ? btnDisabled(btnSecondary) : { ...btnSecondary, padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWarmthDelta(1)}
                        disabled={saving}
                        style={saving ? btnDisabled(btnSecondary) : { ...btnSecondary, padding: '0.5rem 0.75rem' }}
                      >
                        +1
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={openEditModal}
                        disabled={saving}
                        style={saving ? btnDisabled(btnSecondary) : btnSecondary}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={openCallbackModal}
                        disabled={saving}
                        style={saving ? btnDisabled(btnGreen) : btnGreen}
                      >
                        Set Callback Date & Time
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleNoLongerFit}
                        disabled={saving}
                        style={saving ? btnDisabled(btnDestructive) : btnDestructive}
                      >
                        No Longer a Fit
                      </button>
                      <button
                        type="button"
                        onClick={handleCantReach}
                        disabled={saving}
                        style={saving ? btnDisabled(btnSecondary) : btnSecondary}
                      >
                        Can't reach
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNextProspect()}
                        disabled={followUpProspects.length <= 1}
                        style={followUpProspects.length <= 1 ? btnDisabled(btnPrimary) : btnPrimary}
                      >
                        Next Prospect
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.0625rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>this time</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTimerHistoryModalOpen(true)
                            loadTimerEvents()
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.5rem 1rem',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            fontFamily: 'ui-monospace, monospace',
                            background: 'none',
                            border: '1px solid transparent',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                          title="Time on Follow Up (resets when you leave and return). Click to view history."
                        >
                          {String(Math.floor(followUpTimerSeconds / 60)).padStart(2, '0')}:{String(followUpTimerSeconds % 60).padStart(2, '0')}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.0625rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>all time</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.5rem 1rem',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '0.875rem',
                            color: '#059669',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 500,
                          }}
                          title="Total time spent on this prospect (ledger + current session)"
                        >
                          {formatTimerSeconds(prospectLedgerSeconds + followUpTimerSeconds)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.0625rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>my day</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.5rem 1rem',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '0.875rem',
                            color: '#059669',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 500,
                          }}
                          title="My time prospecting today"
                        >
                          {(myTimeTodaySeconds + followUpTimerSeconds) === 0 ? '—' : formatTimerSeconds(myTimeTodaySeconds + followUpTimerSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Info block with notes */}
              <div className="followUpInfoCard">
                <div className="followUpInfoCardDetails">
                  <div><strong>Company Name:</strong> {currentProspect.company_name || '—'}</div>
                  <div><strong>Contact Name:</strong> {currentProspect.contact_name || '—'}</div>
                  <div>
                    <strong>Phone Number:</strong>{' '}
                    {currentProspect.phone_number ? (
                      <a href={`tel:${encodeURIComponent(currentProspect.phone_number)}`} style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                        {currentProspect.phone_number}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>
                    <strong>Email:</strong>{' '}
                    {currentProspect.email ? (
                      <a href={`mailto:${encodeURIComponent(currentProspect.email)}`} style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                        {currentProspect.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>
                    <strong>Links to Website:</strong>{' '}
                    {currentProspect.links_to_website ? (
                      <a
                        href={currentProspect.links_to_website.startsWith('http') ? currentProspect.links_to_website : `https://${currentProspect.links_to_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {currentProspect.links_to_website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  {scheduledCallback && (
                    <div>
                      <strong>Call back scheduled for:</strong>{' '}
                      <Link
                        to="/calendar"
                        style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {formatDateTime(scheduledCallback.callback_date)}
                        {scheduledCallback.note && ` (${scheduledCallback.note})`}
                      </Link>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>Last Contact:</strong>
                    <span>{formatDateTime(comments[0]?.created_at ?? currentProspect.last_contact)}</span>
                    {formatDueBadge(currentProspect.last_contact) && (
                      <span
                        style={{
                          padding: '0.125rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: 4,
                          background: '#fef3c7',
                          color: '#92400e',
                        }}
                      >
                        {formatDueBadge(currentProspect.last_contact)}
                      </span>
                    )}
                  </div>
                  <div><strong>Last Successful Contact:</strong> {formatDateTime(comments.find((c) => c.interaction_type === 'answered')?.created_at ?? null) || '—'}</div>
                </div>
                <div className="followUpInfoCardNotes">
                  <textarea
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="Add notes..."
                    style={{ width: '100%', minHeight: 120, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9375rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div className="followUpInfoCardNotesActions">
                    <button
                      type="button"
                      onClick={saveFollowUpNotes}
                      disabled={followUpNotesSaving || followUpNotes === (currentProspect.notes ?? '')}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: followUpNotesSaving || followUpNotes === (currentProspect.notes ?? '') ? 'not-allowed' : 'pointer', opacity: followUpNotesSaving || followUpNotes === (currentProspect.notes ?? '') ? 0.6 : 1 }}
                    >
                      {followUpNotesSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelFollowUpNotes}
                      disabled={followUpNotes === (currentProspect.notes ?? '')}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: followUpNotes === (currentProspect.notes ?? '') ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Comments</h3>
                  <button
                    type="button"
                    onClick={handleDidntAnswer}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      borderRadius: 8,
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde68a',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    Didn&apos;t Answer
                  </button>
                  <button
                    type="button"
                    onClick={handleAnswered}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      borderRadius: 8,
                      background: '#16a34a',
                      color: 'white',
                      border: 'none',
                      boxShadow: '0 1px 2px rgba(22,163,74,0.3)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    Answered
                  </button>
                </div>
                <textarea
                  ref={setCommentInputRef}
                  placeholder="Type a comment and press Enter to add, or click Didn't Answer / Answered to add with that tag"
                  value={commentInputValue}
                  onChange={(e) => setCommentInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: '4.5rem',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    marginBottom: '0.75rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                {comments.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No comments yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {comments.map((c) => (
                      <li
                        key={c.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          marginBottom: '0.5rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          fontSize: '0.875rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {formatDateTime(c.created_at)}
                            {c.created_by_user && (
                              <span style={{ marginLeft: '0.5rem' }}>
                                · {(c.created_by_user.name || c.created_by_user.email || 'Unknown').trim()}
                              </span>
                            )}
                          </span>
                          {(c.interaction_type === 'answered' || c.interaction_type === 'didnt_answer') && (
                            <span style={{ fontSize: '0.7rem', background: '#e5e7eb', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                              {formatInteractionType(c.interaction_type)}
                            </span>
                          )}
                        </div>
                        <div>{c.comment_text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          {canAccessFollowUp && (
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={didntAnswerMoveNext}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setDidntAnswerMoveNext(checked)
                    if (authUser?.id) {
                      localStorage.setItem(DIDNT_ANSWER_MOVE_NEXT_KEY(authUser.id), String(checked))
                    }
                  }}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                Mark and Move to next prospect when Didn&apos;t Answer is clicked
              </label>
              <button
                type="button"
                onClick={() => {
                  setMyTimeModalOpen(true)
                  loadMyTimeStats()
                }}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: '#3b82f6',
                  textDecoration: 'underline',
                }}
              >
                my time
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'prospect-list' && (
        <>
          {!canAccessFollowUp ? (
            <p style={{ color: '#6b7280' }}>You do not have access to Prospect List.</p>
          ) : prospectListLoading ? (
            <p style={{ color: '#6b7280' }}>Loading...</p>
          ) : (() => {
            const NO_LONGER_FIT_KEY = -1
            const CANT_REACH_KEY = -2
            const byWarmth = new Map<number, Prospect[]>()
            const active: Prospect[] = []
            const noLongerFit: Prospect[] = []
            const cantReach: Prospect[] = []
            for (const p of prospectListProspects) {
              if (p.prospect_fit_status === 'cant_reach') {
                cantReach.push(p)
              } else if (p.prospect_fit_status === 'not_a_fit') {
                noLongerFit.push(p)
              } else {
                active.push(p)
              }
            }
            for (const p of active) {
              const w = p.warmth_count ?? 0
              const list = byWarmth.get(w) ?? []
              list.push(p)
              byWarmth.set(w, list)
            }
            if (noLongerFit.length > 0) {
              byWarmth.set(NO_LONGER_FIT_KEY, noLongerFit)
            }
            if (cantReach.length > 0) {
              byWarmth.set(CANT_REACH_KEY, cantReach)
            }
            const sortProspects = (list: Prospect[]) => {
              list.sort((a, b) => {
                const aLc = a.last_contact ? new Date(a.last_contact).getTime() : 0
                const bLc = b.last_contact ? new Date(b.last_contact).getTime() : 0
                if (bLc !== aLc) return bLc - aLc
                return (a.company_name ?? '').localeCompare(b.company_name ?? '')
              })
            }
            for (const list of byWarmth.values()) {
              sortProspects(list)
            }
            const warmthKeys = Array.from(byWarmth.keys()).sort((a, b) => b - a)
            return warmthKeys.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No prospects yet.</p>
            ) : (
              <div>
                {warmthKeys.map((warmth) => {
                  const prospects = byWarmth.get(warmth) ?? []
                  const isOpen = prospectListSectionOpen[warmth] ?? (warmth !== NO_LONGER_FIT_KEY && warmth !== CANT_REACH_KEY)
                  return (
                    <div key={warmth}>
                      <button
                        type="button"
                        onClick={() => toggleProspectListSection(warmth)}
                        aria-expanded={isOpen}
                        style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                      >
                        <span aria-hidden>{isOpen ? '\u25BC' : '\u25B6'}</span>
                        {warmth === NO_LONGER_FIT_KEY ? `No longer a fit (${prospects.length})` : warmth === CANT_REACH_KEY ? `Can't reach (${prospects.length})` : `Warmth ${warmth} (${prospects.length})`}
                      </button>
                      {isOpen && (
                        <div className="prospectListWrapper">
                          {/* Desktop: table */}
                          <div className="prospectListDesktop">
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: '16%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '11%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '25%' }} />
                                {warmth === CANT_REACH_KEY && <col style={{ width: '6%' }} />}
                              </colgroup>
                              <thead style={{ background: '#f9fafb' }}>
                                <tr>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Company Name</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contact Name</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Last Contact</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email / Links</th>
                                  {warmth === CANT_REACH_KEY && <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {prospects.length === 0 ? (
                                  <tr><td colSpan={warmth === CANT_REACH_KEY ? 7 : 6} style={{ padding: '0.75rem', color: '#6b7280' }}>No prospects in this group</td></tr>
                                ) : (
                                  prospects.map((p) => (
                                    <tr
                                      key={p.id}
                                      onClick={() => selectProspectForList(p)}
                                      style={{
                                        borderBottom: '1px solid #e5e7eb',
                                        cursor: 'pointer',
                                        background: selectedProspectForList?.id === p.id ? '#eff6ff' : undefined,
                                      }}
                                    >
                                      <td style={{ padding: '0.75rem' }}>{p.company_name || '—'}</td>
                                      <td style={{ padding: '0.75rem' }}>{p.contact_name || '—'}</td>
                                      <td style={{ padding: '0.75rem' }}>
                                        {p.phone_number ? (
                                          <a href={`tel:${encodeURIComponent(p.phone_number)}`} style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                                            {p.phone_number}
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                      <td style={{ padding: '0.75rem' }}>{formatDateTime(p.last_contact)}{formatDaysSince(p.last_contact)}</td>
                                      <td style={{ padding: '0.75rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', color: '#059669' }}>
                                        {(prospectLedgerSecondsMap[p.id] ?? 0) === 0 ? '—' : formatTimerSeconds(prospectLedgerSecondsMap[p.id] ?? 0)}
                                      </td>
                                      <td style={{ padding: '0.75rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <div>
                                            {p.email ? (
                                              <a href={`mailto:${encodeURIComponent(p.email)}`} style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                                                {p.email}
                                              </a>
                                            ) : (
                                              '—'
                                            )}
                                          </div>
                                          <div>
                                            {p.links_to_website ? (
                                              <a
                                                href={getWebsiteHref(p.links_to_website)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                                              >
                                                {formatWebsiteDisplay(p.links_to_website)}
                                              </a>
                                            ) : (
                                              '—'
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      {warmth === CANT_REACH_KEY && (
                                        <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                            <button type="button" onClick={() => openEditModalForProspect(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Edit</button>
                                            <button type="button" onClick={() => handleSendBack(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Send back</button>
                                            <button type="button" onClick={() => handleNotAFitFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Not a fit</button>
                                            <button type="button" onClick={() => handleDeleteFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #dc2626', borderRadius: 4, background: 'white', color: '#dc2626', cursor: saving ? 'not-allowed' : 'pointer' }}>Delete</button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          {/* Mobile: cards */}
                          <div className="prospectListMobile">
                            {prospects.length === 0 ? (
                              <div className="prospectListMobileEmpty">No prospects in this group</div>
                            ) : (
                              prospects.map((p) => (
                                <div key={p.id} style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() => selectProspectForList(p)}
                                    className={`prospectListMobileCard ${selectedProspectForList?.id === p.id ? 'prospectListMobileCardSelected' : ''}`}
                                    style={warmth === CANT_REACH_KEY ? { paddingBottom: '3rem' } : undefined}
                                  >
                                    <div className="prospectListMobileCardTitle">{p.company_name || '—'}</div>
                                    <div className="prospectListMobileCardRow">
                                      <span className="prospectListMobileCardLabel">Contact</span>
                                      <span>{p.contact_name || '—'}</span>
                                    </div>
                                    <div className="prospectListMobileCardRow">
                                      <span className="prospectListMobileCardLabel">Phone</span>
                                      <span>
                                        {p.phone_number ? (
                                          <a href={`tel:${encodeURIComponent(p.phone_number)}`} onClick={(e) => e.stopPropagation()} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                            {p.phone_number}
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </span>
                                    </div>
                                    <div className="prospectListMobileCardRow">
                                      <span className="prospectListMobileCardLabel">Last Contact</span>
                                      <span>{formatDateTime(p.last_contact)}{formatDaysSince(p.last_contact)}</span>
                                    </div>
                                    <div className="prospectListMobileCardRow">
                                      <span className="prospectListMobileCardLabel">Time</span>
                                      <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', color: '#059669' }}>
                                        {(prospectLedgerSecondsMap[p.id] ?? 0) === 0 ? '—' : formatTimerSeconds(prospectLedgerSecondsMap[p.id] ?? 0)}
                                      </span>
                                    </div>
                                    <div className="prospectListMobileCardRow">
                                      <span className="prospectListMobileCardLabel">Email / Links</span>
                                      <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span>
                                          {p.email ? (
                                            <a href={`mailto:${encodeURIComponent(p.email)}`} onClick={(e) => e.stopPropagation()} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                              {p.email}
                                            </a>
                                          ) : (
                                            '—'
                                          )}
                                        </span>
                                        <span>
                                          {p.links_to_website ? (
                                            <a
                                              href={getWebsiteHref(p.links_to_website)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              style={{ color: '#2563eb', textDecoration: 'underline' }}
                                            >
                                              {formatWebsiteDisplay(p.links_to_website)}
                                            </a>
                                          ) : (
                                            '—'
                                          )}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="prospectListMobileCardMeta">
                                      <span>Warmth {p.warmth_count ?? 0}</span>
                                    </div>
                                  </button>
                                  {warmth === CANT_REACH_KEY && (
                                    <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                      <button type="button" onClick={() => openEditModalForProspect(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Edit</button>
                                      <button type="button" onClick={() => handleSendBack(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Send back</button>
                                      <button type="button" onClick={() => handleNotAFitFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Not a fit</button>
                                      <button type="button" onClick={() => handleDeleteFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #dc2626', borderRadius: 4, background: 'white', color: '#dc2626', cursor: saving ? 'not-allowed' : 'pointer' }}>Delete</button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </>
      )}

      {activeTab === 'convert' && (
        <div className="prospectsConvert">
          {!canAccessFollowUp ? (
            <p style={{ color: '#6b7280' }}>You do not have access to Convert.</p>
          ) : (
            <>
              {/* Prospect selector */}
              <div className="convertProspectSelector">
                <label htmlFor="convert-prospect" className="convertLabel">Select prospect to convert</label>
                <select
                  id="convert-prospect"
                  className="convertSelect"
                  value={convertProspectId ?? ''}
                  onChange={(e) => setConvertProspectId(e.target.value || null)}
                >
                  <option value="">Choose a prospect...</option>
                  {[...prospectListProspects, ...followUpProspects.filter((p) => !prospectListProspects.some((lp) => lp.id === p.id))].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name || '—'} {p.contact_name ? `(${p.contact_name})` : ''}
                    </option>
                  ))}
                </select>
                {convertProspect && (
                  <div className="convertProspectSummary">
                    <div className="convertProspectSummaryRow">
                      <span className="convertProspectSummaryLabel">Company</span>
                      <span>{convertProspect.company_name || '—'}</span>
                    </div>
                    <div className="convertProspectSummaryRow">
                      <span className="convertProspectSummaryLabel">Contact</span>
                      <span>{convertProspect.contact_name || '—'}</span>
                    </div>
                    <div className="convertProspectSummaryRow">
                      <span className="convertProspectSummaryLabel">Phone</span>
                      <span>{convertProspect.phone_number ? (
                        <a href={`tel:${encodeURIComponent(convertProspect.phone_number)}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{convertProspect.phone_number}</a>
                      ) : '—'}</span>
                    </div>
                    <div className="convertProspectSummaryRow">
                      <span className="convertProspectSummaryLabel">Email</span>
                      <span>{convertProspect.email ? (
                        <a href={`mailto:${encodeURIComponent(convertProspect.email)}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{convertProspect.email}</a>
                      ) : '—'}</span>
                    </div>
                  </div>
                )}
              </div>

              {convertProspectId ? (
                <div className="convertFormLayout">
                  {/* New Customer section */}
                  <section className="convertSection">
                    <h3 className="convertSectionTitle">1. Customer details</h3>
                    <p className="convertSectionDesc">Basic info is pre-filled from the prospect.</p>
                    <NewCustomerForm
                      mode="page"
                      showQuickFill={false}
                      initialValues={{
                        name: convertProspect?.company_name ?? '',
                        address: '',
                        phone: convertProspect?.phone_number ?? '',
                        email: convertProspect?.email ?? '',
                        dateMet: convertFirstInteractionDate,
                      }}
                      onSubmitForConvert={handleConvertSubmit}
                    />
                  </section>

                  {/* Contact persons */}
                  <section className="convertSection">
                    <h3 className="convertSectionTitle">2. Contact persons</h3>
                    <p className="convertSectionDesc">Add people who will be associated with this customer.</p>
                    <div className="convertCardsGrid">
                      {convertContactPersons.map((cp, i) => (
                        <div key={i} className="convertCard">
                          <div className="convertCardHeader">
                            <span className="convertCardTitle">Contact {i + 1}</span>
                            {convertContactPersons.length > 1 && (
                              <button
                                type="button"
                                className="convertRemoveBtn"
                                onClick={() => setConvertContactPersons((prev) => prev.filter((_, j) => j !== i))}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="convertCardFields">
                            <input
                              type="text"
                              className="convertInput"
                              placeholder="Name"
                              value={cp.name}
                              onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))}
                            />
                            <input
                              type="text"
                              className="convertInput"
                              placeholder="Phone"
                              value={cp.phone}
                              onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, phone: e.target.value } : c)))}
                            />
                            <input
                              type="email"
                              className="convertInput"
                              placeholder="Email"
                              value={cp.email}
                              onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, email: e.target.value } : c)))}
                            />
                            <input
                              type="text"
                              className="convertInput"
                              placeholder="Note"
                              value={cp.note}
                              onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, note: e.target.value } : c)))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="convertAddBtn"
                      onClick={() => setConvertContactPersons((prev) => [...prev, { name: '', phone: '', email: '', note: '' }])}
                    >
                      + Add contact person
                    </button>
                  </section>

                  {/* Bids */}
                  <section className="convertSection">
                    <h3 className="convertSectionTitle">3. Bids</h3>
                    <p className="convertSectionDesc">Create initial bids for this customer.</p>
                    <div className="convertCardsGrid">
                      {convertBids.map((b, i) => (
                        <div key={i} className="convertCard">
                          <div className="convertCardHeader">
                            <span className="convertCardTitle">Bid {i + 1}</span>
                            {convertBids.length > 1 && (
                              <button
                                type="button"
                                className="convertRemoveBtn"
                                onClick={() => setConvertBids((prev) => prev.filter((_, j) => j !== i))}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="convertCardFields">
                            <input
                              type="text"
                              className="convertInput"
                              placeholder="Project name"
                              value={b.project_name}
                              onChange={(e) => setConvertBids((prev) => prev.map((x, j) => (j === i ? { ...x, project_name: e.target.value } : x)))}
                            />
                            <select
                              className="convertSelect"
                              value={b.service_type_id}
                              onChange={(e) => setConvertBids((prev) => prev.map((x, j) => (j === i ? { ...x, service_type_id: e.target.value } : x)))}
                            >
                              <option value="">Select service type...</option>
                              {convertServiceTypes.map((st) => (
                                <option key={st.id} value={st.id}>{st.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="convertAddBtn"
                      onClick={() => setConvertBids((prev) => [...prev, { project_name: '', service_type_id: convertServiceTypes[0]?.id ?? '' }])}
                    >
                      + Add bid
                    </button>
                  </section>

                  {/* Convert button */}
                  <div className="convertSubmitRow">
                    {convertError && <p className="convertError">{convertError}</p>}
                    <button
                      type="submit"
                      form="convert-customer-form"
                      disabled={convertSaving}
                      className="convertSubmit"
                    >
                      {convertSaving ? 'Converting…' : 'Convert to customer'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="convertEmptyState">
                  <p className="convertEmptyStateText">Select a prospect above to convert them into a customer.</p>
                  <p className="convertEmptyStateHint">You can add contact persons and bids during the conversion.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editModalOpen && (currentProspect || editingProspect) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => { if (!saving) { setEditModalOpen(false); setEditingProspect(null) } }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Edit Prospect</h3>
              <button
                type="button"
                className="prospectsEditModalDeleteBtn"
                onClick={handleDeleteProspect}
                disabled={saving}
                title="Delete prospect"
                style={{
                  padding: '0.375rem',
                  background: 'none',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  color: '#9ca3af',
                  opacity: saving ? 0.5 : 1,
                }}
                aria-label="Delete prospect"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Company Name</span>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Contact Name</span>
                <input
                  type="text"
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Phone Number</span>
                <input
                  type="text"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Email</span>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Links to Website</span>
                <input
                  type="text"
                  value={editLinksToWebsite}
                  onChange={(e) => setEditLinksToWebsite(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { if (!saving) { setEditModalOpen(false); setEditingProspect(null) } }}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Callback modal */}
      {callbackModalOpen && currentProspect && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => !saving && setCallbackModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0' }}>Set Call back date and time</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Date</span>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Time</span>
                <input
                  type="time"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Note</span>
                <input
                  type="text"
                  value={callbackNote}
                  onChange={(e) => setCallbackNote(e.target.value)}
                  placeholder="Optional note (e.g. discuss pricing)"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={saveCallback}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => !saving && setCallbackModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer history modal */}
      {timerHistoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setTimerHistoryModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 480,
              maxHeight: '80vh',
              width: '90%',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0' }}>Timer history</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Past instances when you clicked No Longer a Fit, Next Prospect, or Can&apos;t reach.
            </p>
            {timerEventsLoading ? (
              <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : timerEvents.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No events yet.</p>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date & time</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Timer</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Button</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Prospect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timerEvents.map((e) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{formatDateTime(e.created_at)}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace' }}>{formatTimerSeconds(e.timer_seconds)}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{formatTimerButtonName(e.button_name)}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280' }}>{e.prospect?.company_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setTimerHistoryModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My time modal */}
      {myTimeModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setMyTimeModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 360,
              width: '90%',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0' }}>My time prospecting</h3>
            {myTimeStatsLoading ? (
              <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : myTimeStats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9375rem' }}>
                {(() => {
                  const sessionBonus = activeTab === 'follow-up' ? followUpTimerSeconds : 0
                  const today = myTimeStats.today + sessionBonus
                  const last7 = myTimeStats.last7Days + sessionBonus
                  const lifetime = myTimeStats.lifetime + sessionBonus
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#6b7280' }}>Today</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500, color: '#059669' }}>
                          {today === 0 ? '—' : formatTimerSeconds(today)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#6b7280' }}>Yesterday</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>
                          {myTimeStats.yesterday === 0 ? '—' : formatTimerSeconds(myTimeStats.yesterday)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#6b7280' }}>Last 7 days</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500, color: '#059669' }}>
                          {last7 === 0 ? '—' : formatTimerSeconds(last7)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#6b7280' }}>Lifetime</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500, color: '#059669' }}>
                          {lifetime === 0 ? '—' : formatTimerSeconds(lifetime)}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : null}
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setMyTimeModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Prospect modal */}
      {newProspectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => !saving && setNewProspectModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0' }}>New Prospect</h3>
            {newProspectError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{newProspectError}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Company Name</span>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Contact Name</span>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Phone Number</span>
                <input
                  type="text"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Email</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Links to Website</span>
                <input
                  type="text"
                  value={newLinksToWebsite}
                  onChange={(e) => setNewLinksToWebsite(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={saveNewProspect}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => !saving && setNewProspectModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
