import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type JobForTally = { id: string; hcp_number: string; job_name: string; job_address: string }
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type TallyEntry = { id: string; fixtureName: string; partId: string; partName: string; manufacturer: string | null; quantity: number }

const TOUCH_MIN = 48

export default function JobTally() {
  const { user: authUser } = useAuth()
  const [role, setRole] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobForTally[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [fixtureName, setFixtureName] = useState('')
  const [partSearch, setPartSearch] = useState('')
  const [partResults, setPartResults] = useState<MaterialPart[]>([])
  const [partSearching, setPartSearching] = useState(false)
  const [selectedPart, setSelectedPart] = useState<MaterialPart | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [entries, setEntries] = useState<TallyEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [poCreateError, setPoCreateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authUser?.id) return
    supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
      const r = (data as { role: string } | null)?.role ?? null
      setRole(r)
    })
  }, [authUser?.id])

  useEffect(() => {
    if (role == null) return
    setJobsLoading(true)
    if (role === 'subcontractor') {
      supabase.rpc('list_jobs_for_tally').then(({ data, error: err }) => {
        setJobsLoading(false)
        if (err) {
          setError(err.message)
          return
        }
        setJobs((data ?? []) as JobForTally[])
        if ((data ?? []).length > 0 && !selectedJobId) {
          setSelectedJobId((data as JobForTally[])[0]?.id ?? null)
        }
      })
    } else {
      supabase
        .from('jobs_ledger')
        .select('id, hcp_number, job_name, job_address')
        .order('hcp_number', { ascending: false })
        .then(({ data, error: err }) => {
          setJobsLoading(false)
          if (err) {
            setError(err.message)
            return
          }
          setJobs((data ?? []) as JobForTally[])
          if ((data ?? []).length > 0 && !selectedJobId) {
            setSelectedJobId((data as JobForTally[])[0]?.id ?? null)
          }
        })
    }
  }, [role])

  const searchParts = useCallback(
    (term: string) => {
      if (!term.trim()) {
        setPartResults([])
        return
      }
      setPartSearching(true)
      const q = term.trim().toLowerCase()
      supabase
        .from('material_parts')
        .select('id, name, manufacturer, notes')
        .or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%,notes.ilike.%${q}%`)
        .limit(30)
        .order('name')
        .then(({ data, error: err }) => {
          setPartSearching(false)
          if (err) {
            setError(err.message)
            return
          }
          setPartResults((data ?? []) as MaterialPart[])
        })
    },
    []
  )

  useEffect(() => {
    const t = setTimeout(() => searchParts(partSearch), 300)
    return () => clearTimeout(t)
  }, [partSearch, searchParts])

  function addEntry() {
    if (!selectedPart || !fixtureName.trim()) return
    setSaved(false)
    setPoCreateError(null)
    const qty = Math.max(1, Math.round(quantity))
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fixtureName: fixtureName.trim(),
        partId: selectedPart.id,
        partName: selectedPart.name,
        manufacturer: selectedPart.manufacturer,
        quantity: qty,
      },
    ])
    setSelectedPart(null)
    setQuantity(1)
    setPartSearch('')
    setPartResults([])
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function adjustEntryQuantity(id: string, delta: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, quantity: Math.max(1, Math.round(e.quantity) + delta) } : e
      )
    )
  }

  async function handleSave() {
    if (!authUser?.id || !selectedJobId || entries.length === 0) return
    setSaving(true)
    setError(null)
    setPoCreateError(null)
    const rows = entries.map((e, i) => ({
      job_id: selectedJobId,
      fixture_name: e.fixtureName,
      part_id: e.partId,
      quantity: e.quantity,
      sequence_order: i,
      created_by_user_id: authUser.id,
    }))
    const { data: inserted, error: insertErr } = await supabase
      .from('jobs_tally_parts')
      .insert(rows)
      .select('id')
    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }
    const pEntries = entries.map((e) => ({ part_id: e.partId, quantity: e.quantity }))
    const { data: poResult, error: poErr } = await supabase.rpc('create_po_from_job_tally', {
      p_job_id: selectedJobId,
      p_entries: pEntries,
    })
    const poId = poResult && typeof poResult === 'object' && 'po_id' in poResult ? (poResult as { po_id: string }).po_id : null
    if (poId && inserted?.length) {
      await supabase
        .from('jobs_tally_parts')
        .update({ purchase_order_id: poId })
        .in('id', inserted.map((r) => r.id))
    }
    if (poErr || (poResult && typeof poResult === 'object' && 'error' in poResult)) {
      const msg = poErr?.message ?? (poResult as { error?: string })?.error ?? 'Unknown error'
      setPoCreateError(msg)
    }
    setSaving(false)
    setSaved(true)
    setEntries([])
    setFixtureName('')
    setSelectedPart(null)
    setQuantity(1)
    setPartSearch('')
  }

  if (role == null) {
    return <div style={{ padding: '1rem' }}>Loading…</div>
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId)

  return (
    <div style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/dashboard" style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Job Tally</h1>
      </div>

      {error && (
        <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
      )}

      {saved && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: '#059669', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
            Parts saved.
            {poCreateError ? (
              <span style={{ color: '#b91c1c', display: 'block', marginTop: '0.25rem' }}>
                Purchase order could not be created: {poCreateError}. You can create one manually in Materials.
              </span>
            ) : (
              ' Purchase order created.'
            )}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: 0 }}>
            You can tally another job or go back to Dashboard.
          </p>
        </div>
      )}

      {/* Step 1: Select job */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
          Job / HCP
        </label>
        {jobsLoading ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            No jobs assigned. Ask your supervisor to add you as a team member on a job.
          </p>
        ) : (
          <select
            value={selectedJobId ?? ''}
            onChange={(e) => setSelectedJobId(e.target.value || null)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              minHeight: TOUCH_MIN,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.hcp_number || '—'}{' · '}{j.job_name || '—'}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedJob && (
        <>
          {/* Step 2: Fixture name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
              Fixture or tie-in
            </label>
            <input
              type="text"
              value={fixtureName}
              onChange={(e) => setFixtureName(e.target.value)}
              placeholder="e.g. Kitchen sink, Water heater"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                minHeight: TOUCH_MIN,
                boxSizing: 'border-box',
                border: '1px solid #d1d5db',
                borderRadius: 8,
              }}
            />
          </div>

          {/* Step 3: Search part */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
              Search part
            </label>
            <input
              type="text"
              value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)}
              placeholder="Part name or manufacturer"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                minHeight: TOUCH_MIN,
                boxSizing: 'border-box',
                border: '1px solid #d1d5db',
                borderRadius: 8,
              }}
            />
            {partSearching && <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>Searching…</p>}
            {partResults.length > 0 && !selectedPart && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>
                {partResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPart(p)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        minHeight: TOUCH_MIN,
                      }}
                    >
                      {p.name}
                      {p.manufacturer && (
                        <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                          {' · '}{p.manufacturer}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Step 4: Quantity + Add */}
          {selectedPart && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>
                {selectedPart.name}
                {selectedPart.manufacturer && (
                  <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{' · '}{selectedPart.manufacturer}</span>
                )}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(0.01, q - 1))}
                    style={{
                      width: TOUCH_MIN,
                      height: TOUCH_MIN,
                      padding: 0,
                      fontSize: '1.25rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0.01}
                    step={0.5}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0.01, parseFloat(e.target.value) || 1))}
                    style={{
                      width: '5rem',
                      padding: '0.5rem',
                      fontSize: '1rem',
                      textAlign: 'center',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    style={{
                      width: TOUCH_MIN,
                      height: TOUCH_MIN,
                      padding: 0,
                      fontSize: '1.25rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={!fixtureName.trim()}
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: fixtureName.trim() ? 'pointer' : 'not-allowed',
                    minHeight: TOUCH_MIN,
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPart(null)}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Entries list */}
          {entries.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Parts to save</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {entries.map((e) => (
                  <li
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{e.fixtureName}</span>
                      <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{' · '}{e.partName}</span>
                      {e.manufacturer && (
                        <span style={{ color: '#9ca3af', fontSize: '0.875rem', marginLeft: '0.25rem' }}>
                          ({e.manufacturer})
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        Qty: {e.quantity}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {e.quantity > 1 && (
                        <button
                          type="button"
                          onClick={() => adjustEntryQuantity(e.id, -1)}
                          style={{
                            width: TOUCH_MIN,
                            height: TOUCH_MIN,
                            padding: 0,
                            fontSize: '1rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                          title="Decrease by 1"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => adjustEntryQuantity(e.id, 1)}
                        style={{
                          width: TOUCH_MIN,
                          height: TOUCH_MIN,
                          padding: 0,
                          fontSize: '1rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                        title="Increase by 1"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEntry(e.id)}
                        style={{
                          padding: '0.5rem',
                        minWidth: TOUCH_MIN,
                        minHeight: TOUCH_MIN,
                        fontSize: '0.875rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  marginTop: '0.75rem',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  minHeight: TOUCH_MIN,
                }}
              >
                {saving ? 'Saving…' : 'Save for review'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
