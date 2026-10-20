import { useState, type CSSProperties } from 'react'
import type { WeekCard } from '../../lib/bridge/weekCard'
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

function WeekCardPopover({ card, index, count }: { card: WeekCard; index: number; count: number }) {
  const left = ((index + 0.5) / Math.max(1, count)) * 100
  const shift = index <= 1 ? '0' : index >= count - 2 ? '-100%' : '-50%'
  return (
    <div role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: `${Math.max(0, Math.min(100, left))}%`, transform: `translateX(${shift})`, zIndex: 30, width: 360, maxWidth: '100%', background: 'var(--text-base)', color: 'var(--surface)', padding: '0.6rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} data-testid="bridge-week-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <b style={{ fontSize: '0.9rem' }}>{card.title}</b>
        <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{card.contribution}</span>
      </div>
      <div style={{ opacity: 0.85 }}>
        earned <b>{card.earned}</b> − field wages <b>{card.wages}</b>
      </div>
      <div style={{ opacity: 0.85 }}>{card.effort}</div>
      {card.jobs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px auto', gap: '3px 10px', alignItems: 'center', paddingTop: 6, marginTop: 2, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          {card.jobs.map((j) => (
            <span key={j.label} style={{ display: 'contents' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.label}</span>
              <span aria-hidden style={{ height: 8, borderRadius: 4, background: '#60a5fa', width: `${Math.round(j.share * 100)}%` }} />
              <b style={{ whiteSpace: 'nowrap' }}>{j.usd}</b>
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.18)', color: card.footTone === 'amber' ? '#fde68a' : undefined, fontWeight: card.footTone === 'amber' ? 600 : undefined, opacity: card.footTone === 'amber' ? 1 : 0.85 }}>{card.foot}</div>
    </div>
  )
}

function Bars({ weeks, cards }: { weeks: HeadlineWeek[]; cards?: WeekCard[] }) {
  const max = Math.max(1, ...weeks.map((w) => Math.abs(w.recordedUsd ?? 0)))
  const [hover, setHover] = useState<number | null>(null)
  const [pin, setPin] = useState<number | null>(null)
  const open = pin ?? hover
  const card = open != null && cards ? cards[open] ?? null : null
  return (
    <div data-testid="bridge-headline-bars" style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 96 }}>
        {weeks.map((w, i) => {
          const usd = w.recordedUsd
          const h = usd == null ? 0 : Math.max(2, Math.round((Math.abs(usd) / max) * 72))
          const neg = (usd ?? 0) < 0
          const fill = neg ? 'var(--text-red-600)' : '#2563eb'
          const style: CSSProperties = w.waiting
            ? { height: h, background: `repeating-linear-gradient(135deg, ${neg ? '#fca5a5' : '#93c5fd'} 0 4px, var(--surface) 4px 8px)`, border: `1px dashed ${fill}`, borderBottom: 0, boxSizing: 'border-box' }
            : { height: h, background: fill }
          const isOpen = open === i
          const Tag = cards ? 'button' : 'div'
          return (
            <Tag
              key={w.start}
              {...(cards ? { type: 'button' as const, onMouseEnter: () => setHover(i), onFocus: () => setHover(i), onBlur: () => setHover(null), onClick: () => setPin((p) => (p === i ? null : i)), 'aria-label': cards[i]?.aria ?? w.label, 'aria-expanded': isOpen } : { title: `${w.label}: ${usd == null ? 'no field hours' : shortK(usd)} on ${hrs(w.recordedHours)}${w.pendingHours > 0 ? `, ${hrs(w.pendingHours)} waiting` : ''}` })}
              data-testid={`bridge-headline-bar-${w.start}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%', font: 'inherit', color: 'inherit', background: 'none', border: 0, padding: 0, borderRadius: 6, cursor: cards ? 'pointer' : undefined, outline: isOpen ? '2px solid #2563eb' : undefined, outlineOffset: 2 }}
            >
              <div style={{ fontSize: '0.66rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {usd == null ? '—' : shortK(usd)}
                {w.waiting ? ' ≈' : ''}
              </div>
              <div style={{ width: '100%', borderRadius: '3px 3px 0 0', ...style }} />
            </Tag>
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
      {card && open != null && <WeekCardPopover card={card} index={open} count={weeks.length} />}
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

export function BridgeHeadline(props: { headline: Headline | null; loading: boolean; error: string | null; net: Light; cash: Light; cards?: WeekCard[] }) {
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
            <div style={{ background: 'var(--bg-blue-tint, transparent)', border: '1px solid var(--border)', borderRadius: 7, padding: '0.45rem 0.6rem', fontSize: '0.88rem' }} data-testid="bridge-headline-verdict">
              <b>Verdict:</b> {h.verdict}
            </div>
          </div>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <div style={{ ...det, marginBottom: 4 }}>Last {h.weeks.length} pay weeks, recorded time (hatched = hours still waiting)</div>
            <Bars weeks={h.weeks} cards={props.cards} />
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
