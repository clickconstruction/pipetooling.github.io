import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'

type HousingUnit = {
  id: string
  address: string
  rent_per_week: number
  utilities_per_week: number
  insurance_per_week: number
  created_at: string | null
  updated_at: string | null
}
type HousingPossession = { id: string; housing_id: string; user_id: string; start_date: string; end_date: string | null; created_at: string | null }

type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }

export type PeopleHousingTabProps = {
  users: UserRow[]
}

export default function PeopleHousingTab({ users }: PeopleHousingTabProps) {
  const [housingUnits, setHousingUnits] = useState<HousingUnit[]>([])
  const [housingLoading, setHousingLoading] = useState(false)
  const [housingError, setHousingError] = useState<string | null>(null)
  const [housingFormOpen, setHousingFormOpen] = useState(false)
  const [editingHousingUnit, setEditingHousingUnit] = useState<HousingUnit | null>(null)
  const [selectedHousingId, setSelectedHousingId] = useState<string | null>(null)
  const [housingPossessions, setHousingPossessions] = useState<HousingPossession[]>([])
  const [housingAssignees, setHousingAssignees] = useState<Record<string, string>>({})
  const [housingAddress, setHousingAddress] = useState('')
  const [housingRentWeek, setHousingRentWeek] = useState('')
  const [housingUtilitiesWeek, setHousingUtilitiesWeek] = useState('')
  const [housingInsuranceWeek, setHousingInsuranceWeek] = useState('')
  const [housingPossessionFormOpen, setHousingPossessionFormOpen] = useState(false)
  const [housingPossessionUserId, setHousingPossessionUserId] = useState('')
  const [housingPossessionStartDate, setHousingPossessionStartDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [housingPossessionEndDate, setHousingPossessionEndDate] = useState('')

  async function loadHousingUnits() {
    setHousingLoading(true)
    setHousingError(null)
    const today = new Date().toLocaleDateString('en-CA')
    const { data: unitsData, error: unitsErr } = await supabase.from('housing_units').select('*').order('address', { ascending: true })
    setHousingLoading(false)
    if (unitsErr) {
      setHousingError(unitsErr.message)
      return
    }
    setHousingUnits((unitsData ?? []) as HousingUnit[])
    const ids = (unitsData ?? []).map((u: { id: string }) => u.id)
    if (ids.length === 0) {
      setHousingAssignees({})
      return
    }
    const { data: possData } = await supabase
      .from('housing_possessions')
      .select('housing_id, user_id')
      .in('housing_id', ids)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    const possByHousing: Record<string, string[]> = {}
    for (const p of (possData ?? []) as { housing_id: string; user_id: string }[]) {
      const arr = (possByHousing[p.housing_id] ??= [])
      arr.push(p.user_id)
    }
    const userIds = [...new Set((possData ?? []).map((p: { user_id: string }) => p.user_id))]
    const { data: usersData } =
      userIds.length > 0
        ? await supabase.from('users').select('id, name').is('archived_at', null).in('id', userIds)
        : { data: [] }
    const userNames: Record<string, string> = {}
    for (const u of (usersData ?? []) as { id: string; name: string }[]) {
      userNames[u.id] = u.name ?? ''
    }
    const assignees: Record<string, string> = {}
    for (const [hid, uids] of Object.entries(possByHousing)) {
      assignees[hid] = uids.map((uid) => userNames[uid] || uid.slice(0, 8)).join(', ')
    }
    setHousingAssignees(assignees)
  }

  async function loadHousingPossessions(housingId: string) {
    const { data, error } = await supabase
      .from('housing_possessions')
      .select('*')
      .eq('housing_id', housingId)
      .order('start_date', { ascending: false })
    if (error) return
    setHousingPossessions((data ?? []) as HousingPossession[])
  }

  function openHousingForm(u?: HousingUnit) {
    setEditingHousingUnit(u ?? null)
    setHousingAddress(u?.address ?? '')
    setHousingRentWeek(u?.rent_per_week != null ? String(u.rent_per_week) : '')
    setHousingUtilitiesWeek(u?.utilities_per_week != null ? String(u.utilities_per_week) : '')
    setHousingInsuranceWeek(u?.insurance_per_week != null ? String(u.insurance_per_week) : '')
    setHousingFormOpen(true)
  }

  function closeHousingForm() {
    setHousingFormOpen(false)
    setEditingHousingUnit(null)
    setHousingAddress('')
    setHousingRentWeek('')
    setHousingUtilitiesWeek('')
    setHousingInsuranceWeek('')
  }

  async function upsertHousingUnit() {
    const rent = parseFloat(housingRentWeek) || 0
    const util = parseFloat(housingUtilitiesWeek) || 0
    const ins = parseFloat(housingInsuranceWeek) || 0
    if (rent < 0 || util < 0 || ins < 0) {
      setHousingError('Weekly amounts must be zero or positive')
      return
    }
    const addr = housingAddress.trim()
    if (!addr) {
      setHousingError('Address is required')
      return
    }
    if (editingHousingUnit) {
      const { error: err } = await supabase
        .from('housing_units')
        .update({
          address: addr,
          rent_per_week: rent,
          utilities_per_week: util,
          insurance_per_week: ins,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingHousingUnit.id)
      if (err) setHousingError(err.message)
      else {
        closeHousingForm()
        void loadHousingUnits()
      }
    } else {
      const { error: err } = await supabase.from('housing_units').insert({
        address: addr,
        rent_per_week: rent,
        utilities_per_week: util,
        insurance_per_week: ins,
      })
      if (err) setHousingError(err.message)
      else {
        closeHousingForm()
        void loadHousingUnits()
      }
    }
  }

  async function deleteHousingUnit(u: HousingUnit) {
    if (!window.confirm(`Delete housing at "${u.address}"? Assignments will be removed.`)) return
    const { error: err } = await supabase.from('housing_units').delete().eq('id', u.id)
    if (err) setHousingError(err.message)
    else {
      setSelectedHousingId((prev) => (prev === u.id ? null : prev))
      loadHousingUnits()
    }
  }

  async function upsertHousingPossession() {
    if (!selectedHousingId || !housingPossessionUserId) {
      setHousingError('Select a user')
      return
    }
    const { error: err } = await supabase.from('housing_possessions').insert({
      housing_id: selectedHousingId,
      user_id: housingPossessionUserId,
      start_date: housingPossessionStartDate,
      end_date: housingPossessionEndDate.trim() || null,
    })
    if (err) setHousingError(err.message)
    else {
      setHousingPossessionFormOpen(false)
      setHousingPossessionUserId('')
      setHousingPossessionStartDate(new Date().toLocaleDateString('en-CA'))
      setHousingPossessionEndDate('')
      loadHousingPossessions(selectedHousingId)
      loadHousingUnits()
    }
  }

  async function deleteHousingPossession(p: HousingPossession) {
    const { error: err } = await supabase.from('housing_possessions').delete().eq('id', p.id)
    if (err) setHousingError(err.message)
    else {
      if (selectedHousingId) loadHousingPossessions(selectedHousingId)
      loadHousingUnits()
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void loadHousingUnits(), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (selectedHousingId) {
      void loadHousingPossessions(selectedHousingId)
    } else {
      setHousingPossessions([])
    }
  }, [selectedHousingId])

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Housing</h2>
          <button
            type="button"
            onClick={() => openHousingForm()}
            style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
          >
            + Add housing
          </button>
        </div>
        {housingError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{housingError}</p>}
        {housingLoading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rent/wk</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Utilities/wk</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Insurance/wk</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned to</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {housingUnits.map((hu) => (
                  <Fragment key={hu.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        background: selectedHousingId === hu.id ? '#f0fdf4' : undefined,
                      }}
                      onClick={() => setSelectedHousingId((prev) => (prev === hu.id ? null : hu.id))}
                    >
                      <td style={{ padding: '0.75rem' }}>{hu.address || '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(hu.rent_per_week)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(hu.utilities_per_week)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(hu.insurance_per_week)}</td>
                      <td style={{ padding: '0.75rem' }}>{housingAssignees[hu.id] || '—'}</td>
                      <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openHousingForm(hu)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => void deleteHousingUnit(hu)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: '#b91c1c' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                    {selectedHousingId === hu.id && (
                      <tr key={`${hu.id}-detail`}>
                        <td colSpan={6} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <div>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Assignments</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setHousingPossessionFormOpen(true)
                                setHousingPossessionUserId('')
                                setHousingPossessionStartDate(new Date().toLocaleDateString('en-CA'))
                                setHousingPossessionEndDate('')
                              }}
                              style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                            >
                              + Assign to user
                            </button>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Start</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>End</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {housingPossessions.map((p) => {
                                  const u = users.find((x) => x.id === p.user_id)
                                  return (
                                    <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                      <td style={{ padding: '0.5rem' }}>{u?.name ?? p.user_id.slice(0, 8)}</td>
                                      <td style={{ padding: '0.5rem' }}>{p.start_date}</td>
                                      <td style={{ padding: '0.5rem' }}>{p.end_date ?? '—'}</td>
                                      <td style={{ padding: '0.5rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => void deleteHousingPossession(p)}
                                          style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}
                                        >
                                          ×
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              {housingUnits.length > 0 && (
                <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                  <tr>
                    <td style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }}>Total</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                      ${formatCurrency(housingUnits.reduce((s, u) => s + (u.rent_per_week ?? 0), 0))}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                      ${formatCurrency(housingUnits.reduce((s, u) => s + (u.utilities_per_week ?? 0), 0))}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                      ${formatCurrency(housingUnits.reduce((s, u) => s + (u.insurance_per_week ?? 0), 0))}
                    </td>
                    <td colSpan={2} style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }} />
                  </tr>
                </tfoot>
              )}
            </table>
            {housingUnits.length === 0 && (
              <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No housing yet. Add a unit to assign people and show costs on pay reports.</p>
            )}
          </div>
        )}
      </div>

      {housingFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{editingHousingUnit ? 'Edit housing' : 'Add housing'}</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Address *</label>
              <input type="text" value={housingAddress} onChange={(e) => setHousingAddress(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Rent/week ($)</label>
              <input type="number" min={0} step={0.01} value={housingRentWeek} onChange={(e) => setHousingRentWeek(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Utilities/week ($)</label>
              <input type="number" min={0} step={0.01} value={housingUtilitiesWeek} onChange={(e) => setHousingUtilitiesWeek(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Insurance/week ($)</label>
              <input type="number" min={0} step={0.01} value={housingInsuranceWeek} onChange={(e) => setHousingInsuranceWeek(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void upsertHousingUnit()} style={{ padding: '0.5rem 1rem' }}>
                {editingHousingUnit ? 'Save' : 'Add'}
              </button>
              <button type="button" onClick={() => closeHousingForm()} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {housingPossessionFormOpen && selectedHousingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Assign housing to user</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>User *</label>
              <select value={housingPossessionUserId} onChange={(e) => setHousingPossessionUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {users.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email ?? u.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Start date</label>
              <input type="date" value={housingPossessionStartDate} onChange={(e) => setHousingPossessionStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>End date (optional)</label>
              <input type="date" value={housingPossessionEndDate} onChange={(e) => setHousingPossessionEndDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void upsertHousingPossession()} style={{ padding: '0.5rem 1rem' }}>
                Assign
              </button>
              <button type="button" onClick={() => setHousingPossessionFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
