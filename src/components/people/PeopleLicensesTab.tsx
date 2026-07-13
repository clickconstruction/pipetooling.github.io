import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

type PersonLicenseCostLine = { id: string; person_license_id: string; amount: number; note: string | null; date: string; created_at: string | null }
type PersonLicense = {
  id: string
  person_name: string
  license_type: string
  note: string | null
  date_of_expiry: string
  created_at: string | null
  expiry_dispatch_notified_at?: string | null
  person_license_cost_lines?: PersonLicenseCostLine[]
}

function costLinesTotal(lines: PersonLicenseCostLine[] | undefined): number {
  return (lines ?? []).reduce((s, l) => s + l.amount, 0)
}

type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }

export type PeopleLicensesTabProps = {
  people: Person[]
  users: UserRow[]
}

export default function PeopleLicensesTab({ people, users }: PeopleLicensesTabProps) {
  const { showToast } = useToastContext()
  const [licenses, setLicenses] = useState<PersonLicense[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)
  const [licensesError, setLicensesError] = useState<string | null>(null)
  const [licensesExpiringSoon, setLicensesExpiringSoon] = useState<PersonLicense[]>([])
  const [selectedLicensePersonName, setSelectedLicensePersonName] = useState<string | null>(null)
  const [licenseFormOpen, setLicenseFormOpen] = useState(false)
  const [editingLicense, setEditingLicense] = useState<PersonLicense | null>(null)
  const [licensePersonName, setLicensePersonName] = useState('')
  const [licenseType, setLicenseType] = useState('')
  const [licenseNote, setLicenseNote] = useState('')
  const [licenseDateOfExpiry, setLicenseDateOfExpiry] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [costLineFormOpen, setCostLineFormOpen] = useState(false)
  const [editingCostLine, setEditingCostLine] = useState<PersonLicenseCostLine | null>(null)
  const [costLineLicenseId, setCostLineLicenseId] = useState<string | null>(null)
  const [costLineAmount, setCostLineAmount] = useState('')
  const [costLineNote, setCostLineNote] = useState('')
  const [costLineDate, setCostLineDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [expandedCostLinesLicenseId, setExpandedCostLinesLicenseId] = useState<string | null>(null)

  async function loadLicenses() {
    setLicensesLoading(true)
    setLicensesError(null)
    const { data, error } = await supabase.from('person_licenses').select('*, person_license_cost_lines(id, amount, note, date)').order('date_of_expiry', { ascending: true })
    setLicensesLoading(false)
    if (error) setLicensesError(error.message)
    else {
      const list = (data ?? []) as PersonLicense[]
      setLicenses(list)
      const today = new Date().toLocaleDateString('en-CA')
      const in30 = new Date()
      in30.setDate(in30.getDate() + 30)
      const todayPlus30 = in30.toLocaleDateString('en-CA')
      setLicensesExpiringSoon(list.filter((l) => l.date_of_expiry >= today && l.date_of_expiry <= todayPlus30))
    }
  }

  function openLicenseForm(personName?: string, license?: PersonLicense) {
    setEditingLicense(license ?? null)
    setLicensePersonName(personName ?? license?.person_name ?? '')
    setLicenseType(license?.license_type ?? '')
    setLicenseNote(license?.note ?? '')
    setLicenseDateOfExpiry(license?.date_of_expiry ?? new Date().toLocaleDateString('en-CA'))
    setLicenseFormOpen(true)
  }

  function closeLicenseForm() {
    setLicenseFormOpen(false)
    setEditingLicense(null)
    setLicensePersonName('')
    setLicenseType('')
    setLicenseNote('')
    setLicenseDateOfExpiry(new Date().toLocaleDateString('en-CA'))
  }

  function openCostLineForm(licenseId: string, line?: PersonLicenseCostLine) {
    setCostLineLicenseId(licenseId)
    setEditingCostLine(line ?? null)
    setCostLineAmount(line ? String(line.amount) : '')
    setCostLineNote(line?.note ?? '')
    setCostLineDate(line?.date ?? new Date().toLocaleDateString('en-CA'))
    setCostLineFormOpen(true)
  }

  function closeCostLineForm() {
    setCostLineFormOpen(false)
    setEditingCostLine(null)
    setCostLineLicenseId(null)
    setCostLineAmount('')
    setCostLineNote('')
    setCostLineDate(new Date().toLocaleDateString('en-CA'))
  }

  async function addCostLine(licenseId: string, amount: number, note: string, date: string) {
    const { error: err } = await supabase.from('person_license_cost_lines').insert({ person_license_id: licenseId, amount, note: note.trim() || null, date })
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      closeCostLineForm()
      loadLicenses()
    }
  }

  async function updateCostLine(line: PersonLicenseCostLine, amount: number, note: string, date: string) {
    const { error: err } = await supabase.from('person_license_cost_lines').update({ amount, note: note.trim() || null, date }).eq('id', line.id)
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      closeCostLineForm()
      loadLicenses()
    }
  }

  async function deleteCostLine(line: PersonLicenseCostLine) {
    if (!window.confirm(`Delete cost line $${line.amount}?`)) return
    const { error: err } = await supabase.from('person_license_cost_lines').delete().eq('id', line.id)
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      loadLicenses()
    }
  }

  async function maybeNotifyDispatchLicenseExpiry(licenseId: string) {
    const pLink = `${window.location.origin}/people?tab=licenses`
    try {
      const dispatchId = await withSupabaseRetry(
        async () =>
          supabase.rpc('notify_dispatch_license_expiry_if_needed', {
            p_license_id: licenseId,
            p_link: pLink,
          }),
        'notify_dispatch_license_expiry_if_needed',
      )
      if (dispatchId == null || typeof dispatchId !== 'string') return
      const { error: fnErr } = await supabase.functions.invoke('notify-dispatch-request', {
        body: { dispatch_request_id: dispatchId },
      })
      if (fnErr) {
        showToast(`License saved; Dispatch notification may have failed: ${fnErr.message}`, 'warning')
      }
    } catch (e) {
      console.warn('maybeNotifyDispatchLicenseExpiry', e)
    }
  }

  async function upsertLicense() {
    if (!licensePersonName.trim()) {
      setLicensesError('Select a person')
      return
    }
    if (!licenseType.trim()) {
      setLicensesError('License type is required')
      return
    }
    if (!licenseDateOfExpiry) {
      setLicensesError('Date of expiry is required')
      return
    }
    if (editingLicense) {
      const { error: err } = await supabase
        .from('person_licenses')
        .update({ person_name: licensePersonName.trim(), license_type: licenseType.trim(), note: licenseNote.trim() || null, date_of_expiry: licenseDateOfExpiry })
        .eq('id', editingLicense.id)
      if (err) setLicensesError(err.message)
      else {
        setLicensesError(null)
        closeLicenseForm()
        loadLicenses()
        void maybeNotifyDispatchLicenseExpiry(editingLicense.id)
      }
    } else {
      const { data: inserted, error: err } = await supabase
        .from('person_licenses')
        .insert({ person_name: licensePersonName.trim(), license_type: licenseType.trim(), note: licenseNote.trim() || null, date_of_expiry: licenseDateOfExpiry })
        .select('id')
        .single()
      if (err) setLicensesError(err.message)
      else {
        setLicensesError(null)
        closeLicenseForm()
        loadLicenses()
        if (inserted?.id) void maybeNotifyDispatchLicenseExpiry(inserted.id)
      }
    }
  }

  async function deleteLicense(l: PersonLicense) {
    if (!window.confirm(`Delete ${l.license_type} for ${l.person_name}?`)) return
    const { error: err } = await supabase.from('person_licenses').delete().eq('id', l.id)
    if (err) setLicensesError(err.message)
    else {
      setLicensesError(null)
      loadLicenses()
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      loadLicenses()
    }, 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <div>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Licenses</h2>
        {licensesError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{licensesError}</p>}
        {licensesLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            <section style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-amber-tint)', borderRadius: 6, border: '1px solid #fde68a' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Licenses expiring in the next 30 days</h3>
              {licensesExpiringSoon.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No licenses expiring in the next 30 days.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>License and #</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date of Expiry</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Cost to Company</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Days left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licensesExpiringSoon.map((l) => {
                        const today = new Date()
                        const expiry = new Date(l.date_of_expiry + 'T12:00:00')
                        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem' }}>{l.person_name}</td>
                            <td style={{ padding: '0.5rem' }}>{l.license_type}</td>
                            <td style={{ padding: '0.5rem' }}>{l.date_of_expiry}</td>
                            <td style={{ padding: '0.5rem' }}>{costLinesTotal(l.person_license_cost_lines) > 0 ? `$${costLinesTotal(l.person_license_cost_lines).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{daysLeft}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', width: 1 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const personNames = [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])].filter((n): n is string => Boolean(n)).sort((a, b) => a.localeCompare(b))
                    if (personNames.length === 0) {
                      return (
                        <tr>
                          <td colSpan={2} style={{ padding: '1rem', color: 'var(--text-muted)' }}>No people in roster. Add people in Users tab first.</td>
                        </tr>
                      )
                    }
                    return personNames.map((personName) => {
                      const personLicenses = licenses.filter((l) => l.person_name === personName)
                      const isExpanded = selectedLicensePersonName === personName
                      return (
                        <Fragment key={personName}>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border)',
                              cursor: 'pointer',
                              background: isExpanded ? 'var(--bg-sky-tint)' : undefined,
                            }}
                            onClick={() => setSelectedLicensePersonName((prev) => (prev === personName ? null : personName))}
                          >
                            <td style={{ padding: '0.75rem' }}>
                              {personName}
                              {personLicenses.length > 0 && (
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                  {personLicenses.map((l) => l.license_type).join(', ')}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', width: 1 }}>
                              {isExpanded && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openLicenseForm(personName)
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  + Add license
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={2} style={{ padding: '1rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  <div>
                                    {personLicenses.length === 0 ? (
                                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No licenses.</p>
                                    ) : (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>License and #</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Note</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date of Expiry</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Cost to Company</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {personLicenses.map((l) => {
                                            const costLines = l.person_license_cost_lines ?? []
                                            return (
                                              <Fragment key={l.id}>
                                                <tr style={{ borderTop: '1px solid var(--border)' }}>
                                                  <td style={{ padding: '0.5rem' }}>{l.license_type}</td>
                                                  <td style={{ padding: '0.5rem' }}>{l.note || '—'}</td>
                                                  <td style={{ padding: '0.5rem' }}>{l.date_of_expiry}</td>
                                                  <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {(costLines.length > 0 || costLinesTotal(costLines) > 0) ? (
                                                          <div
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-expanded={expandedCostLinesLicenseId === l.id}
                                                            onClick={(e) => { e.stopPropagation(); setExpandedCostLinesLicenseId((prev) => (prev === l.id ? null : l.id)) }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setExpandedCostLinesLicenseId((prev) => (prev === l.id ? null : l.id)) } }}
                                                            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                          >
                                                            <span style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{expandedCostLinesLicenseId === l.id ? '▾' : '▸'}</span>
                                                            {costLinesTotal(costLines) > 0 ? `$${costLinesTotal(costLines).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                                            {costLines.length > 1 && (
                                                              <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>({costLines.length} lines)</span>
                                                            )}
                                                          </div>
                                                        ) : null}
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); openCostLineForm(l.id) }} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Add Cost</button>
                                                      </div>
                                                      {expandedCostLinesLicenseId === l.id && costLines.length > 0 && (
                                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 4, borderLeft: '3px solid var(--border)' }}>
                                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                            <tbody>
                                                              {costLines.map((cl) => (
                                                                <tr key={cl.id}>
                                                                  <td style={{ padding: '0.2rem 0.35rem 0 0' }}>${Number(cl.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                                  <td style={{ padding: '0.2rem 0.35rem 0 0' }}>{cl.note || '—'}</td>
                                                                  <td style={{ padding: '0.2rem 0.35rem 0 0' }}>{cl.date}</td>
                                                                  <td style={{ padding: '0.2rem 0' }}>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); openCostLineForm(l.id, cl) }} style={{ marginRight: '0.2rem', padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}>Edit</button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteCostLine(cl) }} style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem', color: 'var(--text-red-700)' }}>Delete</button>
                                                                  </td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td style={{ padding: '0.5rem' }}>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        openLicenseForm(undefined, l)
                                                      }}
                                                      style={{ marginRight: '0.35rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                    >
                                                      Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteLicense(l)
                                                      }}
                                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', color: 'var(--text-red-700)' }}
                                                    >
                                                      Delete
                                                    </button>
                                                  </td>
                                                </tr>
                                              </Fragment>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {licenseFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingLicense ? 'Edit license' : 'Add license'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Person *</label>
              <select value={licensePersonName} onChange={(e) => setLicensePersonName(e.target.value)} disabled={!!editingLicense} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {[...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])].filter(Boolean).sort((a, b) => (a ?? '').localeCompare(b ?? '')).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>License and # *</label>
              <input type="text" value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="e.g. Master Plumber" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <input type="text" value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date of Expiry *</label>
              <input type="date" value={licenseDateOfExpiry} onChange={(e) => setLicenseDateOfExpiry(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertLicense} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeLicenseForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {costLineFormOpen && costLineLicenseId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingCostLine ? 'Edit cost line' : 'Add cost line'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Amount ($) *</label>
              <input type="number" min={0} step={0.01} value={costLineAmount} onChange={(e) => setCostLineAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <input type="text" value={costLineNote} onChange={(e) => setCostLineNote(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date *</label>
              <input type="date" value={costLineDate} onChange={(e) => setCostLineDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const amt = parseFloat(costLineAmount)
                  if (isNaN(amt) || amt < 0) {
                    setLicensesError('Enter a valid amount')
                    return
                  }
                  if (!costLineDate) {
                    setLicensesError('Date is required')
                    return
                  }
                  if (editingCostLine) {
                    updateCostLine(editingCostLine, amt, costLineNote, costLineDate)
                  } else {
                    addCostLine(costLineLicenseId, amt, costLineNote, costLineDate)
                  }
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                Save
              </button>
              <button type="button" onClick={closeCostLineForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
