// Wheels (v2.2733): what each person's vehicle costs per field hour over the
// trailing 90 days — own-vehicle fuel beside company trucks all-in — plus the
// truck table behind those rates. Read-only report; the arrangement itself is
// set on Payroll → Pay config, the override inline here. Review wiring is PR 2.

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { VEHICLE_ARRANGEMENT_OPTIONS, type VehicleArrangement, type WheelsPersonRow } from '../../lib/people/wheels'
import { loadWheelsSnapshot, saveVehicleRateOverride, type WheelsSnapshot } from '../../lib/people/wheelsData'

/** formatCurrency returns digits only; every money cell here carries the sign. */
function usd(n: number): string {
  return `$${formatCurrency(n)}`
}

const th: CSSProperties = { padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const td: CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-soft)', verticalAlign: 'top', fontSize: '0.875rem' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

const ARRANGEMENT_INK: Record<VehicleArrangement, string> = { company: '#0f766e', own_fuel_paid: '#4338ca', none: 'var(--text-muted)' }

export function VehicleArrangementChip({ arrangement, rate }: { arrangement: VehicleArrangement; rate?: number | null }) {
  const o = VEHICLE_ARRANGEMENT_OPTIONS.find((x) => x.key === arrangement)!
  const ink = ARRANGEMENT_INK[arrangement]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 8px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: ink,
        background: arrangement === 'none' ? 'var(--bg-muted)' : `color-mix(in srgb, ${ink} 14%, var(--surface))`,
        border: `1px solid color-mix(in srgb, ${ink} 35%, var(--surface))`,
      }}
      title={o.label}
    >
      {o.icon ? <span aria-hidden="true">{o.icon}</span> : null}
      {arrangement === 'none' ? '—' : rate != null ? `$${rate.toFixed(2)}/h` : o.short}
    </span>
  )
}

function fmtH(h: number): string {
  return `${h.toFixed(1)} h`
}

function OverrideCell({ row, onSaved }: { row: WheelsPersonRow; onSaved: () => void }) {
  const { showToast } = useToastContext()
  const [draft, setDraft] = useState(row.override != null ? row.override.toFixed(2) : '')
  const [busy, setBusy] = useState(false)
  useEffect(() => setDraft(row.override != null ? row.override.toFixed(2) : ''), [row.override])
  const commit = async () => {
    const raw = draft.trim()
    const next = raw === '' ? null : Number(raw.replace(/[$,\s]/g, ''))
    if (next != null && (!Number.isFinite(next) || next < 0)) {
      showToast('Enter a dollar amount per field hour, or leave it blank for the computed rate.', 'error')
      return
    }
    if ((next ?? null) === (row.override ?? null)) return
    setBusy(true)
    try {
      await saveVehicleRateOverride(row.name, next)
      showToast(next == null ? `${row.name}: back to the computed rate.` : `${row.name}: rate set to $${next.toFixed(2)}/field h.`, 'success')
      onSaved()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  if (row.arrangement === 'none') return <span style={{ color: 'var(--text-faint)' }}>—</span>
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder={row.computedRate != null ? row.computedRate.toFixed(2) : '—'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
      }}
      disabled={busy}
      aria-label={`Manual vehicle rate for ${row.name}, dollars per field hour`}
      title="Type a $/field hour to override the computed rate; blank uses the computed one."
      style={{ width: 72, padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', textAlign: 'right' }}
    />
  )
}

export function PeopleVehiclesWheelsSection({ users, onOpenPayConfig }: { users: ReadonlyArray<{ id: string; name: string }>; onOpenPayConfig?: () => void }) {
  const [open, setOpen] = useState(true)
  const [snap, setSnap] = useState<WheelsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnap(await loadWheelsSnapshot({ todayYmd: todayYmdInAppTz(), users }))
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [users])

  useEffect(() => {
    if (open && snap == null && !loading) void load()
  }, [open, snap, loading, load])

  const activeRows = snap?.rows.filter((r) => r.arrangement !== 'none' || r.fuelUsd > 0) ?? []
  const noneWithNothing = (snap?.rows.length ?? 0) - activeRows.length
  const heldTrucks = snap?.trucks.filter((t) => t.holderUserId) ?? []
  const idleTrucks = snap?.trucks.filter((t) => !t.holderUserId) ?? []

  return (
    <section style={{ marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} aria-label="Wheels — vehicle cost per field hour">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '0.7rem 0.9rem', background: 'transparent', border: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-base)', textAlign: 'left' }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>🛞 Wheels</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>what each person's vehicle costs per field hour · last 90 days</span>
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div style={{ padding: '0 0.9rem 0.9rem', display: 'grid', gap: '0.9rem' }}>
          {error ? <p style={{ margin: 0, color: 'var(--text-red-700)' }}>{error}</p> : null}
          {loading && !snap ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Adding up fuel, hours and trucks…</p> : null}
          {snap ? (
            <>
              <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <span>
                  <VehicleArrangementChip arrangement="own_fuel_paid" /> own vehicle, fuel paid averages{' '}
                  <b style={{ color: 'var(--text-700)' }}>{snap.comparison.ownAvg != null ? `$${snap.comparison.ownAvg.toFixed(2)}/field h` : '—'}</b>
                </span>
                <span>
                  <VehicleArrangementChip arrangement="company" /> company trucks{' '}
                  <b style={{ color: 'var(--text-700)' }}>{snap.comparison.companyAvg != null ? `$${snap.comparison.companyAvg.toFixed(2)}/field h` : '—'}</b> all-in
                </span>
                <span>
                  {snap.window.start} → {snap.window.end}
                  {snap.fuelTag ? ` · fuel = ${snap.fuelTag.icon} ${snap.fuelTag.name} tag` : ' · no fuel tag found — set one up in Banking → Accounting → Tags'}
                </span>
                {snap.unattributedCards.length > 0 ? (
                  <span title="Card fuel with no person attributed. Link the card to a person in Banking → Sorting → User Card Link (auto-assign) and it fills in for past and future purchases.">
                    {usd(snap.unattributedFuelUsd)} of fuel has no person on it:{' '}
                    {snap.unattributedCards.map((c) => `${c.label} ${usd(c.usd)}`).join(' · ')}
                  </span>
                ) : null}
                {snap.offCardFuelFamily.usd > 0 ? (
                  <span title="Rows in the fuel tag that were not paid with a debit card — usually a supplier payment filed under a vehicle label. Not counted as anyone's fuel; check the label in Banking → Accounting.">
                    Not counted: {usd(snap.offCardFuelFamily.usd)} filed under a vehicle label but not on a card ({snap.offCardFuelFamily.top.map((t) => `${t.counterparty} ${usd(t.usd)}`).join(', ')})
                  </span>
                ) : null}
                <button type="button" onClick={() => void load()} disabled={loading} style={{ marginLeft: 'auto', padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Person</th>
                      <th style={th}>Deal</th>
                      <th style={th}>Truck</th>
                      <th style={thNum}>Fuel · 90d</th>
                      <th style={thNum}>Field h</th>
                      <th style={thNum}>Fuel / field h</th>
                      <th style={thNum} title="The rate Review will use once wired: own = fuel ÷ field h, company = the truck's all-in rate. A manual override wins.">Rate</th>
                      <th style={thNum} title="Manual $/field hour; blank = computed">Override</th>
                      <th style={th}>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ ...td, color: 'var(--text-muted)' }}>
                          Nobody has a vehicle deal yet. Set one per person on Payroll → Pay config → Vehicle.
                        </td>
                      </tr>
                    ) : (
                      activeRows.map((r) => (
                        <tr key={r.name}>
                          <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
                          <td style={td}><VehicleArrangementChip arrangement={r.arrangement} /></td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.truck ? r.truck.name : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                          <td style={tdNum}>{r.fuelUsd > 0 ? usd(r.fuelUsd) : <span style={{ color: 'var(--text-faint)' }}>$0</span>}</td>
                          <td style={tdNum}>{fmtH(r.fieldHours)}</td>
                          <td style={tdNum}>{r.fuelPerFieldHour != null ? `$${r.fuelPerFieldHour.toFixed(2)}` : '—'}</td>
                          <td style={{ ...tdNum, fontWeight: 600 }}>{r.effectiveRate != null ? `$${r.effectiveRate.toFixed(2)}` : '—'}</td>
                          <td style={tdNum}><OverrideCell row={r} onSaved={() => void load()} /></td>
                          <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{r.note}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {noneWithNothing > 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {noneWithNothing} {noneWithNothing === 1 ? 'person' : 'people'} with no vehicle deal and no fuel in the window are not listed.
                  {onOpenPayConfig ? (
                    <>
                      {' '}
                      <button type="button" onClick={onOpenPayConfig} style={{ background: 'none', border: 0, padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: 'inherit', textDecoration: 'underline' }}>
                        Set arrangements on Pay config
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Company trucks · running cost</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Truck</th>
                        <th style={th}>Holder</th>
                        <th style={thNum}>Fuel</th>
                        <th style={thNum} title="Weekly insurance while on a plan + weekly registration, pro-rated over the window">Ins + reg</th>
                        <th style={thNum}>Service</th>
                        <th style={thNum}>Total</th>
                        <th style={thNum}>Holder field h</th>
                        <th style={thNum}>$ / field h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heldTrucks.length === 0 && idleTrucks.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ ...td, color: 'var(--text-muted)' }}>No vehicles yet.</td>
                        </tr>
                      ) : null}
                      {heldTrucks.map((t) => (
                        <tr key={t.vehicleId}>
                          <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{t.name}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.holderName ?? '—'}</td>
                          <td style={tdNum}>{usd(t.cost.fuel)}</td>
                          <td style={tdNum}>{usd(t.cost.insurance + t.cost.registration)}</td>
                          <td style={tdNum}>{usd(t.cost.service)}</td>
                          <td style={{ ...tdNum, fontWeight: 600 }}>{usd(t.cost.total)}</td>
                          <td style={tdNum}>{fmtH(t.holderFieldHours)}</td>
                          <td style={{ ...tdNum, fontWeight: 600 }}>{t.cost.ratePerFieldHour != null ? `$${t.cost.ratePerFieldHour.toFixed(2)}` : <span title="No field hours for the holder in the window">—</span>}</td>
                        </tr>
                      ))}
                      {idleTrucks.length > 0 ? (
                        <tr>
                          <td colSpan={8} style={{ ...td, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                            {idleTrucks.length} parked or unassigned: {idleTrucks.map((t) => `${t.name} (${usd(t.cost.insurance + t.cost.registration + t.cost.service)} carried in the window)`).join(', ')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '72ch' }}>
                Fuel is every debit-card purchase in the fuel tag attributed to the person (Banking → Accounting); payments that were not on a card never count. Field hours are approved job sessions. A truck's fuel is its holder's fuel; insurance counts only while the truck is on a plan. Wear is not included yet.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
