/** Settings → Data & recovery → "Labor burden factor (dev)" (Taunya, 2026-11-27): what the factor is, what it stands
 * for, where it reaches and where it does not. Read only: it reads `app_settings.labor_burden_factor_v1` once it is
 * opened and changes nothing. The words and the reads that confirm each line are lib/laborBurdenWords.ts. It draws
 * nothing for any role but a dev, like the sibling sections. */
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1, parseLaborBurdenFactor } from '../../lib/appSettingsKeys'
import { LABOR_BURDEN_TITLE, LABOR_BURDEN_WORDS as W, laborBurdenExample, laborBurdenFigure } from '../../lib/laborBurdenWords'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/** The factor as the database holds it, through the app's own parser. */
async function readFactor(): Promise<number> {
  const { data, error } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1).maybeSingle()
  if (error) throw error
  return parseLaborBurdenFactor((data as { value_num: number | null } | null)?.value_num ?? null)
}

export default function LaborBurdenSettingsBlock({ role, read = readFactor }: { role: string | null | undefined; read?: () => Promise<number> }) {
  const [open, setOpen] = useState(false)
  /** The factor read; null before a read lands and after one that failed. */
  const [factor, setFactor] = useState<number | null>(null)
  const [readWhy, setReadWhy] = useState('')
  const drawn = role === 'dev'

  useEffect(() => {
    if (!drawn || !open) return
    let live = true
    setReadWhy('')
    read().then(
      (n) => {
        if (live) setFactor(n)
      },
      (e: unknown) => {
        if (live) {
          setFactor(null)
          setReadWhy(formatErrorMessage(e, W.readFailed))
        }
      },
    )
    return () => {
      live = false
    }
  }, [drawn, open, read])

  if (!drawn) return null

  const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.875rem' }
  const head: CSSProperties = { margin: '0.9rem 0 0.3rem', fontSize: '0.875rem', fontWeight: 700 }
  const list: CSSProperties = { margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem', display: 'grid', gap: '0.2rem' }
  return (
    <div data-testid="labor-burden-block" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textAlign: 'left', color: 'var(--text-base)' }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        {LABOR_BURDEN_TITLE}
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          {readWhy ? (
            <p style={{ ...muted, margin: '0.75rem 0', color: 'var(--text-red-700)' }} role="alert" data-testid="labor-burden-read-why">
              {readWhy}
            </p>
          ) : null}
          {factor != null ? (
            <div style={{ fontSize: '0.875rem', marginTop: '0.75rem' }} data-testid="labor-burden-figure">
              <ValueLines>
                <ValueLine label="The factor">
                  <WorkedOutValue>{laborBurdenFigure(factor)}</WorkedOutValue>
                </ValueLine>
              </ValueLines>
            </div>
          ) : !readWhy ? (
            <p style={{ ...muted, margin: '0.75rem 0' }}>{W.reading}</p>
          ) : null}
          <p style={{ ...muted, margin: '0.75rem 0 0' }}>{W.what}</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', fontWeight: 600 }} data-testid="labor-burden-stands-for">
            {W.standsFor}
          </p>
          {factor != null ? <p style={{ ...muted, margin: '0.35rem 0 0' }}>{laborBurdenExample(factor)}</p> : null}
          <p style={{ ...muted, margin: '0.35rem 0 0' }}>{W.notOverhead}</p>
          <h4 style={head}>{W.reachesHead}</h4>
          <ul style={list} data-testid="labor-burden-reaches">
            {W.reaches.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h4 style={head}>{W.notHead}</h4>
          <ul style={{ ...list, color: 'var(--text-muted)' }} data-testid="labor-burden-not">
            {W.not.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p style={{ ...muted, margin: '0.9rem 0 0' }}>{W.change}</p>
        </div>
      ) : null}
    </div>
  )
}
