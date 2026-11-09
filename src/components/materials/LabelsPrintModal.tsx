/**
 * Print labels (punch list #209; its own file since v2.6801, punch list #294): the window the office prints a job's
 * box labels from, portalled to <body> and printed alone at full size (`printRootCss`, v2.6432). Two formats, remembered
 * on the device: **Sheet**, one Letter page per box with the stencil, the QR and the ruled lines to write on; **Tape**,
 * one strip per box at the tape's size for a Brother P-touch through the printer's own driver, the QR, the stencil, the
 * code with its dash and *Scan for what is inside*. A tick leaves a box out; the press names its count. **Export the
 * labels as a CSV** (v2.6800) writes one row per box for Brother's P-touch Editor.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { boxAddressWords, boxCodeWords, boxUrl, labelRows } from '../../lib/materials/labels'
import { labelsCsvFileName, labelsCsvRows, labelsCsvText } from '../../lib/materials/labelsCsv'
import { readLabelFormat, readTapeWidth, writeLabelFormat, writeTapeWidth } from '../../lib/materials/labelPrefs'
import { linesOf, type Container, type ContainerLine } from '../../lib/materials/onSite'
import { downloadFile } from '../../lib/materials/photoShare'
import { printRootCss } from '../../lib/printRoot'
import { TAPE_WIDTHS_MM, TAPE_WORDS, sheetPressLabel, tapeHintWords, tapeLayout, tapePressLabel, tapePrintCss, type LabelFormat, type TapeWidthMm } from '../../lib/materials/tapeLabel'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const chip = (on: boolean): CSSProperties => ({ ...btn, minHeight: 32, borderRadius: 999, fontSize: '0.8rem', ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) })

type Props = {
  jobLabel: string
  containers: Container[]
  lines: ContainerLine[]
  places: ReadonlyArray<{ id: string; name: string }>
  /** One box (the panel's Label press, the phone's link), or null for every box. */
  only: string | null
  onClose: () => void
  /** The print itself; a test hands a spy. */
  print?: () => void
}

export default function LabelsPrintModal({ jobLabel: jl, containers, lines, places, only, onClose, print = () => window.print() }: Props) {
  const candidates = useMemo(() => (only ? containers.filter((c) => c.id === only) : containers), [containers, only])
  const one = candidates.length === 1 ? candidates[0] : null
  const [format, setFormatState] = useState<LabelFormat>(() => readLabelFormat())
  const [width, setWidthState] = useState<TapeWidthMm>(() => readTapeWidth())
  const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set())
  const setFormat = (f: LabelFormat) => { setFormatState(f); writeLabelFormat(f) }
  const setWidth = (w: TapeWidthMm) => { setWidthState(w); writeTapeWidth(w) }
  const shown = candidates.filter((c) => !left.has(c.id))
  const toggle = (id: string) => setLeft((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const tape = format === 'tape'
  const layout = tapeLayout(width)
  const pressLabel = tape ? tapePressLabel(shown.length) : sheetPressLabel(shown.length)
  const dead = shown.length === 0
  const lth: CSSProperties = { textAlign: 'left', padding: '0.2rem 0.3rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-700)', borderBottom: '2px solid #111827' }
  /** Rows tall enough for a pen on paper: about 8 mm printed. */
  const cell: CSSProperties = { borderBottom: '1px solid var(--border-400)', padding: '0 0.3rem', height: '1.9rem', fontSize: '0.84rem', verticalAlign: 'bottom', color: 'var(--text-strong)' }
  const exportCsv = () => {
    const rows = labelsCsvRows(containers, places)
    downloadFile(new File([labelsCsvText(rows)], labelsCsvFileName(jl, new Date().toISOString().slice(0, 10)), { type: 'text/csv' }))
  }
  return createPortal(
    <div className="on-site-labels" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      {/* Printing draws the labels alone at full size. The window sits on <body> (a portal) and print takes everything else on <body> out of the layout (lib/printRoot.ts), so the page behind can neither show on the paper nor shrink it, and every label prints (v2.6432). The tape's rules come after, so its @page wins. */}
      <style>{`${printRootCss('on-site-labels')} @media print { .on-site-labels-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; } .on-site-labels-chrome, .on-site-labels-pick { display: none !important; } .on-site-labels-list { display: block !important; } .on-site-label { break-inside: avoid; page-break-inside: avoid; border-radius: 0 !important; } .on-site-label + .on-site-label { break-before: page; page-break-before: always; } }${tape ? ` ${tapePrintCss(width, 'on-site-tape')}` : ''}`}</style>
      <div role="dialog" aria-modal="true" aria-label={one ? `Print the label for ${one.label}` : 'Print labels'} className="on-site-labels-dialog" data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="on-site-labels-chrome" style={{ display: 'grid', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{one ? `Label · ${one.label}` : `Labels · ${jl}`}</h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{tape ? tapeHintWords(width) : one ? 'One sheet: the stencil, the code, and the lines to write on.' : `${shown.length} ${shown.length === 1 ? 'label' : 'labels'}, one a sheet. The camera opens the box from the code.`}</span>
            </div>
            <span style={{ display: 'inline-flex', gap: '0.3rem' }} role="group" aria-label="Label format">
              <button type="button" aria-pressed={!tape} style={chip(!tape)} onClick={() => setFormat('sheet')}>Sheet</button>
              <button type="button" aria-pressed={tape} style={chip(tape)} onClick={() => setFormat('tape')}>Tape</button>
            </span>
            {tape ? (
              <span style={{ display: 'inline-flex', gap: '0.3rem' }} role="group" aria-label="Tape width">
                {TAPE_WIDTHS_MM.map((w) => <button key={w} type="button" aria-pressed={width === w} style={chip(width === w)} onClick={() => setWidth(w)}>{w} mm</button>)}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" disabled={dead} aria-disabled={dead} style={{ ...btnPrimary, ...(dead ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) }} onClick={() => { if (!dead) print() }} data-testid="labels-print">{pressLabel}</button>
            {/* v2.6800 (punch list #294): one row per box for Brother's P-touch Editor, which merges a CSV into a tape label template. */}
            {one ? null : <button type="button" style={btn} title="One row per cage or box: the stencil, the place, the code with its dash, the address and the QR's text, for a label editor that merges a CSV" onClick={exportCsv}>Export the labels as a CSV</button>}
            <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={onClose}>Close</button>
          </div>
        </div>
        {one ? null : (
          <div className="on-site-labels-pick" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }} aria-label="Boxes to print">
            {candidates.map((c) => {
              const on = !left.has(c.id)
              return <button key={c.id} type="button" aria-pressed={on} style={chip(on)} onClick={() => toggle(c.id)} data-testid="labels-pick">{c.label}</button>
            })}
          </div>
        )}
        <div className="on-site-labels-list" style={{ display: 'grid', gap: '0.9rem', ...(tape ? { justifyItems: 'start' } : {}) }}>
          {shown.map((c) => {
            const place = places.find((p) => p.id === c.locationId)?.name ?? ''
            const kind = c.kind === 'box' ? 'box' : c.kind === 'cage' ? 'cage' : 'pile'
            if (tape) {
              return (
                <div key={c.id} className="on-site-tape" data-testid="labels-tape" style={{ width: `${layout.lengthMm}mm`, height: `${layout.widthMm}mm`, boxSizing: 'border-box', padding: `${layout.padMm}mm`, display: 'grid', gridTemplateColumns: `${layout.qrMm}mm 1fr`, alignItems: 'center', gap: `${layout.padMm}mm`, background: 'var(--surface)', color: '#000', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <QRCodeSVG value={boxUrl(c.id)} size={96} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={4} style={{ width: `${layout.qrMm}mm`, height: `${layout.qrMm}mm`, display: 'block' }} />
                  <div style={{ minWidth: 0, display: 'grid', alignContent: 'center' }}>
                    <div style={{ fontSize: `${layout.stencilMm}mm`, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
                    <div style={{ fontSize: `${layout.codeMm}mm`, lineHeight: 1.1, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: `${layout.padMm}mm` }}>{boxAddressWords(c.id).toUpperCase()}</div>
                    <div style={{ fontSize: `${layout.wordsMm}mm`, lineHeight: 1.1 }}>{TAPE_WORDS}</div>
                  </div>
                </div>
              )
            }
            const rows = labelRows(linesOf(lines, c.id))
            return (
              <div key={c.id} className="on-site-label" data-testid="labels-sheet" style={{ border: '2px solid #111827', borderRadius: 10, padding: '0.9rem 1rem', display: 'grid', gap: '0.7rem', breakInside: 'avoid' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 104px', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '3.4rem', fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em' }}>{c.label}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.4rem' }}>{jl}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>{c.kind}{place ? ` · ${place}` : ''}{c.where ? ` · ${c.where}` : ''}</div>
                  </div>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                    <QRCodeSVG value={boxUrl(c.id)} size={96} level="M" bgColor="#ffffff" fgColor="#111111" marginSize={1} />
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-700)' }}>{boxCodeWords(c.id)}</div>
                  </div>
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead><tr><th style={lth}>In this {kind}</th><th style={{ ...lth, width: 64, textAlign: 'right' }}>On hand</th><th style={{ ...lth, width: 80, textAlign: 'right' }}>Counted</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={cell}>{r ? <>{r.partName}{r.manufacturer ? <span style={{ color: 'var(--text-muted)' }}> · {r.manufacturer}</span> : null}</> : null}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r ? r.onHand : null}</td>
                        <td style={cell}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Scan the code to open this {kind} on your phone, or go to {boxAddressWords(c.id)}. Write what you add on a blank line.</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
