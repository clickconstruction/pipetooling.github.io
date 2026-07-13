import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'

type Vehicle = { id: string; year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number; created_at: string | null; updated_at: string | null }
type VehicleOdometerEntry = { id: string; vehicle_id: string; odometer_value: number; read_date: string; created_at: string | null }
type VehicleReplacementValueEntry = { id: string; vehicle_id: string; replacement_value: number; read_date: string; created_at: string | null }
type VehiclePossession = { id: string; vehicle_id: string; user_id: string; start_date: string; end_date: string | null; created_at: string | null }

type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }

export type PeopleVehiclesTabProps = {
  users: UserRow[]
}

export default function PeopleVehiclesTab({ users }: PeopleVehiclesTabProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [odometerEntries, setOdometerEntries] = useState<VehicleOdometerEntry[]>([])
  const [replacementValueEntries, setReplacementValueEntries] = useState<VehicleReplacementValueEntry[]>([])
  const [possessions, setPossessions] = useState<VehiclePossession[]>([])
  const [vehicleAssignees, setVehicleAssignees] = useState<Record<string, string>>({})
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleVin, setVehicleVin] = useState('')
  const [vehicleInsCost, setVehicleInsCost] = useState('')
  const [vehicleRegCost, setVehicleRegCost] = useState('')
  const [odometerFormOpen, setOdometerFormOpen] = useState(false)
  const [odometerDate, setOdometerDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [odometerValue, setOdometerValue] = useState('')
  const [replacementValueFormOpen, setReplacementValueFormOpen] = useState(false)
  const [replacementValueDate, setReplacementValueDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [replacementValueValue, setReplacementValueValue] = useState('')
  const [possessionFormOpen, setPossessionFormOpen] = useState(false)
  const [possessionUserId, setPossessionUserId] = useState('')
  const [possessionStartDate, setPossessionStartDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [possessionEndDate, setPossessionEndDate] = useState('')

  async function loadVehicles() {
    setVehiclesLoading(true)
    setVehiclesError(null)
    const today = new Date().toLocaleDateString('en-CA')
    const { data: vehiclesData, error: vehiclesErr } = await supabase.from('vehicles').select('*').order('year', { ascending: false })
    setVehiclesLoading(false)
    if (vehiclesErr) {
      setVehiclesError(vehiclesErr.message)
      return
    }
    setVehicles((vehiclesData ?? []) as Vehicle[])
    const ids = (vehiclesData ?? []).map((v: { id: string }) => v.id)
    if (ids.length === 0) {
      setVehicleAssignees({})
      return
    }
    const { data: possData } = await supabase
      .from('vehicle_possessions')
      .select('vehicle_id, user_id')
      .in('vehicle_id', ids)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    const possByVehicle: Record<string, string[]> = {}
    for (const p of (possData ?? []) as { vehicle_id: string; user_id: string }[]) {
      const arr = possByVehicle[p.vehicle_id] ??= []
      arr.push(p.user_id)
    }
    const userIds = [...new Set((possData ?? []).map((p: { user_id: string }) => p.user_id))]
    const { data: usersData } = userIds.length > 0
      ? await supabase.from('users').select('id, name').is('archived_at', null).in('id', userIds)
      : { data: [] }
    const userNames: Record<string, string> = {}
    for (const u of (usersData ?? []) as { id: string; name: string }[]) {
      userNames[u.id] = u.name ?? ''
    }
    const assignees: Record<string, string> = {}
    for (const [vid, uids] of Object.entries(possByVehicle)) {
      assignees[vid] = uids.map((uid) => userNames[uid] || uid.slice(0, 8)).join(', ')
    }
    setVehicleAssignees(assignees)
  }

  async function loadOdometerEntries(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_odometer_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('read_date', { ascending: false })
    if (error) return
    setOdometerEntries((data ?? []) as VehicleOdometerEntry[])
  }

  async function loadReplacementValueEntries(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_replacement_value_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('read_date', { ascending: false })
    if (error) return
    setReplacementValueEntries((data ?? []) as VehicleReplacementValueEntry[])
  }

  async function loadPossessions(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_possessions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('start_date', { ascending: false })
    if (error) return
    setPossessions((data ?? []) as VehiclePossession[])
  }

  function openVehicleForm(v?: Vehicle) {
    setEditingVehicle(v ?? null)
    setVehicleYear(v?.year?.toString() ?? '')
    setVehicleMake(v?.make ?? '')
    setVehicleModel(v?.model ?? '')
    setVehicleVin(v?.vin ?? '')
    setVehicleInsCost(v?.weekly_insurance_cost?.toString() ?? '')
    setVehicleRegCost(v?.weekly_registration_cost?.toString() ?? '')
    setVehicleFormOpen(true)
  }

  function closeVehicleForm() {
    setVehicleFormOpen(false)
    setEditingVehicle(null)
    setVehicleYear('')
    setVehicleMake('')
    setVehicleModel('')
    setVehicleVin('')
    setVehicleInsCost('')
    setVehicleRegCost('')
  }

  async function upsertVehicle() {
    const year = parseInt(vehicleYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      setVehiclesError('Year must be 1900–2100')
      return
    }
    const ins = parseFloat(vehicleInsCost) || 0
    const reg = parseFloat(vehicleRegCost) || 0
    if (editingVehicle) {
      const { error: err } = await supabase.from('vehicles').update({ year, make: vehicleMake.trim(), model: vehicleModel.trim(), vin: vehicleVin.trim() || null, weekly_insurance_cost: ins, weekly_registration_cost: reg, updated_at: new Date().toISOString() }).eq('id', editingVehicle.id)
      if (err) setVehiclesError(err.message)
      else {
        closeVehicleForm()
        loadVehicles()
      }
    } else {
      const { error: err } = await supabase.from('vehicles').insert({ year, make: vehicleMake.trim(), model: vehicleModel.trim(), vin: vehicleVin.trim() || null, weekly_insurance_cost: ins, weekly_registration_cost: reg })
      if (err) setVehiclesError(err.message)
      else {
        closeVehicleForm()
        loadVehicles()
      }
    }
  }

  async function deleteVehicle(v: Vehicle) {
    if (!window.confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) return
    const { error: err } = await supabase.from('vehicles').delete().eq('id', v.id)
    if (err) setVehiclesError(err.message)
    else {
      setSelectedVehicleId((prev) => (prev === v.id ? null : prev))
      loadVehicles()
    }
  }

  async function insertOdometerEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(odometerValue)
    if (isNaN(val) || val < 0) {
      setVehiclesError('Odometer value must be a non-negative number')
      return
    }
    const { error: err } = await supabase.from('vehicle_odometer_entries').insert({ vehicle_id: selectedVehicleId, odometer_value: val, read_date: odometerDate })
    if (err) setVehiclesError(err.message)
    else {
      setOdometerFormOpen(false)
      setOdometerDate(new Date().toLocaleDateString('en-CA'))
      setOdometerValue('')
      loadOdometerEntries(selectedVehicleId)
    }
  }

  async function deleteOdometerEntry(entry: VehicleOdometerEntry) {
    const { error: err } = await supabase.from('vehicle_odometer_entries').delete().eq('id', entry.id)
    if (err) setVehiclesError(err.message)
    else if (selectedVehicleId) loadOdometerEntries(selectedVehicleId)
  }

  async function insertReplacementValueEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(replacementValueValue)
    if (isNaN(val) || val < 0) {
      setVehiclesError('Replacement value must be a non-negative number')
      return
    }
    const { error: err } = await supabase.from('vehicle_replacement_value_entries').insert({ vehicle_id: selectedVehicleId, replacement_value: val, read_date: replacementValueDate })
    if (err) setVehiclesError(err.message)
    else {
      setReplacementValueFormOpen(false)
      setReplacementValueDate(new Date().toLocaleDateString('en-CA'))
      setReplacementValueValue('')
      loadReplacementValueEntries(selectedVehicleId)
    }
  }

  async function deleteReplacementValueEntry(entry: VehicleReplacementValueEntry) {
    const { error: err } = await supabase.from('vehicle_replacement_value_entries').delete().eq('id', entry.id)
    if (err) setVehiclesError(err.message)
    else if (selectedVehicleId) loadReplacementValueEntries(selectedVehicleId)
  }

  async function upsertPossession() {
    if (!selectedVehicleId || !possessionUserId) {
      setVehiclesError('Select a user')
      return
    }
    const { error: err } = await supabase.from('vehicle_possessions').insert({ vehicle_id: selectedVehicleId, user_id: possessionUserId, start_date: possessionStartDate, end_date: possessionEndDate.trim() || null })
    if (err) setVehiclesError(err.message)
    else {
      setPossessionFormOpen(false)
      setPossessionUserId('')
      setPossessionStartDate(new Date().toLocaleDateString('en-CA'))
      setPossessionEndDate('')
      loadPossessions(selectedVehicleId)
      loadVehicles()
    }
  }

  async function deletePossession(p: VehiclePossession) {
    const { error: err } = await supabase.from('vehicle_possessions').delete().eq('id', p.id)
    if (err) setVehiclesError(err.message)
    else {
      if (selectedVehicleId) loadPossessions(selectedVehicleId)
      loadVehicles()
    }
  }

  useEffect(() => {
    const t = setTimeout(() => loadVehicles(), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (selectedVehicleId) {
      loadOdometerEntries(selectedVehicleId)
      loadReplacementValueEntries(selectedVehicleId)
      loadPossessions(selectedVehicleId)
    } else {
      setOdometerEntries([])
      setReplacementValueEntries([])
      setPossessions([])
    }
  }, [selectedVehicleId])

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Vehicles</h2>
          <button
            type="button"
            onClick={() => openVehicleForm()}
            style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
          >
            + Add Vehicle
          </button>
        </div>
        {vehiclesError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{vehiclesError}</p>}
        {vehiclesLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Year</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Make</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Model</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>VIN</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Ins/wk</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Reg/wk</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assigned to</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <Fragment key={v.id}>
                    <tr
                      key={v.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selectedVehicleId === v.id ? 'var(--bg-sky-tint)' : undefined }}
                      onClick={() => setSelectedVehicleId((prev) => (prev === v.id ? null : v.id))}
                    >
                      <td style={{ padding: '0.75rem' }}>{v.year ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{v.make || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{v.model || '—'}</td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{v.vin ? (v.vin.length <= 8 ? v.vin : `${v.vin.slice(0, 4)}...${v.vin.slice(-4)}`) : '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(v.weekly_insurance_cost)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(v.weekly_registration_cost)}</td>
                      <td style={{ padding: '0.75rem' }}>{vehicleAssignees[v.id] || '—'}</td>
                      <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openVehicleForm(v)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>Edit</button>
                        <button type="button" onClick={() => deleteVehicle(v)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>Delete</button>
                      </td>
                    </tr>
                    {selectedVehicleId === v.id && (
                      <tr key={`${v.id}-detail`}>
                        <td colSpan={8} style={{ padding: '1rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Odometer entries</h4>
                              <button type="button" onClick={() => { setOdometerFormOpen(true); setOdometerValue(''); setOdometerDate(new Date().toLocaleDateString('en-CA')) }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Add odometer entry</button>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Value</th><th></th></tr></thead>
                                <tbody>
                                  {odometerEntries.map((e) => (
                                    <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                                      <td style={{ padding: '0.5rem' }}>{e.read_date}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{e.odometer_value.toLocaleString()}</td>
                                      <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deleteOdometerEntry(e)} style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Replacement value</h4>
                              <button type="button" onClick={() => { setReplacementValueFormOpen(true); setReplacementValueValue(''); setReplacementValueDate(new Date().toLocaleDateString('en-CA')) }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Add replacement value</button>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Value</th><th></th></tr></thead>
                                <tbody>
                                  {replacementValueEntries.map((e) => (
                                    <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                                      <td style={{ padding: '0.5rem' }}>{e.read_date}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(e.replacement_value)}</td>
                                      <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deleteReplacementValueEntry(e)} style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Possessions</h4>
                              <button type="button" onClick={() => { setPossessionFormOpen(true); setPossessionUserId(''); setPossessionStartDate(new Date().toLocaleDateString('en-CA')); setPossessionEndDate('') }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Assign to user</button>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Start</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>End</th><th></th></tr></thead>
                                <tbody>
                                  {possessions.map((p) => {
                                    const u = users.find((x) => x.id === p.user_id)
                                    return (
                                      <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.5rem' }}>{u?.name ?? p.user_id.slice(0, 8)}</td>
                                        <td style={{ padding: '0.5rem' }}>{p.start_date}</td>
                                        <td style={{ padding: '0.5rem' }}>{p.end_date ?? '—'}</td>
                                        <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deletePossession(p)} style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              {vehicles.length > 0 && (
                <tfoot style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  <tr>
                    <td colSpan={4} style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>Total</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>${formatCurrency(vehicles.reduce((s, v) => s + (v.weekly_insurance_cost ?? 0), 0))}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>${formatCurrency(vehicles.reduce((s, v) => s + (v.weekly_registration_cost ?? 0), 0))}</td>
                    <td colSpan={2} style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }} />
                  </tr>
                </tfoot>
              )}
            </table>
            {vehicles.length === 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)', margin: 0 }}>No vehicles yet. Add one to get started.</p>}
          </div>
        )}
      </div>

      {vehicleFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingVehicle ? 'Edit vehicle' : 'Add vehicle'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Year *</label>
              <input type="number" min={1900} max={2100} value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Make *</label>
              <input type="text" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Model *</label>
              <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>VIN</label>
              <input type="text" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly insurance cost</label>
              <input type="number" min={0} step={0.01} value={vehicleInsCost} onChange={(e) => setVehicleInsCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly registration cost</label>
              <input type="number" min={0} step={0.01} value={vehicleRegCost} onChange={(e) => setVehicleRegCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertVehicle} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeVehicleForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {odometerFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Add odometer entry</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={odometerDate} onChange={(e) => setOdometerDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value</label>
              <input type="number" min={0} step={1} value={odometerValue} onChange={(e) => setOdometerValue(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertOdometerEntry} style={{ padding: '0.5rem 1rem' }}>Add</button>
              <button type="button" onClick={() => { setOdometerFormOpen(false); setOdometerValue('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {replacementValueFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Add replacement value</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={replacementValueDate} onChange={(e) => setReplacementValueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value ($)</label>
              <input type="number" min={0} step={0.01} value={replacementValueValue} onChange={(e) => setReplacementValueValue(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertReplacementValueEntry} style={{ padding: '0.5rem 1rem' }}>Add</button>
              <button type="button" onClick={() => { setReplacementValueFormOpen(false); setReplacementValueValue('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {possessionFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Assign to user</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>User *</label>
              <select value={possessionUserId} onChange={(e) => setPossessionUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {users.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Start date</label>
              <input type="date" value={possessionStartDate} onChange={(e) => setPossessionStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>End date (optional)</label>
              <input type="date" value={possessionEndDate} onChange={(e) => setPossessionEndDate(e.target.value)} placeholder="Leave blank if still in possession" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertPossession} style={{ padding: '0.5rem 1rem' }}>Assign</button>
              <button type="button" onClick={() => setPossessionFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
