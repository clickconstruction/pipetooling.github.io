/**
 * The pieces the two *Which job?* windows of the Materials strip share (v2.7492): Print labels' (`PrintLabelsWindow`,
 * v2.7482) and Print future stickers' (`PrintStickersWindow`). A job's card and its head, the presses' looks, one strip of
 * tape drawn at its printed size, the amber note for a browser that cannot reach the P-touch, and the quiet link to a
 * printer the browser already has leave to use. Each window keeps its own words and its own facts.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { PTOUCH_COPY_LINK_LABEL, PTOUCH_LINK_COPIED, PTOUCH_LINK_NOT_COPIED, PTOUCH_NO_USB, PTOUCH_NO_USB_WHY } from '../../lib/materials/ptouchRaster'
import type { PtouchLink } from '../../lib/materials/ptouchUsb'
import { TAPE_NAME_SMALL_RATIO, tapeLayout, type TapeWidthMm } from '../../lib/materials/tapeLabel'
import { tapeStripLines } from '../../lib/materials/tapeStrip'

export const WJ_BLUE = '#2563eb'
export const WJ_ONE_COLUMN = 'minmax(0, 1fr)'
export const wjBtn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }
export const wjBtnPrimary: CSSProperties = { ...wjBtn, background: WJ_BLUE, borderColor: WJ_BLUE, color: '#fff' }
export const wjQuietLink: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 28, color: 'var(--text-link)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
export const wjMuted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
export const wjCard: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 12, padding: '0.75rem 0.9rem', display: 'grid', gridTemplateColumns: WJ_ONE_COLUMN, gap: '0.5rem', background: 'var(--surface)' }
/** A card that asks to be read first: a run to finish, stickers still waiting for their boxes. */
export const wjCardFirst: CSSProperties = { borderColor: WJ_BLUE, boxShadow: `inset 0 0 0 1px ${WJ_BLUE}` }
export const wjAmberBox: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
export const WJ_CHIP_TONES: Record<'green' | 'amber' | 'blue' | 'gray', CSSProperties> = {
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  gray: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
}
export const wjChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 0.55rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }

/**
 * A card's head, and its press: the job's number and name, where it is, and on the right a count with its word or a
 * few plain words. `tid` is the window's test id stem (`print-labels`, `print-stickers`).
 */
export function WhichJobHead({ tid, number, name, where, count, aside, ariaLabel, onOpen }: { tid: string; number: string; name: string; where: string; count?: { n: number; word: string }; aside?: string; ariaLabel: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%', background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} data-testid={`${tid}-job`}>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'grid', gap: 1 }}>
        <span style={{ fontWeight: 700, fontSize: '0.97rem', lineHeight: 1.25, overflowWrap: 'anywhere' }} data-testid={`${tid}-job-name`}>
          {number ? <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 6, padding: '1px 6px', marginRight: 6, verticalAlign: 1 }}>{number}</span> : null}
          {name}
        </span>
        {where ? <span style={{ ...wjMuted, overflowWrap: 'anywhere' }} data-testid={`${tid}-job-where`}>{where}</span> : null}
      </span>
      {count ? (
        <span style={{ flex: '0 0 auto', display: 'grid', textAlign: 'right', lineHeight: 1.05, whiteSpace: 'nowrap' }} data-testid={`${tid}-job-count`}>
          <strong style={{ fontSize: '1.6rem', fontVariantNumeric: 'tabular-nums' }}>{count.n}</strong>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{count.word}</span>
        </span>
      ) : aside ? (
        <span style={{ ...wjMuted, flex: '0 0 auto', whiteSpace: 'nowrap', fontWeight: 600 }} data-testid={`${tid}-job-count`}>{aside}</span>
      ) : null}
    </button>
  )
}

/**
 * One strip of tape at its printed size, as the print window lays it out: the QR, the name large and the address on
 * its lines. With no name the code's own line is drawn larger, as a sticker with no name prints. Always light, as
 * tape is.
 */
export function TapeStripSample({ stencil, small = false, address, value, width, caption, testid }: { stencil: string; small?: boolean; address: string; value: string; width: TapeWidthMm; caption?: (lengthMm: number) => string; testid?: string }) {
  const chars = stencil ? (small ? Math.ceil(stencil.length * TAPE_NAME_SMALL_RATIO) : stencil.length) : undefined
  const layout = tapeLayout(width, chars)
  return (
    <div style={{ display: 'grid', gap: 3, justifyItems: 'center', maxWidth: '100%' }} data-testid={testid}>
      <div data-theme="light" aria-hidden style={{ width: `${layout.lengthMm}mm`, maxWidth: '100%', height: `${layout.widthMm}mm`, boxSizing: 'border-box', padding: `${layout.padMm}mm`, display: 'grid', gridTemplateColumns: `${layout.qrMm}mm 1fr`, alignItems: 'center', gap: `${layout.padMm}mm`, background: 'var(--surface)', color: '#000', border: '1px solid var(--border-strong)', borderRadius: 3, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
        <QRCodeSVG value={value} size={96} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={4} style={{ width: `${layout.qrMm}mm`, height: `${layout.qrMm}mm`, display: 'block' }} />
        <div style={{ minWidth: 0, display: 'grid', alignContent: 'center' }}>
          {stencil ? <div style={{ fontSize: `${small ? layout.stencilMm * TAPE_NAME_SMALL_RATIO : layout.stencilMm}mm`, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stencil}</div> : null}
          {tapeStripLines(address, undefined, !stencil).map((line, i) => (
            <div key={line.text} style={{ fontSize: `${line.big ? layout.codeMm * 1.5 : layout.codeMm}mm`, lineHeight: 1.1, fontWeight: line.big ? 700 : 400, fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap', ...(i === 0 && stencil ? { marginTop: `${layout.padMm}mm` } : {}) }}>{line.text}</div>
          ))}
        </div>
      </div>
      <span style={wjMuted}>{caption ? caption(layout.lengthMm) : `One strip, about ${layout.lengthMm} mm`}</span>
    </div>
  )
}

/** A browser with no USB reach, said before a job is picked: why, the link to open in Chrome or Edge, and any other way out. */
export function NoUsbNote({ tid, children }: { tid: string; children?: ReactNode }) {
  const [words, setWords] = useState<string | null>(null)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setWords(PTOUCH_LINK_COPIED)
    } catch {
      setWords(PTOUCH_LINK_NOT_COPIED)
    }
  }
  return (
    <div role="note" style={{ ...wjAmberBox, borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }} data-testid={`${tid}-band`} data-band="no-usb">
      <strong>{PTOUCH_NO_USB}</strong>
      <span>{PTOUCH_NO_USB_WHY}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" style={wjBtn} onClick={() => void copyLink()} data-testid={`${tid}-copy-link`}>{PTOUCH_COPY_LINK_LABEL}</button>
        {children}
        {words ? <span role="status" style={{ fontWeight: 600 }}>{words}</span> : null}
      </span>
    </div>
  )
}

/**
 * The printer's own line before a job is picked: while `wants`, a printer the browser already has leave to use is
 * opened with no press, so a wrong or missing tape is seen first. The window a card opens makes its own link, and two
 * cannot hold the printer, so `letGo` closes this one and is awaited before that window is drawn.
 */
export function useQuietPtouch(wants: boolean, connect: (options: { ask: boolean }) => Promise<PtouchLink | null>): { link: PtouchLink | null; held: () => boolean; letGo: () => Promise<void> } {
  const [link, setLink] = useState<PtouchLink | null>(null)
  const linkRef = useRef<PtouchLink | null>(null)
  linkRef.current = link
  useEffect(() => {
    if (!wants) return
    let live = true
    void connect({ ask: false }).then((l) => { if (!l) return; if (live) setLink(l); else void l.close() }).catch(() => { /* the next window's own press says why */ })
    return () => { live = false }
  }, [wants, connect])
  useEffect(() => () => { void linkRef.current?.close() }, [])
  const letGo = useCallback(async () => {
    const l = linkRef.current
    if (!l) return
    linkRef.current = null
    setLink(null)
    try { await l.close() } catch { /* nothing to close */ }
  }, [])
  const held = useCallback(() => linkRef.current != null, [])
  return { link, held, letGo }
}
