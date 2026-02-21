import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type PayConfigRow = { person_name: string; hourly_wage: number | null; is_salary: boolean; show_in_hours: boolean; show_in_cost_matrix: boolean }
type HoursRow = { person_name: string; work_date: string; hours: number }

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function decimalToHms(decimal: number): string {
  if (!decimal || decimal <= 0) return ''
  const h = Math.floor(decimal)
  const m = Math.floor((decimal - h) * 60)
  const s = Math.round(((decimal - h) * 60 - m) * 60)
  if (s > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${h}:${String(m).padStart(2, '0')}:00`
}

function hmsToDecimal(str: string): number {
  const trimmed = str.trim()
  if (!trimmed) return 0
  // "8.5" (one digit after dot) = 8.5 decimal hours. "8.30" (two digits, ≤59) = 8:30.
  if (!trimmed.includes(':') && /^\d+\.(\d+)$/.test(trimmed)) {
    const m = trimmed.match(/^\d+\.(\d+)$/)!
    const frac = m[1]!
    if (frac.length === 1) return parseFloat(trimmed) // 8.5 → 8.5 hrs
    if (parseInt(frac, 10) > 59) return parseFloat(trimmed) // 8.75 → 8.75 hrs
  }
  const normalized = trimmed.replace(/\./g, ':').replace(/\s+/g, ':')
  const parts = normalized.split(':').map((p) => parseInt(p, 10) || 0)
  const [h = 0, m = 0, s = 0] = parts
  return h + m / 60 + s / 3600
}

export function HoursSection() {
  const { user: authUser } = useAuth()
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [hoursDateStart, setHoursDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toISOString().slice(0, 10)
  })
  const [hoursDateEnd, setHoursDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toISOString().slice(0, 10)
  })
  const [editingHoursCell, setEditingHoursCell] = useState<{ personName: string; workDate: string } | null>(null)
  const [editingHoursValue, setEditingHoursValue] = useState('')

  const loadPeopleHoursRef = useRef<() => void>()
  loadPeopleHoursRef.current = () => loadPeopleHours(hoursDateStart, hoursDateEnd)

  async function loadPayAccess() {
    if (!authUser?.id) return
    const [meRes, approvedRes] = await Promise.all([
      supabase.from('users').select('role').eq('id', authUser.id).single(),
      supabase.from('pay_approved_masters').select('master_id'),
    ])
    const role = (meRes.data as { role?: string } | null)?.role ?? null
    const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
    if (role === 'dev') {
      setCanAccessHours(true)
      return
    }
    if (role === 'assistant') {
      setCanAccessHours(true)
      return
    }
    if (role === 'master_technician' && approvedIds.has(authUser.id)) {
      setCanAccessHours(true)
    }
  }

  async function loadPayConfig() {
    const { data, error: err } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix')
    if (err) {
      setError(err.message)
      return
    }
    const map: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as PayConfigRow[]) {
      map[r.person_name] = r
    }
    setPayConfig(map)
  }

  async function loadPeopleHours(start: string, end: string) {
    const { data, error: err } = await supabase
      .from('people_hours')
      .select('person_name, work_date, hours')
      .gte('work_date', start)
      .lte('work_date', end)
    if (err) {
      setError(err.message)
      return
    }
    setPeopleHours((data ?? []) as HoursRow[])
  }

  async function loadHoursDisplayOrder() {
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) {
      map[r.person_name] = r.sequence_order
    }
    setHoursDisplayOrder(map)
  }

  async function moveHoursRow(personName: string, direction: 'up' | 'down') {
    const showPeople = Object.keys(payConfig)
      .filter((n) => payConfig[n]?.show_in_hours ?? false)
      .sort((a, b) => {
        const orderA = hoursDisplayOrder[a] ?? 999999
        const orderB = hoursDisplayOrder[b] ?? 999999
        return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
      })
    const idx = showPeople.indexOf(personName)
    if (idx < 0) return
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= showPeople.length) return
    const otherName = showPeople[otherIdx]
    if (!otherName) return
    const newOrderA = otherIdx
    const newOrderB = idx
    setHoursDisplayOrder((prev) => ({
      ...prev,
      [personName]: newOrderA,
      [otherName]: newOrderB,
    }))
    await Promise.all([
      supabase.from('people_hours_display_order').upsert({ person_name: personName, sequence_order: newOrderA }, { onConflict: 'person_name' }),
      supabase.from('people_hours_display_order').upsert({ person_name: otherName, sequence_order: newOrderB }, { onConflict: 'person_name' }),
    ])
  }

  async function saveHours(personName: string, workDate: string, hours: number) {
    setPeopleHours((prev) => {
      const rest = prev.filter((h) => !(h.person_name === personName && h.work_date === workDate))
      return [...rest, { person_name: personName, work_date: workDate, hours }]
    })
    const { error: err } = await supabase.from('people_hours').upsert(
      { person_name: personName, work_date: workDate, hours, entered_by: authUser?.id ?? null },
      { onConflict: 'person_name,work_date' }
    )
    if (err) setError(err.message)
  }

  function getHoursForPersonDate(personName: string, workDate: string): number {
    const row = peopleHours.find((h) => h.person_name === personName && h.work_date === workDate)
    return row?.hours ?? 0
  }

  function getEffectiveHours(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    if (cfg?.is_salary) {
      const day = new Date(workDate + 'T12:00:00').getDay()
      if (day === 0 || day === 6) return 0
      return 8
    }
    return getHoursForPersonDate(personName, workDate)
  }

  function shiftHoursWeek(delta: number) {
    const dStart = new Date(hoursDateStart + 'T12:00:00')
    const dEnd = new Date(hoursDateEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setHoursDateStart(dStart.toISOString().slice(0, 10))
    setHoursDateEnd(dEnd.toISOString().slice(0, 10))
  }

  useEffect(() => {
    loadPayAccess()
  }, [authUser?.id])

  useEffect(() => {
    if (!canAccessHours) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      loadPayConfig(),
      loadPeopleHours(hoursDateStart, hoursDateEnd),
      loadHoursDisplayOrder(),
    ]).finally(() => setLoading(false))
  }, [canAccessHours, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    if (!canAccessHours) return
    const channel = supabase
      .channel('quickfill-people-hours-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people_hours' }, () => {
        loadPeopleHoursRef.current?.()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [canAccessHours])

  const showPeopleForHours = Object.keys(payConfig)
    .filter((n) => payConfig[n]?.show_in_hours ?? false)
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })
  const hoursDays = getDaysInRange(hoursDateStart, hoursDateEnd)

  if (!canAccessHours) {
    return (
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>People Hours</h2>
        <p style={{ color: '#6b7280' }}>You do not have access to the Hours tab.</p>
      </section>
    )
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>People Hours</h2>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
              <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            </label>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
              <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            </label>
            <button type="button" onClick={() => shiftHoursWeek(-1)} style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>← last week</button>
            <button type="button" onClick={() => shiftHoursWeek(1)} style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>next week →</button>
          </div>
          {showPeopleForHours.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No people with Show in Hours selected. Go to People &gt; Pay tab and check Show in Hours for people to track.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 200 }} />
                  {hoursDays.map((d) => (
                    <col key={d} style={{ width: 72 }} />
                  ))}
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                    {hoursDays.map((d) => (
                      <th key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </th>
                    ))}
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>HH:MM:SS</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForHours.map((personName, idx) => {
                    const cfg = payConfig[personName]
                    const isSalary = cfg?.is_salary ?? false
                    return (
                      <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ display: 'flex', flexDirection: 'row', gap: 0, marginRight: '0.25rem' }}>
                            <button type="button" onClick={() => moveHoursRow(personName, 'up')} disabled={idx === 0} title="Move up" style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}>▲</button>
                            <button type="button" onClick={() => moveHoursRow(personName, 'down')} disabled={idx === showPeopleForHours.length - 1} title="Move down" style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForHours.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForHours.length - 1 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}>▼</button>
                          </span>
                          {personName}{isSalary && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>(salary)</span>}
                        </td>
                        {hoursDays.map((d) => (
                          <td key={d} style={{ padding: '0.35rem 0.5rem', textAlign: isSalary ? 'center' : 'right' }}>
                            {isSalary ? (
                              <span style={{ color: '#6b7280' }}>{decimalToHms(getEffectiveHours(personName, d)) || '-'}</span>
                            ) : (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editingHoursCell?.personName === personName && editingHoursCell?.workDate === d ? editingHoursValue : decimalToHms(getHoursForPersonDate(personName, d))}
                                placeholder="-"
                                onFocus={(e) => {
                                  setEditingHoursCell({ personName, workDate: d })
                                  setEditingHoursValue(decimalToHms(getHoursForPersonDate(personName, d)) || '')
                                  e.target.select()
                                }}
                                onChange={(e) => setEditingHoursValue(e.target.value)}
                                onBlur={() => {
                                  const v = hmsToDecimal(editingHoursValue)
                                  saveHours(personName, d, v)
                                  setEditingHoursCell(null)
                                }}
                                style={{ width: 72, padding: '0.25rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                              />
                            )}
                          </td>
                        ))}
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{decimalToHms(hoursDays.reduce((s, d) => s + getEffectiveHours(personName, d), 0)) || '-'}</td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{(hoursDays.reduce((s, d) => s + getEffectiveHours(personName, d), 0)).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                  {(() => {
                    const grandTotal = showPeopleForHours.reduce((s, p) => s + hoursDays.reduce((ds, d) => ds + getEffectiveHours(p, d), 0), 0)
                    return (
                      <>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Total (HH:MM:SS):</td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getEffectiveHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                                {decimalToHms(daySum) || '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>{decimalToHms(grandTotal) || '-'}</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>-</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Total (Decimal):</td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getEffectiveHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                                {daySum.toFixed(2)}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>-</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>{grandTotal.toFixed(2)}</td>
                        </tr>
                      </>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
