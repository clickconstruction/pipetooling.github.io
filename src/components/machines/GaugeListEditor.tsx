/**
 * Equipment pre-use check (punch list #270): a list of gauges edited in place, each drawn small the way the check
 * sheet draws it: what it holds, which of the four looks, where on the machine to read it. The fleet card's Gauges
 * and the Settings template editor both draw this; the host keeps the list and saves it.
 */
import { type CSSProperties } from 'react'
import { GAUGE_LOOKS, GAUGE_LOOK_WORDS, fluidColor, gaugePreset, type GaugeLook, type LevelDef } from '../../lib/machines/machines'
import { LevelGauge } from './LevelGauge'

const press: CSSProperties = { minHeight: 36, padding: '0 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }
const field: CSSProperties = { minHeight: 36, padding: '0.3rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }

export function GaugeListEditor({ levels, onChange, disabled }: { levels: LevelDef[]; onChange: (levels: LevelDef[]) => void; disabled?: boolean }) {
  function patch(key: string, change: Partial<LevelDef>) {
    onChange(levels.map((d) => (d.key === key ? { ...d, ...change } : d)))
  }
  function setLook(d: LevelDef, look: GaugeLook) {
    const p = gaugePreset(look, d.name, d.where, d.key)
    patch(d.key, { look, marks: p.marks, lowBelow: p.lowBelow })
  }
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }} data-gauge-list={levels.length}>
      {levels.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing to read on this one. Add a gauge if it has a tank, a glass, a stick or a dial.</p> : null}
      {levels.map((d) => (
        <div key={d.key} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.5rem 0.75rem', alignItems: 'start', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }} data-gauge-row={d.name}>
          <LevelGauge def={d} value={d.look === 'dial' ? 70 : (d.marks.find((m) => m.line)?.at ?? 70)} last={undefined} readOnly onChange={() => {}} small />
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.4rem' }}>
              <input value={d.name} disabled={disabled} onChange={(e) => patch(d.key, { name: e.target.value, color: fluidColor(e.target.value) })} aria-label="What it holds" placeholder="What it holds, like Fuel" style={field} />
              <button type="button" style={{ ...press, color: 'var(--text-muted)' }} disabled={disabled} onClick={() => onChange(levels.filter((x) => x.key !== d.key))}>
                Remove
              </button>
            </div>
            <input value={d.where} disabled={disabled} onChange={(e) => patch(d.key, { where: e.target.value })} aria-label="Where to read it" placeholder="Where to read it, like Sight glass behind the cab" style={field} />
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="radiogroup" aria-label="What it looks like">
              {GAUGE_LOOKS.map((look) => {
                const on = d.look === look
                return (
                  <button key={look} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => setLook(d, look)} style={{ ...press, minHeight: 32, fontSize: '0.75rem', ...(on ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb' } : {}) }} title={GAUGE_LOOK_WORDS[look].how}>
                    {GAUGE_LOOK_WORDS[look].name}
                  </button>
                )
              })}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{GAUGE_LOOK_WORDS[d.look].how}</span>
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Add a gauge:</span>
        {GAUGE_LOOKS.map((look) => (
          <button key={look} type="button" style={press} disabled={disabled} onClick={() => onChange([...levels, gaugePreset(look, '', '')])}>
            + {GAUGE_LOOK_WORDS[look].name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default GaugeListEditor
