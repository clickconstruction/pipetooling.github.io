import type { CSSProperties } from 'react'
import type { Light } from '../../lib/bridge/headline'
import { shortK } from '../../lib/bridge/headline'
import type { MondaySheet, SheetRow } from '../../lib/bridge/mondaySheet'

/** The Monday sheet (v2.5224): one screen, three lights, five moves — the Bridge's reading as a sheet, with a button that emails it to you. */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', minWidth: 0 }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.7rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const DOT: Record<Light['tone'], string> = { green: '#1e7f4f', red: '#b42318', amber: '#b7791f', none: 'var(--border)' }
const TONE: Record<Light['tone'], string> = { green: 'var(--text-green-700)', red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', none: 'var(--text)' }

function Rows({ rows }: { rows: SheetRow[] }) {
  if (rows.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.8rem', marginTop: '0.4rem' }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{r.label}</span>
          <b style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.value}</b>
        </div>
      ))}
    </div>
  )
}

function Tile({ title, t, children }: { title: string; t: { tone: Light['tone']; lead: string; sub: string; verdict: string }; children?: React.ReactNode }) {
  const [head, ...rest] = t.verdict.split(':')
  return (
    <div style={panel} data-testid={`sheet-tile-${t.tone}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: DOT[t.tone] }} />
        <span style={label}>{title}</span>
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums', color: TONE[t.tone] }}>{t.lead}</div>
      <div style={det}>{t.sub}</div>
      {children}
      <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
        <b>{head}:</b>
        {rest.join(':')}
      </div>
    </div>
  )
}

export function BridgeMondaySheet(props: { sheet: MondaySheet; emailing: boolean; onEmail: () => void; onFull: () => void; mailNote: string | null }) {
  const { sheet } = props
  const bars = sheet.contribution.bars
  const max = Math.max(1, ...bars.map((w) => Math.abs(w.recordedUsd ?? 0)))
  return (
    <div data-testid="bridge-monday-sheet" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={det}>{sheet.weekLine} · one screen, three lights, five moves</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {props.mailNote ? <span style={det}>{props.mailNote}</span> : null}
          <button type="button" onClick={props.onEmail} disabled={props.emailing} style={btn} data-testid="sheet-email-me">
            {props.emailing ? 'Sending…' : 'Email me this sheet'}
          </button>
          <button type="button" onClick={props.onFull} style={btn}>
            Open the full Bridge
          </button>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
        <Tile title="Contribution per week" t={sheet.contribution}>
          {bars.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: 4, alignItems: 'end', height: 54, marginTop: '0.4rem' }}>
              {bars.map((w) => {
                const usd = w.recordedUsd ?? 0
                const h = Math.max(2, Math.round((Math.abs(usd) / max) * 48))
                return <div key={w.start} title={`${w.label}: ${w.recordedUsd == null ? '—' : shortK(w.recordedUsd)}${w.waiting ? ' ≈' : ''}`} style={{ height: h, background: w.waiting ? '#bfdbfe' : usd < 0 ? 'var(--text-red-600)' : '#2563eb', borderRadius: '3px 3px 0 0' }} />
              })}
            </div>
          )}
        </Tile>
        <Tile title="Net position · 8 weeks" t={sheet.net}>
          <Rows rows={sheet.net.rows} />
        </Tile>
        <Tile title="Cash · lowest point" t={sheet.cash}>
          <Rows rows={sheet.cash.rows} />
        </Tile>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.6rem' }}>
        <div style={panel}>
          <div style={label}>Five moves this week</div>
          {sheet.moves.length === 0 ? (
            <div style={{ ...det, marginTop: 6 }}>nothing to move today</div>
          ) : (
            <ol style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
              {sheet.moves.map((m, i) => (
                <li key={m.key + m.title} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ ...det, fontWeight: 700, width: 16, flex: '0 0 auto' }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{m.title}</b> <span style={det}>· {m.why}</span>
                  </span>
                  <b style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: m.leverTone === 'green' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{m.lever}</b>
                </li>
              ))}
            </ol>
          )}
        </div>
        {sheet.link.length > 0 && (
          <div style={panel} data-testid="bridge-sheet-link">
            <div style={label}>The weakest link</div>
            <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
              {sheet.link.map((p) => (
                <li key={p} style={{ padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={panel}>
          <div style={label}>People, this pay week</div>
          {sheet.people.length === 0 ? (
            <div style={{ ...det, marginTop: 6 }}>no rows yet</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
              {sheet.people.map((p) => (
                <li key={p} style={{ padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div style={det}>{sheet.footer}</div>
    </div>
  )
}
