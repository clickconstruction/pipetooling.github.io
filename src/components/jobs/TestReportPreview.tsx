import type { CSSProperties } from 'react'
import type { TestReportBlock, TestReportColumn } from '../../lib/jobs/testReport'

/**
 * The paper on screen (v2.3298): the kernel's block model rendered as HTML,
 * the same walk the jsPDF renderer does. Customer-facing → pinned light via the
 * portal palette, never theme tokens.
 */
const INK = '#16283c'
const MUTED = '#5a6b7e'
const HAIR = '#ddd6c8'
const COPPER = '#b0662f'
const GREEN = '#1f7a3a'
const RED = '#b42318'
/** The paper is white and its body ink dark grey regardless of the app theme — customer-facing, pinned light. */
const PAPER_WHITE = '#ffffff'
const BODY_INK = '#333333'

const sectionHead: CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER, borderBottom: `1px solid ${HAIR}`, paddingBottom: 2, margin: '12px 0 6px' }
const kvGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '112px 1fr', gap: '2px 10px', fontSize: 12 }
const kvLabel: CSSProperties = { color: MUTED }

function Column({ col }: { col: TestReportColumn }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...sectionHead, marginTop: 0 }}>{col.heading}</div>
      {(col.lines ?? []).map((l, i) => (
        <div key={`l${i}`} style={{ fontSize: 12 }}>{l}</div>
      ))}
      {col.rows.length ? (
        <div style={{ ...kvGrid, gridTemplateColumns: '72px 1fr', marginTop: col.lines?.length ? 4 : 0 }}>
          {col.rows.map((r, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <span style={kvLabel}>{r.label}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{r.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function TestReportPreview({ blocks, style }: { blocks: TestReportBlock[]; style?: CSSProperties }) {
  return (
    <div data-theme="light" style={{ background: PAPER_WHITE, color: INK, border: `1px solid ${HAIR}`, boxShadow: '0 2px 10px rgba(0,0,0,.06)', padding: '22px 24px', fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", lineHeight: 1.4, ...style }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'letterhead':
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: `3px solid ${COPPER}`, paddingBottom: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '0.1em' }}>{b.companyName.toUpperCase()}</div>
                  {b.tagline ? <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{b.tagline}</div> : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{[b.dateLabel, b.jobLabel].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            )
          case 'columns':
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 6 }}>
                <Column col={b.left} />
                <Column col={b.right} />
              </div>
            )
          case 'section':
            return <div key={i} style={sectionHead}>{b.text}</div>
          case 'kv':
            return (
              <div key={i} style={kvGrid}>
                {b.rows.map((r, j) => (
                  <div key={j} style={{ display: 'contents' }}>
                    <span style={kvLabel}>{r.label}</span>
                    <span style={{ fontWeight: r.label === 'Total' ? 700 : 400, overflowWrap: 'anywhere' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            )
          case 'verdict':
            return (
              <div key={i} style={{ fontSize: 12, margin: '2px 0 6px' }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: b.result === 'pass' ? GREEN : RED }}>{b.result.toUpperCase()}</span>
                <span> — {b.text}</span>
              </div>
            )
          case 'paragraph':
            return (
              <div key={i} style={{ fontSize: 12, margin: '4px 0 6px', whiteSpace: 'pre-line' }}>
                {b.label ? <div style={{ fontWeight: 700 }}>{b.label}:</div> : null}
                {b.text}
              </div>
            )
          case 'certification':
            return (
              <div key={i} style={{ fontSize: 11.5, color: BODY_INK, whiteSpace: 'pre-line', marginTop: 4 }}>
                {b.text}
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
