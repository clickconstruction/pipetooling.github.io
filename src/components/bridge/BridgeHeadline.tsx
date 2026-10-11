import type { CSSProperties } from 'react'
import type { Headline, HeadlineWeek, Light } from '../../lib/bridge/headline'
import { shortK } from '../../lib/bridge/headline'

/**
 * The Bridge's top line (v2.5216): field contribution per pay week — the
 * number the company maximizes — with the last eight weeks as bars, a
 * verdict sentence, and the two constraints as lights. Recorded time is the
 * headline; weeks still waiting on approvals are hatched and marked ≈.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`

const TONE: Record<Light['tone'], string> = { green: 'var(--text-green-700)', red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', none: 'var(--text-muted)' }
const DOT: Record<Light['tone'], string> = { green: '#1e7f4f', red: '#b42318', amber: '#b7791f', none: 'var(--border)' }

function Bars({ weeks }: { weeks: HeadlineWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => Math.abs(w.recordedUsd ?? 0)))
  return (
    <div data-testid="bridge-headline-bars">
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 96 }}>
        {weeks.map((w) => {
          const usd = w.recordedUsd
          const h = usd == null ? 0 : Math.max(2, Math.round((Math.abs(usd) / max) * 72))
          const neg = (usd ?? 0) < 0
          const fill = neg ? 'var(--text-red-600)' : '#2563eb'
          const style: CSSProperties = w.waiting
            ? { height: h, background: `repeating-linear-gradient(135deg, ${neg ? '#fca5a5' : '#93c5fd'} 0 4px, var(--surface) 4px 8px)`, border: `1px dashed ${fill}`, borderBottom: 0, boxSizing: 'border-box' }
            : { height: h, background: fill }
          return (
            <div key={w.start} title={`${w.label}: ${usd == null ? 'no field hours' : shortK(usd)} on ${hrs(w.recordedHours)}${w.pendingHours > 0 ? `, ${hrs(w.pendingHours)} waiting` : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%' }}>
              <div style={{ fontSize: '0.66rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {usd == null ? '—' : shortK(usd)}
                {w.waiting ? ' ≈' : ''}
              </div>
              <div style={{ width: '100%', borderRadius: '3px 3px 0 0', ...style }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))`, gap: 6, fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
        {weeks.map((w) => (
          <div key={w.start} style={{ whiteSpace: 'nowrap' }}>
            {w.label}
            {w.current ? '…' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function LightRow({ light }: { light: Light }) {
  return (
    <div style={{ flex: '1 1 300px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', minWidth: 0 }} data-testid={`bridge-light-${light.tone}`}>
      <span aria-hidden style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: DOT[light.tone], marginTop: 4, flex: '0 0 auto' }} />
      <div style={{ fontSize: '0.85rem', minWidth: 0 }}>
        <b>{light.title}:</b> <span style={{ fontWeight: 700, color: TONE[light.tone] }}>{light.lead}</span>
        {light.sentence ? <span style={{ color: 'var(--text-muted)' }}> {light.sentence}</span> : null}
      </div>
    </div>
  )
}

export function BridgeHeadline(props: { headline: Headline | null; loading: boolean; error: string | null; net: Light; cash: Light }) {
  const { headline: h } = props
  const tw = h?.thisWeek ?? null
  const bigUsd = tw?.recordedUsd ?? null
  return (
    <div style={{ ...panel, marginTop: '0.6rem' }} data-testid="bridge-headline">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>What we maximize — field contribution per week</span>
        <span style={det}>earned at the job's contract ÷ expected hours, less wages · pay weeks Sun–Sat · recorded time, ≈ where hours still wait</span>
      </div>
      {props.error ? <p style={{ color: 'var(--text-red-700)', margin: '0.4rem 0 0' }}>{props.error}</p> : null}
      {!h ? (
        <div style={{ ...det, padding: '1rem 0' }}>{props.loading ? 'Reading the last 13 pay weeks…' : '—'}</div>
      ) : (
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: bigUsd != null && bigUsd < 0 ? 'var(--text-red-700)' : 'var(--text)' }} data-testid="bridge-headline-number">
              {bigUsd == null ? '—' : `${bigUsd >= 0 ? '+' : ''}${shortK(bigUsd)}`}
              {tw?.waiting ? <span style={{ color: 'var(--text-amber-800)' }}> ≈</span> : null}
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                {' '}
                {tw?.current ? 'this week so far' : 'this week'}
                {tw ? `, ${hrs(tw.recordedHours)} recorded` : ''}
              </span>
            </div>
            {tw && (
              <div style={det}>
                approved only: <b style={{ color: 'var(--text)' }}>{tw.approvedUsd == null ? '—' : `${tw.approvedUsd >= 0 ? '+' : ''}${shortK(tw.approvedUsd)}`}</b> on {hrs(tw.approvedHours)}
                {tw.pendingHours > 0 ? <> · <span style={{ color: 'var(--text-amber-800)' }}>{hrs(tw.pendingHours)} of this week's hours still wait on approval</span></> : null}
              </div>
            )}
            <div style={{ background: 'var(--bg-blue-tint, var(--surface-2, transparent))', border: '1px solid var(--border)', borderRadius: 7, padding: '0.45rem 0.6rem', fontSize: '0.88rem' }} data-testid="bridge-headline-verdict">
              <b>Verdict:</b> {h.verdict}
            </div>
          </div>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <div style={{ ...det, marginBottom: 4 }}>Last {h.weeks.length} pay weeks, recorded time (hatched = hours still waiting)</div>
            <Bars weeks={h.weeks} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <LightRow light={props.net} />
        <LightRow light={props.cash} />
      </div>
    </div>
  )
}
