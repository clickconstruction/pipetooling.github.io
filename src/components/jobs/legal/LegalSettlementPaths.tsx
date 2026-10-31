import type { CSSProperties } from 'react'
import { MUTED, pill } from './legalDeskShared'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
import type { SettlementPath, SettlementPathPart, SettlementPaths } from '../../../lib/legal/settlementPaths'

/**
 * What each path nets (v2.6176, punch list #218 PR 3): the cards `settlementPaths` returns, under the
 * money bars — one per standing offer and one for collections and trial, every bar on the claim's
 * scale so the cards compare, the figure we keep, the rows under it, when, and a hard read's caveat.
 * Reads the kernel's fractions and words only. The fills are the money bars' (green keep, the red
 * hatch for the firm's cut, the filing red) plus a deeper red for the costs to try it and the neutral
 * hatch for the claim a settlement lets go; the saturated reds and green stay literal as the app
 * keeps its action colours, the neutrals are tokens.
 */

const HATCH_RED = 'repeating-linear-gradient(135deg, #fecaca 0 5px, #fee2e2 5px 10px)'
const HATCH_NEUTRAL = 'repeating-linear-gradient(135deg, var(--bg-200) 0 5px, var(--bg-muted) 5px 10px)'

function fill(part: SettlementPathPart): CSSProperties {
  switch (part.key) {
    case 'keep':
      return { background: 'var(--bg-green-200)', color: 'var(--text-green-800)' }
    case 'fee':
      return { background: HATCH_RED, color: '#b42318' }
    case 'filing':
      return { background: '#fca5a5', color: '#b42318' }
    case 'try':
      return { background: '#f87171', color: '#fff' }
    case 'letgo':
      return { background: HATCH_NEUTRAL, color: 'var(--text-muted)' }
  }
}

const SHORT: Record<SettlementPathPart['key'], string> = { keep: 'we keep', fee: 'firm', filing: 'filing', try: 'to try', letgo: 'let go' }

function PathCard({ path }: { path: SettlementPath }) {
  const chipTone = path.chip.tone === 'info' ? 'blue' : path.chip.tone
  return (
    <div data-legal-settlement-path={path.kind} style={{ border: `1px solid ${path.kind === 'trial' ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px', minWidth: 0, display: 'grid', gap: 4, alignContent: 'start', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.8rem' }}>{path.title}</b>
        {pill(path.chip.text, chipTone)}
      </div>
      <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
        {path.parts.map((p) => (
          <span key={p.key} data-legal-path-part={p.key} title={p.label} style={{ ...fill(p), flex: `${Math.max(p.fraction, 0.001)} 1 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', borderRight: '1px solid var(--surface)', minWidth: 0 }}>
            {p.fraction >= 0.12 ? SHORT[p.key] : ''}
          </span>
        ))}
        {/* The rest of the claim's scale, when the path's parts fall short of it (an offer under the claim with nothing let go is impossible, but a bar is a bar). */}
        <span aria-hidden style={{ flex: `${Math.max(0.001, 1 - path.parts.reduce((s, p) => s + p.fraction, 0))} 1 0`, minWidth: 0 }} />
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: path.keep < -0.004 ? '#b42318' : 'var(--text-strong)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {path.keep < -0.004 ? `${formatLegalMoney(-path.keep)} short` : formatLegalMoney(path.keep)}
        <span style={{ ...MUTED, display: 'block', fontSize: '0.66rem', fontWeight: 600 }}>{path.keep < -0.004 ? 'the costs exceed the claim' : path.kind === 'trial' ? 'we keep at a full win' : 'we keep'}</span>
      </div>
      <div style={{ display: 'grid', gap: 1, fontSize: '0.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={MUTED}>{path.kind === 'trial' ? 'the claim' : path.title === 'Settle at their offer' ? 'their offer' : 'our counter'}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(path.gross)}</span></div>
        {path.parts.filter((p) => p.key !== 'keep').map((p) => (
          <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={MUTED}>{p.label.replace(/ · \$[\d,.]+$/, '')}</span>
            <span style={{ color: p.key === 'letgo' ? 'var(--text-muted)' : '#b42318', fontVariantNumeric: 'tabular-nums' }}>{p.key === 'letgo' ? formatLegalMoney(p.amount) : `− ${formatLegalMoney(p.amount)}`}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-700)' }}>⏱ <b>{path.when}</b></div>
      {path.caveat ? <div data-legal-path-caveat style={{ fontSize: '0.7rem', color: '#9a6700' }}>{path.caveat}</div> : null}
    </div>
  )
}

export default function LegalSettlementPaths({ paths }: { paths: SettlementPaths }) {
  if (paths.paths.length === 0) return null
  return (
    <div data-legal-settlement-paths style={{ margin: '8px 0 0', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.72rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>What each path nets</span>
        <span style={MUTED}>every bar on the claim’s scale · the firm’s cut and costs taken off · when the money lands</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        {paths.paths.map((p) => <PathCard key={p.key} path={p} />)}
      </div>
      <div style={{ ...MUTED, fontSize: '0.72rem' }} data-legal-settlement-paths-words>{paths.words}</div>
    </div>
  )
}
