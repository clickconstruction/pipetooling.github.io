import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useDispatchTaskModal } from '../contexts/DispatchTaskModalContext'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../lib/dispatchRequestHelpers'
import { buildClockBidsSearchParams } from '../lib/clockBidsSearchParams'
import { MapPin, Check } from 'lucide-react'
import BidServiceTypeSearchToggles from './BidServiceTypeSearchToggles'
import {
  formatUnifiedResult,
  serviceTypeTagForUnifiedRow,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'
import type { UserRole } from '../hooks/useAuth'
import { fieldRoleServiceTypeIdsForUser, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'

export default function DispatchTaskModal() {
  const modal = useDispatchTaskModal()
  const { user: authUser } = useAuth()
  const { prefixMap } = useLedgerDisplayPrefixes()
  const { showToast } = useToastContext()
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [unifiedSearchText, setUnifiedSearchText] = useState('')
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([])
  const [selectedReference, setSelectedReference] = useState<UnifiedSearchResult | null>(null)
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string }>>([])
  const [enabledBidServiceTypeIds, setEnabledBidServiceTypeIds] = useState<string[]>([])
  const [subcontractorServiceTypeIds, setSubcontractorServiceTypeIds] = useState<string[] | null>(null)
  const [referenceNoHits, setReferenceNoHits] = useState(false)
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  useEffect(() => {
    if (!modal?.isDispatchModalOpen) return
    const preset = modal.dispatchPreset
    setTitle(preset?.titleSeed ?? '')
    setLinks([])
    setLocationLat(null)
    setLocationLng(null)
    setUnifiedSearchText('')
    setUnifiedSearchResults([])
    setSelectedReference(preset?.reference ?? null)
    setReferenceNoHits(false)
    setFormError(null)
    setSending(false)
    const t = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [modal?.isDispatchModalOpen, modal?.dispatchPreset])

  useEffect(() => {
    if (!modal?.isDispatchModalOpen) return
    const load = async () => {
      const { data: stData } = await supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true })
      const types = (stData ?? []) as Array<{ id: string; name: string }>
      if (authUser?.id) {
        const { data: meData } = await supabase
          .from('users')
          .select(
            'role, estimator_service_type_ids, primary_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids',
          )
          .eq('id', authUser.id)
          .single()
        const me = meData as {
          role?: string
          estimator_service_type_ids?: string[] | null
          primary_service_type_ids?: string[] | null
          subcontractor_service_type_ids?: string[] | null
          helpers_service_type_ids?: string[] | null
        } | null
        const ur = me?.role as UserRole | undefined
        const scopedFieldIds = ur ? fieldRoleServiceTypeIdsForUser(ur, me ?? {}) : null
        if (isSubcontractorLikeRole(ur)) {
          setSubcontractorServiceTypeIds(scopedFieldIds && scopedFieldIds.length > 0 ? scopedFieldIds : null)
        } else {
          setSubcontractorServiceTypeIds(null)
        }
        const estIds = me?.estimator_service_type_ids
        const primIds = me?.primary_service_type_ids
        const filtered =
          me?.role === 'estimator' && estIds && estIds.length > 0
            ? types.filter((t) => estIds.includes(t.id))
            : me?.role === 'primary' && primIds && primIds.length > 0
              ? types.filter((t) => primIds.includes(t.id))
              : scopedFieldIds && scopedFieldIds.length > 0 && isSubcontractorLikeRole(ur)
                ? types.filter((t) => scopedFieldIds.includes(t.id))
                : types
        const filteredIds = filtered.map((t) => t.id)
        if (filtered.length === 1) {
          setEnabledBidServiceTypeIds([filtered[0]!.id])
        } else {
          setEnabledBidServiceTypeIds((prev) => {
            const kept = prev.filter((id) => filteredIds.includes(id))
            if (kept.length === 0) return filteredIds
            const missing = filteredIds.filter((id) => !kept.includes(id))
            return missing.length > 0 ? [...kept, ...missing] : kept
          })
        }
        setServiceTypes(filtered)
      } else {
        setEnabledBidServiceTypeIds(types.map((t) => t.id))
        setServiceTypes(types)
        setSubcontractorServiceTypeIds(null)
      }
    }
    void load()
  }, [modal?.isDispatchModalOpen, authUser?.id])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!modal?.isDispatchModalOpen || !unifiedSearchText.trim()) {
        setUnifiedSearchResults([])
        setReferenceNoHits(false)
        return
      }
      const q = unifiedSearchText.trim()
      setReferenceNoHits(false)
      const bidsParams = buildClockBidsSearchParams(q, {
        serviceTypes,
        enabledBidServiceTypeIds,
        subcontractorServiceTypeIds,
      })
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
        setReferenceNoHits(merged.length === 0)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [modal?.isDispatchModalOpen, unifiedSearchText, serviceTypes, enabledBidServiceTypeIds, subcontractorServiceTypeIds])

  if (!modal?.isDispatchModalOpen) return null

  async function handleSend() {
    const m = modal
    if (!m) return
    const trimmed = title.trim()
    if (!trimmed) {
      setFormError('Title is required.')
      return
    }
    setFormError(null)
    setSending(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        setFormError('Not signed in.')
        setSending(false)
        return
      }

      const linkArr = links.map((u) => u.trim()).filter(Boolean)
      const ref = selectedReference

      const row = await withSupabaseRetry<{ id: string }>(
        async () =>
          supabase
            .from('dispatch_requests')
            .insert({
              from_user_id: user.id,
              title: trimmed,
              links: linkArr.length ? linkArr : [],
              job_ledger_id: ref?.source === 'job' ? ref.id : null,
              bid_id: ref?.source === 'bid' ? ref.id : null,
              reference_summary: ref ? formatUnifiedResult(ref, prefixMap) : null,
              ...(locationLat != null &&
                locationLng != null && { location_lat: locationLat, location_lng: locationLng }),
            })
            .select('id')
            .single(),
        'insert dispatch_request',
      )

      const id = row?.id
      if (!id) {
        setFormError('Could not create request.')
        setSending(false)
        return
      }
      notifyDispatchRequestsChanged()

      const { error: fnErr } = await supabase.functions.invoke('notify-dispatch-request', {
        body: { dispatch_request_id: id },
      })
      if (fnErr) {
        showToast(`Sent, but notification may have failed: ${fnErr.message}`, 'warning')
      } else {
        showToast('Sent to Dispatch.', 'success')
      }

      m.closeDispatchModal()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-task-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => !sending && modal.closeDispatchModal()}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 12,
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dispatch-task-modal-title" style={{ marginTop: 0, marginBottom: 0 }}>
          Send a task to Dispatch
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9375rem', color: 'var(--text-slate-500)', lineHeight: 1.5 }}>
          Describe what you need and we'll get someone on it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem' }}>What do you need?</span>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: '0.9375rem',
              }}
            />
          </label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', background: 'var(--bg-slate-tint)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span>Reference Job or Bid</span>
              {serviceTypes.length === 1 ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Filtering by: {serviceTypes[0]!.name}</span>
              ) : serviceTypes.length > 1 ? (
                <BidServiceTypeSearchToggles
                  serviceTypes={serviceTypes}
                  enabledBidServiceTypeIds={enabledBidServiceTypeIds}
                  disabled={sending}
                  onEnabledChange={setEnabledBidServiceTypeIds}
                  onAfterToggle={() => setUnifiedSearchResults([])}
                />
              ) : null}
            </div>
            <input
              type="text"
              value={unifiedSearchText}
              onChange={(e) => {
                setUnifiedSearchText(e.target.value)
                setSelectedReference(null)
              }}
              placeholder="Search by HCP #, bid #, project name, or address"
              disabled={sending}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            {selectedReference && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'var(--bg-muted)',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {(() => {
                    const t = serviceTypeTagForUnifiedRow(selectedReference)
                    return t ? (
                      <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                        [{t.tag}]
                      </span>
                    ) : null
                  })()}
                  {formatUnifiedResult(selectedReference, prefixMap)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReference(null)
                    setUnifiedSearchResults([])
                  }}
                  disabled={sending}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    cursor: sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            {referenceNoHits ? (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No matches.</p>
            ) : null}
            {unifiedSearchResults.length > 0 && (
              <div
                style={{
                  maxHeight: 160,
                  overflow: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginTop: '0.25rem',
                }}
              >
                {unifiedSearchResults.map((r) => (
                  <button
                    key={`${r.source}-${r.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedReference(r)
                      setUnifiedSearchResults([])
                      setUnifiedSearchText('')
                    }}
                    disabled={sending}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      border: 'none',
                      background:
                        selectedReference &&
                        selectedReference.source === r.source &&
                        selectedReference.id === r.id
                          ? 'var(--bg-blue-tint)'
                          : 'var(--surface)',
                      cursor: sending ? 'not-allowed' : 'pointer',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {(() => {
                      const t = serviceTypeTagForUnifiedRow(r)
                      return t ? (
                        <span style={{ marginRight: '0.35rem', padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {formatUnifiedResult(r, prefixMap)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <div
              style={{
                flex: '1 1 160px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start',
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    if (!('geolocation' in navigator)) {
                      showToast("Location isn't available on this device.", 'warning')
                      return
                    }
                    setLocationLoading(true)
                    try {
                      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                          enableHighAccuracy: false,
                          timeout: 8000,
                          maximumAge: 60000,
                        })
                      })
                      setLocationLat(pos.coords.latitude)
                      setLocationLng(pos.coords.longitude)
                      showToast('Location added!', 'success')
                    } catch (err) {
                      const geo = err && typeof err === 'object' && 'code' in err ? (err as { code: number }) : null
                      const msg =
                        geo?.code === 1
                          ? 'Location access was denied. Enable it in your browser to share your spot.'
                          : geo?.code === 3
                            ? 'Location took too long. Try again or add an address.'
                            : "We couldn't find your location. Check browser settings and try again."
                      showToast(msg, 'warning')
                    } finally {
                      setLocationLoading(false)
                    }
                  }}
                  disabled={sending || locationLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-blue-tint)',
                    border: '1px solid var(--border-blue)',
                    borderRadius: 9999,
                    cursor: sending || locationLoading ? 'not-allowed' : 'pointer',
                    color: 'var(--text-blue-700)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  <MapPin size={14} aria-hidden />
                  {locationLoading ? 'Finding your spot…' : 'Attach this location'}
                </button>
                {locationLat != null && locationLng != null && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      background: 'var(--bg-green-100)',
                      borderRadius: 4,
                      fontSize: '0.8125rem',
                      color: 'var(--text-green-800)',
                    }}
                  >
                    <Check size={12} aria-hidden />
                    Location shared
                    <button
                      type="button"
                      onClick={() => {
                        setLocationLat(null)
                        setLocationLng(null)
                      }}
                      disabled={sending}
                      style={{
                        padding: 0,
                        background: 'none',
                        border: 'none',
                        cursor: sending ? 'not-allowed' : 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '1rem',
                        lineHeight: 1,
                      }}
                      aria-label="Remove location"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'left' }}>
                Helps the crew find you faster
              </span>
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 0, display: 'block' }}>
              <span
                id="dispatch-modal-links-label"
                style={{ display: 'block', marginBottom: '0.25rem', textAlign: 'center' }}
              >
                Links
              </span>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setLinks((prev) => [...prev, ''])}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    background: 'var(--bg-blue-tint)',
                    border: '1px solid var(--border-blue)',
                    borderRadius: 9999,
                    cursor: 'pointer',
                    color: 'var(--text-blue-700)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  [+ add]
                </button>
              </div>
            </div>
          </div>
          {links.length > 0 ? (
              <div
                role="group"
                aria-labelledby="dispatch-modal-links-label"
                style={{ width: '100%', minWidth: 0 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {links.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const input = titleInputRef.current
                          if (input) {
                            const start = input.selectionStart ?? title.length
                            const end = input.selectionEnd ?? title.length
                            const placeholder = `[${i + 1}]`
                            const newTitle = title.slice(0, start) + placeholder + title.slice(end)
                            setTitle(newTitle)
                            setTimeout(() => {
                              input.focus()
                              const pos = start + placeholder.length
                              input.setSelectionRange(pos, pos)
                            }, 0)
                          }
                        }}
                        style={{
                          flexShrink: 0,
                          padding: '0.25rem 0.5rem',
                          background: 'var(--bg-muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        [{i + 1}]
                      </button>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) =>
                          setLinks((prev) => prev.map((u, j) => (j === i ? e.target.value : u)))
                        }
                        placeholder="URL"
                        style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8 }}
                      />
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontSize: '1.25rem',
                          lineHeight: 1,
                        }}
                        title="Remove link"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center' }}>
                  Use [1], [2] in the title for link placeholders.
                </p>
              </div>
            ) : null}
            </div>
          </div>
          {formError && <p style={{ color: 'var(--text-red-700)', margin: 0, fontSize: '0.875rem' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !title.trim()}
              style={{
                padding: '0.6rem 1.25rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: sending ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {sending ? 'Sending…' : 'Send to Dispatch'}
            </button>
            <button
              type="button"
              onClick={() => !sending && modal.closeDispatchModal()}
              disabled={sending}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'var(--bg-slate-100)',
                color: 'var(--text-slate-600)',
                border: 'none',
                borderRadius: 8,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
