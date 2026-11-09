/**
 * Materials on site (punch list #209): **Print the manifest**. The office picks every cage and box
 * on the job or some of them, and prints one Letter page per container to laminate and hang on it:
 * the job and the site, the stencil, the day the manifest was printed, the day something was last
 * recorded in the container, every item with its number as the ledger reads it, and ruled lines at
 * the foot for what is added on site by hand, and the box's QR code, the same the label carries,
 * so the camera opens the box from the paper. Always light, large plain type, no colour the page
 * needs; printing draws the pages alone, as the labels do. A plain print: the labels file no sent
 * copy, and neither does this.
 *
 * The page model is `lib/materials/containerManifest.ts`.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { boxAddressWords, boxUrl, dashedCode } from '../../lib/materials/labels'
import { lastRecordedWords, manifestContainers, manifestDateWords, manifestPages, manifestPickWords, manifestPressWords, MANIFEST_ADDED_COLUMNS, MANIFEST_ADDED_HEADER, type ManifestPage } from '../../lib/materials/containerManifest'
import type { Container, ContainerLine, Movement, Place } from '../../lib/materials/onSite'
import { printRootCss } from '../../lib/printRoot'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 32, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }

/** The paper's own rule, dark on white: a printed page has no theme. */
const RULE = 'var(--text-strong)'
const thCell: CSSProperties = { textAlign: 'left', padding: '0.25rem 0.4rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-strong)', borderBottom: `2px solid ${RULE}` }
/** An item row a crew reads at arm's length through a laminated holder. */
const itemCell: CSSProperties = { borderBottom: '1px solid var(--border-400)', padding: '0.35rem 0.4rem', fontSize: '1.15rem', color: 'var(--text-strong)', verticalAlign: 'middle' }
/** A ruled line tall enough for a pen on paper: about 12 mm printed. */
const penCell: CSSProperties = { borderBottom: `1px solid ${RULE}`, height: '2.75rem', padding: 0 }

type Props = {
  jobLabel: string
  site: string
  containers: ReadonlyArray<Container>
  lines: ReadonlyArray<ContainerLine>
  movements: ReadonlyArray<Movement>
  places: ReadonlyArray<Pick<Place, 'id' | 'name'>>
  /** The container the window opens on alone (the phone's link), or null for every one. */
  only: string | null
  onClose: () => void
  /** The print call, `window.print` in the app; a test hands in a spy. */
  print?: () => void
}

export default function ManifestPrintModal({ jobLabel, site, containers, lines, movements, places, only, onClose, print = () => window.print() }: Props) {
  const all = useMemo(() => manifestContainers(containers, 'all'), [containers])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(only ? [only] : all.map((c) => c.id)))
  const pages = useMemo(() => manifestPages({ containers, pick: [...picked], lines, movements, places, job: jobLabel, site, now: new Date() }), [containers, picked, lines, movements, places, jobLabel, site])
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pressWords = manifestPressWords(pages.length)
  return createPortal(
    <div className="on-site-manifest" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      {/* Printing draws the pages alone at full size, one a sheet of Letter. The window sits on <body> (a portal) and print takes everything else on <body> out of the layout (lib/printRoot.ts), so the page behind can neither show on the paper nor shrink it (v2.6432). */}
      <style>{`@media screen and (max-width: 560px) { .on-site-manifest-head { grid-template-columns: auto 1fr !important; } .on-site-manifest-head > [data-testid="manifest-qr"] { grid-column: 1 / -1; justify-self: start; } .on-site-manifest-dates { grid-template-columns: 1fr !important; } } ${printRootCss('on-site-manifest')} @media print { .on-site-manifest-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; border: none !important; } .on-site-manifest-chrome { display: none !important; } .on-site-manifest-pages { display: block !important; } .on-site-manifest-page { break-after: page; page-break-after: always; border: none !important; border-radius: 0 !important; padding: 0 !important; min-height: 0 !important; } .on-site-manifest-page:last-child { break-after: auto; page-break-after: auto; } .on-site-manifest-added { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <div role="dialog" aria-modal="true" aria-label="Print the manifest" className="on-site-manifest-dialog" data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(760px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="on-site-manifest-chrome" style={{ display: 'grid', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Manifest · {jobLabel}</h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>One Letter page a box: the stencil, the two dates, what is in it, and lines for what is added by hand. Laminate it and hang it on the box.</span>
            </div>
            <button type="button" style={{ ...btnPrimary, flex: '0 0 auto' }} disabled={pages.length === 0} onClick={print} data-testid="manifest-print">{pressWords}</button>
            <button type="button" style={{ ...btn, flex: '0 0 auto' }} onClick={onClose}>Close</button>
          </div>
          {all.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }} role="group" aria-label="Which boxes to print">
              {all.map((c) => {
                const on = picked.has(c.id)
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)} style={{ ...btn, minHeight: 32, borderRadius: 999, fontSize: '0.8rem', padding: '0 0.7rem', ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }}>
                    {on ? '✓ ' : ''}{c.label}
                  </button>
                )
              })}
              <span style={{ display: 'inline-flex', gap: '0.75rem', marginLeft: '0.4rem' }}>
                <button type="button" style={quiet} onClick={() => setPicked(new Set(all.map((c) => c.id)))}>Every box</button>
                <button type="button" style={quiet} onClick={() => setPicked(new Set())}>None</button>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }} data-testid="manifest-pick-words">{manifestPickWords(pages.length, all.length)}</span>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{manifestPickWords(0, 0)} Add a container, then print its manifest.</span>
          )}
        </div>
        <div className="on-site-manifest-pages" style={{ display: 'grid', gap: '1rem' }}>
          {pages.map((p) => <ManifestSheet key={p.containerId} page={p} />)}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** One Letter page: the paper as it hangs on the box. */
function ManifestSheet({ page: p }: { page: ManifestPage }) {
  const noun = p.kind
  return (
    <section className="on-site-manifest-page" aria-label={`Manifest for ${p.stencil}`} data-testid="manifest-page" style={{ border: `2px solid ${RULE}`, borderRadius: 10, padding: '1rem 1.1rem', display: 'grid', gap: '0.9rem', color: 'var(--text-strong)', background: 'var(--surface)' }}>
      <header className="on-site-manifest-head" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.5rem 1.25rem', alignItems: 'end', borderBottom: `3px solid ${RULE}`, paddingBottom: '0.75rem' }}>
        <div style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em' }}>{p.stencil}</div>
        <div style={{ minWidth: 0, display: 'grid', gap: '0.15rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Manifest · what is in this {noun}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.2 }}>{p.job}</div>
          {p.site ? <div style={{ fontSize: '1rem' }}>{p.site}</div> : null}
          <div style={{ fontSize: '0.95rem' }}>{noun}{p.place ? ` · ${p.place}` : ''}{p.where ? ` · ${p.where}` : ''}</div>
        </div>
        {/* The same code the label carries: the camera opens this box on the phone from the paper. */}
        <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }} data-testid="manifest-qr">
          <QRCodeSVG value={boxUrl(p.containerId)} size={112} level="M" bgColor="#ffffff" fgColor="#111111" marginSize={1} />
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em' }}>{dashedCode(p.code)}</div>
        </div>
      </header>
      <div className="on-site-manifest-dates" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ border: `1px solid ${RULE}`, borderRadius: 6, padding: '0.4rem 0.6rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Manifest printed</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }} data-testid="manifest-printed-on">{manifestDateWords(p.printedOn)}</div>
        </div>
        <div style={{ border: `1px solid ${RULE}`, borderRadius: 6, padding: '0.4rem 0.6rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Last recorded in this {noun}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }} data-testid="manifest-last-recorded">{lastRecordedWords(p)}</div>
        </div>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thCell}>In this {noun} when printed</th>
            <th style={{ ...thCell, width: 72, textAlign: 'right' }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {p.items.length === 0 ? (
            <tr><td colSpan={2} style={{ ...itemCell, fontStyle: 'italic' }}>Empty when printed. Write what goes in below.</td></tr>
          ) : p.items.map((it, i) => (
            <tr key={i} data-testid="manifest-item">
              <td style={itemCell}>{it.partName}{it.manufacturer ? <span style={{ color: 'var(--text-700)' }}> · {it.manufacturer}</span> : null}</td>
              <td style={{ ...itemCell, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.onHand}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="on-site-manifest-added" style={{ display: 'grid', gap: '0.3rem' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{MANIFEST_ADDED_HEADER}</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }} data-testid="manifest-added">
          <thead>
            <tr>
              {MANIFEST_ADDED_COLUMNS.map((col) => <th key={col} style={{ ...thCell, ...(col === 'Qty' ? { width: 64 } : col === 'Who' ? { width: '22%' } : col === 'Date' ? { width: '18%' } : {}) }}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: p.blankRows }, (_, i) => (
              <tr key={i} data-testid="manifest-blank-row">
                {MANIFEST_ADDED_COLUMNS.map((col) => <td key={col} style={{ ...penCell, ...(col !== 'Date' ? { borderRight: `1px solid var(--border-400)` } : {}) }} />)}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-700)' }}>Write what you add on a line with your name and the day. Scan the code to open this {noun} on your phone, or go to {boxAddressWords(p.containerId)}, and press it there too, so the count stays true.</div>
      </div>
    </section>
  )
}
