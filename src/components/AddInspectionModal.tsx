import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'

type JobSearchResult = { id: string; source: 'job_ledger' | 'project'; display_name: string; hcp_number: string; address?: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  authUserId: string | null
}

export default function AddInspectionModal({ open, onClose, onSaved, authUserId }: Props) {
  const { showToast } = useToastContext()
  const [jobSearchText, setJobSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<JobSearchResult[]>([])
  const [selectedJob, setSelectedJob] = useState<JobSearchResult | null>(null)
  const [lastInspectionJob, setLastInspectionJob] = useState<JobSearchResult | null>(null)
  const [address, setAddress] = useState('')
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([])
  const [inspectionType, setInspectionType] = useState<string>('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'search' | 'last'>('search')

  useEffect(() => {
    if (!open) return
    supabase.from('inspection_types').select('name').order('sequence_order').then(({ data }) => {
      const names = (data as Array<{ name: string }> | null)?.map((r) => r.name) ?? []
      setInspectionTypes(names)
      setInspectionType((prev) => (names.includes(prev) ? prev : names[0] ?? ''))
    })
  }, [open])

  useEffect(() => {
    if (!open || !authUserId) return
    supabase
      .from('inspections')
      .select('id, job_ledger_id, project_id, created_at')
      .eq('created_by_user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        const r = data as { job_ledger_id?: string; project_id?: string } | null
        if (!r) {
          setLastInspectionJob(null)
          return
        }
        const source = r.job_ledger_id ? 'job_ledger' : 'project'
        const id = r.job_ledger_id ?? r.project_id
        if (!id) return
        const { data: row } = await supabase.rpc('get_job_display_for_report', { p_source: source, p_id: id })
        const first = (row as JobSearchResult[] | null)?.[0]
        if (first) setLastInspectionJob(first)
      })
  }, [open, authUserId])

  useEffect(() => {
    if (!open || searchMode !== 'search') return
    const q = jobSearchText.trim()
    supabase.rpc('search_jobs_for_reports', { search_text: q }).then(async ({ data }) => {
      let raw = (data as JobSearchResult[] | null) ?? []
      if (raw.length > 0) {
        const jobIds = raw.filter((r) => r.source === 'job_ledger').map((r) => r.id)
        const jobAddrMap: Record<string, string> = {}
        if (jobIds.length > 0) {
          const { data: jobRows } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
          for (const r of (jobRows ?? []) as { id: string; job_address?: string }[]) {
            jobAddrMap[r.id] = r.job_address ?? ''
          }
        }
        raw = raw.map((r) => ({
          ...r,
          address: (r.address && r.address.trim()) || (r.source === 'job_ledger' ? jobAddrMap[r.id] : r.address ?? '') || '',
        }))
      }
      setSearchResults(raw)
    })
  }, [open, jobSearchText, searchMode])

  useEffect(() => {
    if (!open || !selectedJob) return
    const fetchAddress = async () => {
      if (selectedJob.source === 'job_ledger') {
        const { data } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [selectedJob.id] })
        const row = (data as { job_address?: string }[] | null)?.[0]
        setAddress(row?.job_address ?? '')
      } else {
        const { data } = await supabase.rpc('get_projects_by_ids', { p_ids: [selectedJob.id] })
        const row = (data as { address?: string }[] | null)?.[0]
        setAddress(row?.address ?? '')
      }
    }
    fetchAddress()
  }, [open, selectedJob])

  function reset() {
    setSelectedJob(null)
    setJobSearchText('')
    setSearchResults([])
    setAddress('')
    setInspectionType(inspectionTypes[0] ?? '')
    setScheduledDate('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId || !selectedJob || !address.trim() || !inspectionType || !scheduledDate) return
    setSaving(true)
    setError(null)
    const jobLedgerId = selectedJob.source === 'job_ledger' ? selectedJob.id : null
    const projectId = selectedJob.source === 'project' ? selectedJob.id : null

    const { data: row, error: insertErr } = await supabase
      .from('inspections')
      .insert({
        address: address.trim(),
        inspection_type: inspectionType,
        scheduled_date: scheduledDate,
        created_by_user_id: authUserId,
        job_ledger_id: jobLedgerId,
        project_id: projectId,
      })
      .select('id')
      .single()

    setSaving(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    if (row) {
      showToast('Inspection added', 'success')
    }
    onSaved()
    handleClose()
  }

  if (!open) return null

  const canSubmit = selectedJob && address.trim() && inspectionType && scheduledDate && authUserId

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Add inspection</h2>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>Select job</p>
              {lastInspectionJob && (
                <button
                  type="button"
                  onClick={() => {
                    if (searchMode === 'last') {
                      setSelectedJob(null)
                      setSearchMode('search')
                    } else {
                      setSearchMode('last')
                      setSelectedJob(lastInspectionJob)
                      setSearchResults([])
                      setJobSearchText('')
                    }
                  }}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: searchMode === 'last' ? '2px solid #3b82f6' : '1px solid #d1d5db', background: searchMode === 'last' ? '#eff6ff' : 'white', borderRadius: 4, cursor: 'pointer' }}
                >
                  Same job as last inspection
                </button>
              )}
            </div>
            {selectedJob && (
              <p style={{ margin: 0, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4 }}>Selected: {selectedJob.display_name} (HCP: {selectedJob.hcp_number || '—'}){selectedJob.address ? `  -  ${selectedJob.address}` : ''}</p>
            )}
            <input
              type="text"
              value={jobSearchText}
              onChange={(e) => { setJobSearchText(e.target.value); setSearchMode('search'); setSelectedJob(null) }}
              placeholder="Search by HCP #, project name, or address"
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            {searchMode === 'search' && searchResults.length > 0 && (
              <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                {searchResults.map((r) => (
                  <button
                    key={`${r.source}-${r.id}`}
                    type="button"
                    onClick={() => { setSelectedJob(r); setSearchResults([]) }}
                    style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedJob?.id === r.id ? '#eff6ff' : 'white', cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}
                  >
                    {r.display_name} {r.hcp_number ? `(HCP: ${r.hcp_number})` : ''}{r.address ? `  -  ${r.address}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Inspection address"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Inspection type</label>
            <select
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              disabled={inspectionTypes.length === 0}
            >
              {inspectionTypes.length === 0 ? (
                <option value="">No inspection types—add some first</option>
              ) : (
                inspectionTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))
              )}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date to set it up</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>

          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!canSubmit || saving} style={{ padding: '0.5rem 1rem', background: canSubmit && !saving ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving…' : 'Add inspection'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
