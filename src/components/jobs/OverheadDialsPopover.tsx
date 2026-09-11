import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  OVERHEAD_ALLOCATION_LEGACY,
  OVERHEAD_ALLOCATION_RECOMMENDED,
  OVERHEAD_IDLE_CAP_OPTIONS,
  OVERHEAD_OPEN_DEFINITIONS,
  OVERHEAD_SMOOTH_DAYS_MAX,
  overheadAllocationLabel,
  overheadAllocationSettingsEqual,
  type OverheadAllocationSettings,
} from '../../lib/jobs/overheadAllocation'
import type { JobSummaryHygiene } from '../../lib/jobs/jobSummaryLedgerView'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * The overhead dials (v2.3259, devs only): turn the three constants and watch the
 * window's reconciliation tie; save the app default for everyone. Exploring changes
 * this device only, and the toolbar chip says so until the dev saves or goes back.
 */
type Props = {
  settings: OverheadAllocationSettings
  appDefault: OverheadAllocationSettings
  isOverride: boolean
  saving: boolean
  hygiene: JobSummaryHygiene | null
  onExplore: (s: OverheadAllocationSettings | null) => void
  onSaveAppDefault: (s: OverheadAllocationSettings) => Promise<void>
  onClose: () => void
}

const panel: CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: 'min(34rem, calc(100vw - 2rem))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }
const dialHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: '0.85rem' }
const dialWhy: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.35 }
const segWrap: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }
const segBtn = (on: boolean, last: boolean): CSSProperties => ({ padding: '0.2rem 0.55rem', fontSize: '0.78rem', border: 'none', borderRight: last ? 'none' : '1px solid var(--border)', background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', cursor: 'pointer', font: 'inherit' })
const btn: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', font: 'inherit' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const reconK: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const reconV: CSSProperties = { fontSize: '0.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }

const money = (v: number) => `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`

export default function OverheadDialsPopover({ settings, appDefault, isOverride, saving, hygiene, onExplore, onSaveAppDefault, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  useEffect(() => setConfirmSave(false), [settings])
  const set = (patch: Partial<OverheadAllocationSettings>) => onExplore({ ...settings, ...patch })
  const isAppDefault = overheadAllocationSettingsEqual(settings, appDefault)
  const save = async () => {
    setError(null)
    try {
      await onSaveAppDefault(settings)
      setConfirmSave(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the app default')
    }
  }
  return (
    <div ref={ref} style={panel} role="dialog" aria-label="Overhead dials">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Overhead dials</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {isOverride ? 'Exploring on this device · everyone else sees the app default' : 'The app default · everyone charges from these'}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.1rem 0.45rem' }}>
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={dialHead}>
          <label htmlFor="overhead-dial-smooth" style={{ fontWeight: 600 }}>
            Smoothing window
          </label>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{settings.smoothDays === 1 ? '1 day (each day lands on itself)' : `${settings.smoothDays} days`}</span>
        </div>
        <input id="overhead-dial-smooth" type="range" min={1} max={OVERHEAD_SMOOTH_DAYS_MAX} step={1} value={settings.smoothDays} onChange={(e) => set({ smoothDays: Number(e.target.value) })} style={{ width: '100%', accentColor: '#2563eb' }} />
        <div style={dialWhy}>Each day's office cost is shared by the field hours worked over the next N days (and, for the carry slice, by the jobs open on them). Past ~30 the window stops mattering.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={dialHead}>
          <label htmlFor="overhead-dial-carry" style={{ fontWeight: 600 }}>
            Carry share
          </label>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(settings.carryShare * 100)}%</span>
        </div>
        <input id="overhead-dial-carry" type="range" min={0} max={100} step={5} value={Math.round(settings.carryShare * 100)} onChange={(e) => set({ carryShare: Number(e.target.value) / 100 })} style={{ width: '100%', accentColor: '#d97706' }} />
        <div style={dialWhy}>The slice of the pool open jobs carry equally per day just for being open. The rest follows field hours. At 0% an open job is never charged.</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', fontSize: '0.82rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Idle cap</span>
          <span style={segWrap} role="group" aria-label="Idle cap">
            {OVERHEAD_IDLE_CAP_OPTIONS.map((o, i) => (
              <button key={String(o.key)} type="button" title={o.title} aria-pressed={settings.idleCapDays === o.key} onClick={() => set({ idleCapDays: o.key })} style={segBtn(settings.idleCapDays === o.key, i === OVERHEAD_IDLE_CAP_OPTIONS.length - 1)}>
                {o.label}
              </button>
            ))}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Open means</span>
          <span style={segWrap} role="group" aria-label="Open means">
            {OVERHEAD_OPEN_DEFINITIONS.map((o, i) => (
              <button key={o.key} type="button" title={o.title} aria-pressed={settings.openDef === o.key} onClick={() => set({ openDef: o.key })} style={segBtn(settings.openDef === o.key, i === OVERHEAD_OPEN_DEFINITIONS.length - 1)}>
                {o.label}
              </button>
            ))}
          </span>
        </span>
      </div>
      <div style={dialWhy}>An open job stops carrying after the cap's days with no field time (a fresh job gets the same grace from its start), so a forgotten Working job cannot carry for months.</div>

      {hygiene ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(6.5rem, 1fr))', gap: '0.4rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)' }}>
          <div>
            <div style={reconK}>Pool</div>
            <div style={reconV}>{money(hygiene.poolUsd)}</div>
          </div>
          <div>
            <div style={reconK}>By hours</div>
            <div style={reconV}>{money(hygiene.activityUsd)}</div>
          </div>
          <div>
            <div style={reconK}>Carry</div>
            <div style={reconV}>{money(hygiene.carryUsd)}</div>
          </div>
          <div>
            <div style={reconK}>Nobody</div>
            <div style={reconV}>{money(hygiene.unallocatedUsd)}</div>
          </div>
          <div>
            <div style={reconK}>In flight</div>
            <div style={reconV}>{money(hygiene.inFlightUsd)}</div>
          </div>
          <div>
            <div style={reconK}>Ties?</div>
            <div style={{ ...reconV, color: hygiene.reconciles ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{hygiene.reconciles ? 'to the dollar' : 'off'}</div>
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            pool{hygiene.carriedInUsd > 0.5 ? ` + ${money(hygiene.carriedInUsd)} carried in from before the window` : ''} = by hours + carry + nobody to charge + in flight · this Worked-in window
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <button type="button" style={btn} onClick={() => onExplore(OVERHEAD_ALLOCATION_RECOMMENDED)} title={overheadAllocationLabel(OVERHEAD_ALLOCATION_RECOMMENDED)}>
          Recommended
        </button>
        <button type="button" style={btn} onClick={() => onExplore(OVERHEAD_ALLOCATION_LEGACY)} title={overheadAllocationLabel(OVERHEAD_ALLOCATION_LEGACY)}>
          Original day-share
        </button>
        {isOverride ? (
          <button type="button" style={btn} onClick={() => onExplore(null)} title={`App default: ${overheadAllocationLabel(appDefault)}`}>
            Back to the app default
          </button>
        ) : null}
        <span style={{ flex: 1 }} />
        {isAppDefault ? (
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>This is the app default.</span>
        ) : confirmSave ? (
          <>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-700)' }}>Replace the app default for everyone? True profit changes on every Job Summary.</span>
            <button type="button" style={btnPrimary} disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Yes, use for everyone'}
            </button>
            <button type="button" style={btn} disabled={saving} onClick={() => setConfirmSave(false)}>
              Not yet
            </button>
          </>
        ) : (
          <button type="button" style={btnPrimary} disabled={saving} onClick={() => setConfirmSave(true)}>
            Use for everyone
          </button>
        )}
      </div>
      {error ? <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{error}</div> : null}
    </div>
  )
}
