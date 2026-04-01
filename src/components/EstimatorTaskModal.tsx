import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useEstimatorTaskModal } from '../contexts/EstimatorTaskModalContext'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import { MapPin, Check } from 'lucide-react'
import {
  formatUnifiedResult,
  getBidServiceTypeTag,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'

export default function EstimatorTaskModal() {
  const modal = useEstimatorTaskModal()
  const { user: authUser } = useAuth()
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
  const [selectedBidServiceTypeId, setSelectedBidServiceTypeId] = useState<string>('')
  const [subcontractorServiceTypeIds, setSubcontractorServiceTypeIds] = useState<string[] | null>(null)
  const [referenceNoHits, setReferenceNoHits] = useState(false)
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  useEffect(() => {
    if (!modal?.isEstimatorModalOpen) return
    setTitle('')
    setLinks([])
    setLocationLat(null)
    setLocationLng(null)
    setUnifiedSearchText('')
    setUnifiedSearchResults([])
    setSelectedReference(null)
    setReferenceNoHits(false)
    setFormError(null)
    setSending(false)
    const t = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [modal?.isEstimatorModalOpen])

  useEffect(() => {
    if (!modal?.isEstimatorModalOpen) return
    const load = async () => {
      const { data: stData } = await supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true })
      const types = (stData ?? []) as Array<{ id: string; name: string }>
      if (authUser?.id) {
        const { data: meData } = await supabase
          .from('users')
          .select('role, estimator_service_type_ids, primary_service_type_ids, subcontractor_service_type_ids')
          .eq('id', authUser.id)
          .single()
        const me = meData as {
          role?: string
          estimator_service_type_ids?: string[] | null
          primary_service_type_ids?: string[] | null
          subcontractor_service_type_ids?: string[] | null
        } | null
        const estIds = me?.estimator_service_type_ids
        const primIds = me?.primary_service_type_ids
        const subIds = me?.subcontractor_service_type_ids ?? null
        if (me?.role === 'subcontractor') setSubcontractorServiceTypeIds(subIds && subIds.length > 0 ? subIds : null)
        else setSubcontractorServiceTypeIds(null)
        const filtered =
          me?.role === 'estimator' && estIds && estIds.length > 0
            ? types.filter((t) => estIds.includes(t.id))
            : me?.role === 'primary' && primIds && primIds.length > 0
              ? types.filter((t) => primIds.includes(t.id))
              : me?.role === 'subcontractor' && subIds && subIds.length > 0
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
  }, [modal?.isEstimatorModalOpen, authUser?.id])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!modal?.isEstimatorModalOpen || !unifiedSearchText.trim()) {
        setUnifiedSearchResults([])
        setReferenceNoHits(false)
        return
      }
      const q = unifiedSearchText.trim()
      setReferenceNoHits(false)
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
        setReferenceNoHits(merged.length === 0)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [modal?.isEstimatorModalOpen, unifiedSearchText, selectedBidServiceTypeId, subcontractorServiceTypeIds])

  if (!modal?.isEstimatorModalOpen) return null

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
            .from('estimator_requests')
            .insert({
              from_user_id: user.id,
              title: trimmed,
              links: linkArr.length ? linkArr : [],
              job_ledger_id: ref?.source === 'job' ? ref.id : null,
              bid_id: ref?.source === 'bid' ? ref.id : null,
              reference_summary: ref ? formatUnifiedResult(ref) : null,
              ...(locationLat != null &&
                locationLng != null && { location_lat: locationLat, location_lng: locationLng }),
            })
            .select('id')
            .single(),
        'insert estimator_request',
      )

      const id = row?.id
      if (!id) {
        setFormError('Could not create request.')
        setSending(false)
        return
      }

      const { error: fnErr } = await supabase.functions.invoke('notify-estimator-request', {
        body: { estimator_request_id: id },
      })
      if (fnErr) {
        showToast(`Sent, but notification may have failed: ${fnErr.message}`, 'warning')
      } else {
        showToast('Sent to Estimator Inbox.', 'success')
      }

      m.closeEstimatorModal()
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
      aria-labelledby="estimator-task-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => !sending && modal.closeEstimatorModal()}
    >
      <div
        style={{
          background: '#fefdfb',
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
        <h3 id="estimator-task-modal-title" style={{ marginTop: 0, marginBottom: 0 }}>
          Send to Estimator Inbox
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.5 }}>
          Describe what you need for estimating and the inbox group will see it.
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
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: '0.9375rem',
              }}
            />
          </label>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', background: '#f8fafc' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Optional — add any of:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 9999,
                    cursor: sending || locationLoading ? 'not-allowed' : 'pointer',
                    color: '#1d4ed8',
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
                      background: '#dcfce7',
                      borderRadius: 4,
                      fontSize: '0.8125rem',
                      color: '#166534',
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
                        color: '#6b7280',
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
                <span style={{ fontSize: '0.8125rem', color: '#6b7280', textAlign: 'center' }}>
                  Helps the crew find you faster
                </span>
              </div>
              <div style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span>Reference Job</span>
              {serviceTypes.length === 1 ? (
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Filtering by: {serviceTypes[0]!.name}</span>
              ) : serviceTypes.length > 1 ? (
                <select
                  value={selectedBidServiceTypeId}
                  onChange={(e) => {
                    setSelectedBidServiceTypeId(e.target.value)
                    setUnifiedSearchResults([])
                  }}
                  disabled={sending}
                  style={{
                    minWidth: 120,
                    maxWidth: 200,
                    padding: '0.35rem 0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Types ({serviceTypes.map((st) => st.name).join(', ')})</option>
                  {serviceTypes.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
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
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
            {selectedReference && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#f3f4f6',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {selectedReference.source === 'bid' && (() => {
                    const t = getBidServiceTypeTag(selectedReference.service_type_name)
                    return t ? (
                      <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                        [{t.tag}]
                      </span>
                    ) : null
                  })()}
                  {formatUnifiedResult(selectedReference)}
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
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: 'white',
                    cursor: sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            {referenceNoHits ? (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>No matches.</p>
            ) : null}
            {unifiedSearchResults.length > 0 && (
              <div
                style={{
                  maxHeight: 160,
                  overflow: 'auto',
                  border: '1px solid #e2e8f0',
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
                          ? '#eff6ff'
                          : 'white',
                      cursor: sending ? 'not-allowed' : 'pointer',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '0.875rem',
                    }}
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
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem', textAlign: 'center' }}>Links</span>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, ''])}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 9999,
                  cursor: 'pointer',
                  color: '#1d4ed8',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                [+ add]
              </button>
            </div>
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
                      background: '#f3f4f6',
                      border: '1px solid #e2e8f0',
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
                    style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      padding: '0.25rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280',
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
            {links.length > 0 && (
              <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.8125rem' }}>
                Use [1], [2] in the title for link placeholders.
              </p>
            )}
          </label>
            </div>
          </div>
          {formError && <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.875rem' }}>{formError}</p>}
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
              {sending ? 'Sending…' : 'Send to Estimator Inbox'}
            </button>
            <button
              type="button"
              onClick={() => !sending && modal.closeEstimatorModal()}
              disabled={sending}
              style={{
                padding: '0.6rem 1.25rem',
                background: '#f1f5f9',
                color: '#475569',
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
