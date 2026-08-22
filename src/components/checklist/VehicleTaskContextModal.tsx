import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SERVICE_TYPE_LABELS, oilStatus, vehicleDisplayName, vinTail, type OilStatus } from '../../lib/vehicleFleet'
import { historyShortDate } from '../../lib/checklistHistorySplit'

/**
 * "The vehicle behind the task" (v2.2094): tapping the 🚗 chip on a vehicle
 * maintenance task opens this vitals card — holder, odometer, oil, insurance,
 * open problems, recent service. Data comes from the SECURITY DEFINER RPC
 * `vehicle_context_for_instance` (assignee-scoped), so field crew see it even
 * when they can't read the vehicle tables or open the Vehicles page.
 */

type VehicleContext = {
  vehicle: {
    id: string
    year: number | null
    make: string
    model: string
    vin: string | null
    oil_change_interval_miles: number | null
    oil_suggest_window_miles: number | null
    oil_require_past_due_miles: number | null
  }
  task: { title: string; note: string | null; due_date: string | null; created_by_name: string | null }
  holder: { name: string | null; is_motor_pool: boolean; since: string } | null
  odometer: { value: number; read_date: string; by_name: string | null } | null
  last_oil_change: { service_date: string; odometer_value: number } | null
  insurance: { plan_name: string; end_date: string | null } | null
  open_problems: Array<{ description: string; severity: string; report_date: string }>
  recent_service: Array<{ service_type: string; service_date: string; odometer_value: number | null }>
}

function daysSince(ymd: string, todayYmd: string): number {
  return Math.max(0, Math.round((Date.parse(todayYmd) - Date.parse(ymd)) / 86_400_000))
}

function oilFact(ctx: VehicleContext): { value: string; meta: string; warn: boolean } {
  const status: OilStatus = oilStatus(
    ctx.last_oil_change
      ? { id: '', vehicle_id: '', service_type: 'oil_change', service_date: ctx.last_oil_change.service_date, odometer_value: ctx.last_oil_change.odometer_value, cost: null, note: null, created_at: null }
      : null,
    ctx.vehicle.oil_change_interval_miles,
    ctx.odometer ? { id: '', vehicle_id: '', odometer_value: ctx.odometer.value, read_date: ctx.odometer.read_date, created_at: null } : null,
    { suggestWindowMiles: ctx.vehicle.oil_suggest_window_miles, requirePastDueMiles: ctx.vehicle.oil_require_past_due_miles },
  )
  const changed = ctx.last_oil_change
    ? `changed ${historyShortDate(ctx.last_oil_change.service_date)} @ ${ctx.last_oil_change.odometer_value.toLocaleString()}`
    : 'no oil change on record'
  switch (status.state) {
    case 'ok':
      return { value: `${status.milesRemaining.toLocaleString()} mi left`, meta: changed, warn: false }
    case 'due_soon':
      return { value: `${status.milesRemaining.toLocaleString()} mi left — due soon`, meta: changed, warn: true }
    case 'overdue':
      return { value: `${status.milesOver.toLocaleString()} mi overdue`, meta: changed, warn: true }
    default:
      return { value: 'Unknown', meta: changed, warn: false }
  }
}

export default function VehicleTaskContextModal({
  instanceId,
  canOpenVehiclesPage,
  onClose,
}: {
  instanceId: string
  /** Office roles get the "Open in Vehicles →" jump; field roles can't open that page. */
  canOpenVehiclesPage: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [ctx, setCtx] = useState<VehicleContext | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.rpc('vehicle_context_for_instance' as never, { p_instance_id: instanceId } as never)
        if (!cancelled) setCtx((data as VehicleContext | null) ?? null)
      } catch {
        if (!cancelled) setCtx(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [instanceId])

  const todayYmd = new Date().toLocaleDateString('en-CA')
  const factBox = (k: string, v: string, m: string, warn = false) => (
    <div style={{ border: `1px solid ${warn ? '#fde68a' : 'var(--border)'}`, background: warn ? 'var(--bg-amber-tint)' : undefined, borderRadius: 8, padding: '0.4rem 0.6rem' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{k}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 1, color: warn ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>{v}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m}</div>
    </div>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About this vehicle"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 14, width: 'min(30rem, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.9rem 1.15rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden="true" style={{ fontSize: '1.15rem' }}>🛻</span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-strong)' }}>
              {ctx ? vehicleDisplayName(ctx.vehicle) : 'Vehicle'}
            </div>
            {ctx?.vehicle.vin ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VIN …{vinTail(ctx.vehicle.vin)}</div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', font: 'inherit', fontSize: '1.05rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem 0.3rem' }}>
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.9rem 1.15rem 1rem' }}>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : !ctx ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Couldn’t load this vehicle — the task may have been unlinked, or you’re no longer assigned to it.
            </p>
          ) : (
            <>
              <div style={{ border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', borderRadius: 9, padding: '0.5rem 0.7rem', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-blue-800)' }}>Your task:</span> {ctx.task.title}
                {ctx.task.due_date ? ` · due ${historyShortDate(ctx.task.due_date)}` : ''}
                {ctx.task.created_by_name || ctx.task.note ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-700)', marginTop: 2 }}>
                    {ctx.task.created_by_name ? `from ${ctx.task.created_by_name}` : ''}
                    {ctx.task.note ? `${ctx.task.created_by_name ? ' — ' : ''}“${ctx.task.note}”` : ''}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 0.9rem', marginBottom: '0.4rem' }}>
                {factBox(
                  'HOLDER',
                  ctx.holder ? (ctx.holder.is_motor_pool ? 'Motor pool' : ctx.holder.name ?? '—') : '—',
                  ctx.holder ? `since ${historyShortDate(ctx.holder.since)}` : 'no possession on record',
                )}
                {factBox(
                  'ODOMETER',
                  ctx.odometer ? `${ctx.odometer.value.toLocaleString()} mi` : '—',
                  ctx.odometer ? `read ${historyShortDate(ctx.odometer.read_date)}${ctx.odometer.by_name ? ` by ${ctx.odometer.by_name}` : ''}` : 'no readings yet',
                )}
                {(() => {
                  const o = oilFact(ctx)
                  return factBox('OIL', o.value, o.meta, o.warn)
                })()}
                {factBox(
                  'INSURANCE',
                  ctx.insurance ? 'Covered' : 'None on file',
                  ctx.insurance ? `${ctx.insurance.plan_name}${ctx.insurance.end_date ? ` · through ${historyShortDate(ctx.insurance.end_date)}` : ''}` : '',
                )}
              </div>

              {ctx.open_problems.length > 0 ? (
                <>
                  <p style={{ margin: '0.6rem 0 0.15rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                    OPEN PROBLEMS · {ctx.open_problems.length}
                  </p>
                  {ctx.open_problems.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.8rem', padding: '0.24rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-strong)' }}>
                      <span style={{ minWidth: 0 }}>{p.description}</span>
                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-red-700)', background: 'var(--bg-red-100)', borderRadius: 999, padding: '0.05rem 0.45rem' }}>
                        {daysSince(p.report_date, todayYmd)}d
                      </span>
                    </div>
                  ))}
                </>
              ) : null}

              {ctx.recent_service.length > 0 ? (
                <>
                  <p style={{ margin: '0.7rem 0 0.15rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>RECENT SERVICE</p>
                  {ctx.recent_service.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.78rem', color: 'var(--text-700)', padding: '0.22rem 0', borderTop: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)', width: '2.8rem', flexShrink: 0 }}>{historyShortDate(s.service_date)}</span>
                      <span>
                        {SERVICE_TYPE_LABELS[s.service_type] ?? 'Service'}
                        {s.odometer_value != null ? ` @ ${s.odometer_value.toLocaleString()}` : ''}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 1.15rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          {canOpenVehiclesPage && ctx ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate('/people?tab=vehicles')
              }}
              style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}
            >
              Open in Vehicles →
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.33rem 0.95rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
