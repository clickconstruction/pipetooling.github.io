import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useDispatchTaskModal } from '../contexts/DispatchTaskModalContext'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  formatUnifiedResult,
  getBidServiceTypeTag,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'

export default function DispatchTaskModal() {
  const modal = useDispatchTaskModal()
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

  useEffect(() => {
    if (!modal?.isDispatchModalOpen) return
    setTitle('')
    setLinks([])
    setUnifiedSearchText('')
    setUnifiedSearchResults([])
    setSelectedReference(null)
    setReferenceNoHits(false)
    setFormError(null)
    setSending(false)
    const t = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [modal?.isDispatchModalOpen])

  useEffect(() => {
    if (!modal?.isDispatchModalOpen) return
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
  }, [modal?.isDispatchModalOpen, unifiedSearchText, selectedBidServiceTypeId, subcontractorServiceTypeIds])

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
              reference_summary: ref ? formatUnifiedResult(ref) : null,
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
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dispatch-task-modal-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Message the Dispatch team
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem' }}>Task</span>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>
          <div style={{ marginBottom: 0 }}>
            <span style={{ display: 'block', marginBottom: '0.25rem' }}>Reference (optional)</span>
            {serviceTypes.length === 1 ? (
              <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Filtering by: {serviceTypes[0]!.name}
              </p>
            ) : serviceTypes.length > 1 ? (
              <select
                value={selectedBidServiceTypeId}
                onChange={(e) => {
                  setSelectedBidServiceTypeId(e.target.value)
                  setUnifiedSearchResults([])
                }}
                disabled={sending}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                }}
              >
                <option value="">All types</option>
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            ) : null}
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
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    background: 'white',
                    cursor: sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            <input
              type="text"
              value={unifiedSearchText}
              onChange={(e) => {
                setUnifiedSearchText(e.target.value)
                setSelectedReference(null)
              }}
              placeholder="Search by HCP #, bid #, project name, or address"
              disabled={sending}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            {referenceNoHits ? (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>No matches.</p>
            ) : null}
            {unifiedSearchResults.length > 0 && (
              <div
                style={{
                  maxHeight: 160,
                  overflow: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
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
            <span style={{ display: 'block', marginBottom: '0.25rem' }}>Links (optional)</span>
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
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
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
                    style={{ flex: 1, padding: '0.5rem' }}
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
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, ''])}
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.25rem 0.5rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563eb',
                  textDecoration: 'underline',
                  fontSize: '0.875rem',
                }}
              >
                [+ add]
              </button>
            </div>
            <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.8125rem' }}>
              Use [1], [2] in the title for link placeholders.
            </p>
          </label>
          {formError && <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.875rem' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !title.trim()}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: sending ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => !sending && modal.closeDispatchModal()}
              disabled={sending}
              style={{
                padding: '0.5rem 1rem',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: 4,
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
