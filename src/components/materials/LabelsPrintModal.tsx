/**
 * Print labels (punch list #209; its own file since v2.6801, punch list #294): the window the office prints a job's
 * box labels from, portalled to <body> and printed alone at full size (`printRootCss`, v2.6432). Two formats, remembered
 * on the device: **Sheet**, one Letter page per box with the stencil, the QR and the ruled lines to write on; **Tape**,
 * one strip per box at the tape's size for a Brother P-touch through the printer's own driver, the QR, the stencil, the
 * code with its dash and *Scan for what is inside*. A tick leaves a box out; the press names its count. **Export the
 * labels as a CSV** (v2.6800) writes one row per box for Brother's P-touch Editor.
 *
 * Since punch list #304 the window's first choice is what the labels print on, named: **Paper sheet** or **Brother
 * tape**. Tape chosen on a computer that never printed it lists the three first-time steps; **Print 1 test strip**
 * prints the first ticked box alone; **None · Every box** sit beside the box chips; and a computer that printed tape
 * opens on tape, with **Change** and **Printer setup** as quiet presses. The words are `lib/materials/tapeLabel.ts`.
 *
 * Since v2.6865 tape prints **straight to the P-touch over USB** where the browser can (Chrome and Edge): Brother makes
 * no Mac driver, so a Mac's print window never lists the printer. **Connect the P-touch** opens the browser's device
 * list once; the printer says what tape is in it; each strip is drawn at the printer's own dots (`TapeStripBitmap`,
 * the QR as tall as the tape prints) and sent one at a time, cut and fed out (`lib/materials/ptouchUsb.ts`). The print
 * window stays one quiet press away, for a Windows computer with Brother's driver.
 *
 * Since v2.6878 the window reads in the order it is worked: what it prints on, which boxes and **Copies of each** (a
 * box with more than one side; its strips print together, 1 1 2 2), the strips, then the presses in a foot that
 * stays at the window's bottom. A connected printer is one line, and the print window's switch sits with the setup.
 * Since v2.6881 a run's strips share one blank lead-in (`chainsToNext`), where every strip threw an inch away.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { boxAddressWords, boxCodeWords, boxUrl, labelRows } from '../../lib/materials/labels'
import { labelsCsvFileName, labelsCsvRows, labelsCsvText } from '../../lib/materials/labelsCsv'
import { readLabelFormat, readTapeCopies, readTapePrintedDay, readTapeWidth, writeLabelFormat, writeTapeCopies, writeTapePrintedDay, writeTapeWidth } from '../../lib/materials/labelPrefs'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { linesOf, type Container, type ContainerLine } from '../../lib/materials/onSite'
import { downloadFile } from '../../lib/materials/photoShare'
import { printRootCss } from '../../lib/printRoot'
import { PTOUCH_CONNECT_LABEL, PTOUCH_COPY_LINK_LABEL, PTOUCH_LINK_COPIED, PTOUCH_LINK_NOT_COPIED, PTOUCH_NEEDS_BROWSER, PTOUCH_NO_USB, PTOUCH_NO_USB_WHY, PTOUCH_NOT_ANSWERING, PTOUCH_STRIP_INSIDE, ptouchReadyLine, ptouchTapeDots, ptouchTapeFits } from '../../lib/materials/ptouchRaster'
import { PtouchPickCancelled, connectPtouch, ptouchUsbAvailable, type PtouchLink } from '../../lib/materials/ptouchUsb'
import { formatErrorMessage } from '../../utils/errorHandling'
import TapeStripBitmap from './TapeStripBitmap'
import { formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'
import { LABEL_OUTPUTS, TAPE_COPIES_LABEL, TAPE_COPIES_MAX, TAPE_LABEL_GUIDE, TAPE_LABEL_GUIDE_HEADING, TAPE_TEST_STRIP_LABEL, TAPE_VIA_USB_LABEL, TAPE_VIA_WINDOW_LABEL, TAPE_WIDTHS_MM, TAPE_WORDS, clampTapeCopies, isTapeWidth, labelCountWords, repeatEach, sheetPressLabel, tapeLayout, tapePressLabel, tapePrintCss, tapeProgressWords, tapeReadyWords, tapeSentWords, tapeSetupSteps, type LabelFormat, type TapeWidthMm } from '../../lib/materials/tapeLabel'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const chip = (on: boolean): CSSProperties => ({ ...btn, minHeight: 32, borderRadius: 999, fontSize: '0.8rem', ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) })
const quietLink: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 28, color: 'var(--text-link)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
/** One of the two outputs: a card that reads as a radio, blue when it is the pick. */
const outputCard = (on: boolean): CSSProperties => ({ display: 'grid', gap: '0.2rem', alignContent: 'start', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: on ? BLUE : 'var(--border-strong)', boxShadow: on ? `inset 0 0 0 1px ${BLUE}` : 'none', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', cursor: 'pointer', minWidth: 0 })


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
  /** Strips of each box (v2.6878): a box with more than one side takes more than one. Tape only. */
  const [copiesState, setCopiesState] = useState<number>(() => readTapeCopies())
  const setCopies = (n: number) => { const c = clampTapeCopies(n); setCopiesState(c); writeTapeCopies(c) }
  const shown = candidates.filter((c) => !left.has(c.id))
  const toggle = (id: string) => setLeft((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  /** The day this computer last sent tape to the print window; null until it has (punch list #304). */
  const [tapeDay, setTapeDay] = useState<string | null>(() => readTapePrintedDay())
  /** Change was pressed: the two outputs are back on a computer that would open on tape. */
  const [choosing, setChoosing] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  /** The test strip: the list holds the first ticked box alone while the print window is open. */
  const [testOnly, setTestOnly] = useState(false)
  useEffect(() => {
    if (!testOnly) return
    const clear = () => setTestOnly(false)
    window.addEventListener('afterprint', clear)
    return () => window.removeEventListener('afterprint', clear)
  }, [testOnly])
  const tape = format === 'tape'
  const copies = tape ? copiesState : 1
  const layout = tapeLayout(width)
  // Straight to the P-touch over USB (v2.6865): where the browser can, tape goes that way unless the print window is asked for.
  const usbHere = useMemo(() => ptouchUsbAvailable(), [])
  const [viaWindow, setViaWindow] = useState(false)
  const direct = tape && usbHere && !viaWindow
  /** The link copied for a browser that can print: null not pressed, else the words that say how it went. */
  const [linkWords, setLinkWords] = useState<string | null>(null)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkWords(PTOUCH_LINK_COPIED)
    } catch {
      setLinkWords(PTOUCH_LINK_NOT_COPIED)
    }
  }
  const [link, setLink] = useState<PtouchLink | null>(null)
  const [usbBusy, setUsbBusy] = useState<null | 'connecting' | 'printing'>(null)
  const [usbSlip, setUsbSlip] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [sentWords, setSentWords] = useState<string | null>(null)
  /** Each ticked box's strip as raster lines, as its canvas drew them. */
  const stripsRef = useRef(new Map<string, Uint8Array[]>())
  const onStripDrawn = useCallback((id: string, drawn: Uint8Array[] | null) => {
    if (drawn) stripsRef.current.set(id, drawn)
    else stripsRef.current.delete(id)
  }, [])
  const adopt = useCallback((l: PtouchLink) => {
    setLink(l)
    setUsbSlip(null)
    // The printer says what tape is in it; the strips are drawn for that.
    if (isTapeWidth(l.status.tapeMm)) { setWidthState(l.status.tapeMm); writeTapeWidth(l.status.tapeMm) }
  }, [])
  // A printer the browser already has leave to use connects by itself; the first time takes the press.
  useEffect(() => {
    if (!direct || link) return
    let live = true
    void connectPtouch({ ask: false }).then((l) => { if (!l) return; if (live) adopt(l); else void l.close() }).catch(() => { /* the press says why */ })
    return () => { live = false }
  }, [direct, link, adopt])
  const linkRef = useRef<PtouchLink | null>(null)
  linkRef.current = link
  useEffect(() => () => { void linkRef.current?.close() }, [])
  const connect = async () => {
    setUsbBusy('connecting')
    setUsbSlip(null)
    try {
      const l = await connectPtouch({ ask: true })
      if (l) adopt(l)
    } catch (e) {
      if (!(e instanceof PtouchPickCancelled)) setUsbSlip(formatErrorMessage(e, PTOUCH_NOT_ANSWERING))
    } finally {
      setUsbBusy(null)
    }
  }
  const tapeFits = link != null && ptouchTapeFits(link.status)
  const pressLabel = tape ? tapePressLabel(shown.length * copies) : sheetPressLabel(shown.length)
  const dead = shown.length === 0 || usbBusy != null || (direct && link != null && !tapeFits)
  /** A computer that printed tape opens on tape, the choice folded to one line. */
  const settled = tape && tapeDay != null && !choosing
  const showSetup = tape && (tapeDay == null || setupOpen)
  const printed = testOnly ? shown.slice(0, 1) : shown
  /** The ticked boxes, or the first alone, sent to the printer one strip at a time. A strip that fails stops the run and says how many went. */
  const printDirect = async (test: boolean) => {
    if (!link || dead) return
    const boxes = test ? shown.slice(0, 1) : shown
    const drawn = boxes.map((c) => stripsRef.current.get(c.id)).filter((l): l is Uint8Array[] => l != null)
    if (drawn.length !== boxes.length) { setUsbSlip('The strips are still being drawn. Press it again.'); return }
    // A box's copies go together, 1 1 2 2 3 3; the test strip is one strip whatever the count.
    const labels = test ? drawn : repeatEach(drawn, copies)
    setUsbBusy('printing')
    setUsbSlip(null)
    setSentWords(null)
    setProgress({ done: 0, total: labels.length })
    let done = 0
    try {
      await link.print(labels, (n) => { done = n; setProgress({ done: n, total: labels.length }) })
      const today = todayYmdInAppTz()
      writeTapePrintedDay(today)
      setTapeDay(today)
      setChoosing(false)
      setSentWords(tapeSentWords(done, labels.length))
    } catch (e) {
      // A run that stops part way leaves its last printed strip short of the cutter: the strips share one lead-in (v2.6881).
      const inside = done > 0 && done < labels.length ? ` ${PTOUCH_STRIP_INSIDE}` : ''
      setUsbSlip(`${tapeSentWords(done, labels.length, formatErrorMessage(e, PTOUCH_NOT_ANSWERING))}${inside}`)
      // A printer that stopped answering needs connecting again.
      void link.close()
      setLink(null)
    } finally {
      setUsbBusy(null)
      setProgress(null)
    }
  }
  const run = (test: boolean) => {
    if (dead) return
    if (direct) { void printDirect(test); return }
    if (tape) {
      const today = todayYmdInAppTz()
      writeTapePrintedDay(today)
      setTapeDay(today)
      setChoosing(false)
    }
    // The strip has to be alone on the page before the print window reads it.
    if (test) flushSync(() => setTestOnly(true))
    print()
  }
  const deadStyle: CSSProperties = dead ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}
  const lth: CSSProperties = { textAlign: 'left', padding: '0.2rem 0.3rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-700)', borderBottom: '2px solid #111827' }
  /** Rows tall enough for a pen on paper: about 8 mm printed. */
  const cell: CSSProperties = { borderBottom: '1px solid var(--border-400)', padding: '0 0.3rem', height: '1.9rem', fontSize: '0.84rem', verticalAlign: 'bottom', color: 'var(--text-strong)' }
  const exportCsv = () => {
    const rows = labelsCsvRows(containers, places)
    downloadFile(new File([labelsCsvText(rows)], labelsCsvFileName(jl, todayYmdInAppTz()), { type: 'text/csv' }))
  }
  const ready = tapeDay ? tapeReadyWords(width, formatWorkDateYmdMonthDayShort(tapeDay)) : null
  /** Straight to the P-touch, or through the print window: a setup choice, so it sits with the setup. */
  const routeSwitch = usbHere ? <button type="button" style={quietLink} onClick={() => { setViaWindow((v) => !v); setUsbSlip(null); setSentWords(null) }}>{viaWindow ? TAPE_VIA_USB_LABEL : TAPE_VIA_WINDOW_LABEL}</button> : null
  const stepBtn = (off: boolean): CSSProperties => ({ ...btn, minHeight: 32, width: 32, padding: 0, justifyContent: 'center', borderRadius: 999, fontSize: '1rem', ...(off ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) })
  return createPortal(
    <div className="on-site-labels" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      {/* Printing draws the labels alone at full size. The window sits on <body> (a portal) and print takes everything else on <body> out of the layout (lib/printRoot.ts), so the page behind can neither show on the paper nor shrink it, and every label prints (v2.6432). The tape's rules come after, so its @page wins. */}
      <style>{`${printRootCss('on-site-labels')} @media print { .on-site-labels-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; } .on-site-labels-chrome, .on-site-labels-pick { display: none !important; } .on-site-labels-list { display: block !important; } .on-site-label { break-inside: avoid; page-break-inside: avoid; border-radius: 0 !important; } .on-site-label + .on-site-label { break-before: page; page-break-before: always; } .on-site-tape-copy { display: grid !important; } }${tape ? ` ${tapePrintCss(width, 'on-site-tape')}` : ''}`}</style>
      <div role="dialog" aria-modal="true" aria-label={one ? `Print the label for ${one.label}` : 'Print labels'} className="on-site-labels-dialog" data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="on-site-labels-chrome" style={{ display: 'grid', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{one ? `Label · ${one.label}` : `Labels · ${jl}`}</h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }} data-testid="labels-count-words">{labelCountWords(format, shown.length, one != null, copies)}</span>
            </div>
            <button type="button" style={{ ...btn, flex: '0 0 auto' }} onClick={onClose}>Close</button>
          </div>
          {settled && ready ? (
            /* This computer printed tape before: the choice is one line, with the way back to it and to the steps. */
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} data-testid="labels-tape-ready">
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: direct && link && !tapeFits ? '#d97706' : '#059669', flex: '0 0 auto' }} />
              {direct && link ? (
                /* Connected: one line says the printer and its tape, where two lines said the same thing twice (v2.6878). */
                <span style={{ flex: '1 1 200px', minWidth: 0, fontWeight: 600 }} data-testid="labels-printer-line">{ptouchReadyLine(link.model, link.status)}</span>
              ) : (
                <span style={{ flex: '1 1 200px', minWidth: 0 }}><strong>{ready.head}</strong> {viaWindow ? 'Through the browser’s print window.' : ready.tail}</span>
              )}
              {/* Through the print window is the unusual state on a computer that reaches the printer: the way back is on the line. */}
              {viaWindow ? routeSwitch : null}
              <button type="button" style={quietLink} onClick={() => setChoosing(true)}>Change</button>
              <button type="button" style={quietLink} aria-expanded={showSetup} onClick={() => setSetupOpen((v) => !v)}>Printer setup</button>
            </div>
          ) : (
            <>
              {/* The first choice: what the labels print on, each named with what it needs. */}
              <div role="radiogroup" aria-label="What the labels print on" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {(['sheet', 'tape'] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={format === f} style={outputCard(format === f)} onClick={() => setFormat(f)} data-testid={`labels-output-${f}`}>
                    <span style={{ fontWeight: 700 }}>{LABEL_OUTPUTS[f].name}</span>
                    <span style={{ color: 'var(--text-700)', fontSize: '0.8rem' }}>{LABEL_OUTPUTS[f].words}</span>
                    {f === 'tape' && !usbHere ? <span style={{ justifySelf: 'start', fontSize: '0.72rem', fontWeight: 700, padding: '0 0.45rem', borderRadius: 999, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }} data-testid="labels-needs-browser">{PTOUCH_NEEDS_BROWSER}</span> : null}
                  </button>
                ))}
              </div>
              {tape && !(direct && link) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }} role="group" aria-label="Tape width">
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tape width</span>
                  {TAPE_WIDTHS_MM.map((w) => <button key={w} type="button" aria-pressed={width === w} style={chip(width === w)} onClick={() => setWidth(w)}>{w} mm</button>)}
                </div>
              ) : null}
            </>
          )}
          {showSetup ? (
            <div style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }} data-testid="labels-tape-setup">
              <strong>{tapeDay == null ? 'First time on this computer' : 'Printer setup'}</strong>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.15rem' }}>
                {tapeSetupSteps(width, direct).map((step) => <li key={step}>{step}</li>)}
              </ol>
              <span>Then press {TAPE_TEST_STRIP_LABEL} before a whole run.</span>
              <a href={helpGuideHref(TAPE_LABEL_GUIDE, TAPE_LABEL_GUIDE_HEADING)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-amber-800)', fontWeight: 600, justifySelf: 'start' }}>How do I set up the tape printer?</a>
              {settled && !viaWindow ? <span style={{ justifySelf: 'start' }}>{routeSwitch}</span> : null}
            </div>
          ) : null}
          {tape && !usbHere ? (
            /* A browser with no USB reach (the owner, 2026-11-10: say it only works in Chrome): the way out, one press. */
            <div role="note" style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }} data-testid="labels-no-usb">
              <strong>{PTOUCH_NO_USB}</strong>
              <span>{PTOUCH_NO_USB_WHY}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="button" style={btn} onClick={() => void copyLink()} data-testid="labels-copy-link">{PTOUCH_COPY_LINK_LABEL}</button>
                {linkWords ? <span role="status" style={{ fontWeight: 600 }}>{linkWords}</span> : null}
              </span>
            </div>
          ) : null}
          {tape && !settled ? (
            /* The printer's line (v2.6865): what it is and what tape is in it once connected, and the way to the other route. */
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem' }} data-testid="labels-printer-line">
              {direct && link ? (
                <>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: tapeFits ? '#059669' : '#d97706', flex: '0 0 auto' }} />
                  <span style={{ flex: '1 1 200px', minWidth: 0, fontWeight: 600 }}>{ptouchReadyLine(link.model, link.status)}</span>
                </>
              ) : direct ? (
                <span style={{ flex: '1 1 200px', minWidth: 0, color: 'var(--text-muted)' }}>The app prints straight to the P-touch over USB. Nothing to install.</span>
              ) : (
                <span style={{ flex: '1 1 200px', minWidth: 0, color: 'var(--text-muted)' }}>Printing through the browser’s print window.</span>
              )}
              {routeSwitch}
            </div>
          ) : null}
        </div>
        {one && !tape ? null : (
          /* What goes on the tape: which boxes, then how many strips of each. The strips are drawn under it and the press is last. */
          <div className="on-site-labels-pick" style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {one ? null : (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Boxes to print">
                {candidates.map((c) => {
                  const on = !left.has(c.id)
                  return <button key={c.id} type="button" aria-pressed={on} style={chip(on)} onClick={() => toggle(c.id)} data-testid="labels-pick">{c.label}</button>
                })}
                {/* As the manifest window has: one new cage's label without unticking the rest. */}
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.75rem' }}>
                  <button type="button" style={quietLink} onClick={() => setLeft(new Set(candidates.map((c) => c.id)))}>None</button>
                  <button type="button" style={quietLink} onClick={() => setLeft(new Set())}>Every box</button>
                </span>
              </div>
            )}
            {tape ? (
              /* A box has more than one side (the owner, 2026-11-10): strips of each, its copies printed together. */
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }} role="group" aria-label={TAPE_COPIES_LABEL}>
                <span style={{ fontWeight: 600 }}>{TAPE_COPIES_LABEL}</span>
                <button type="button" aria-label="One fewer copy" disabled={copies <= 1} aria-disabled={copies <= 1} style={stepBtn(copies <= 1)} onClick={() => setCopies(copies - 1)} data-testid="labels-copies-less">−</button>
                <span aria-live="polite" style={{ minWidth: '1.25rem', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} data-testid="labels-copies">{copies}</span>
                <button type="button" aria-label="One more copy" disabled={copies >= TAPE_COPIES_MAX} aria-disabled={copies >= TAPE_COPIES_MAX} style={stepBtn(copies >= TAPE_COPIES_MAX)} onClick={() => setCopies(copies + 1)} data-testid="labels-copies-more">+</button>
                {copies > 1 ? <span style={{ color: 'var(--text-muted)' }}>A box’s strips print together.</span> : null}
              </div>
            ) : null}
          </div>
        )}
        <div className="on-site-labels-list" style={{ display: 'grid', gap: '0.9rem', ...(tape ? { justifyItems: 'start' } : {}) }}>
          {printed.map((c) => {
            const place = places.find((p) => p.id === c.locationId)?.name ?? ''
            const kind = c.kind === 'box' ? 'box' : c.kind === 'cage' ? 'cage' : 'pile'
            if (direct) {
              // The strip at the printer's own dots: what is on the screen is what prints.
              return <TapeStripBitmap key={c.id} id={c.id} stencil={c.label} address={boxAddressWords(c.id).toUpperCase()} value={boxUrl(c.id)} words={TAPE_WORDS} dots={ptouchTapeDots(width) ?? 128} onDrawn={onStripDrawn} />
            }
            if (tape) {
              const strip = (copy: number) => (
                <div key={`${c.id}:${copy}`} className={copy === 0 ? 'on-site-tape' : 'on-site-tape on-site-tape-copy'} data-testid={copy === 0 ? 'labels-tape' : 'labels-tape-copy'} style={{ ...(copy === 0 ? {} : { display: 'none' }), width: `${layout.lengthMm}mm`, height: `${layout.widthMm}mm`, boxSizing: 'border-box', padding: `${layout.padMm}mm`, ...(copy === 0 ? { display: 'grid' } : {}), gridTemplateColumns: `${layout.qrMm}mm 1fr`, alignItems: 'center', gap: `${layout.padMm}mm`, background: 'var(--surface)', color: '#000', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <QRCodeSVG value={boxUrl(c.id)} size={96} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={4} style={{ width: `${layout.qrMm}mm`, height: `${layout.qrMm}mm`, display: 'block' }} />
                  <div style={{ minWidth: 0, display: 'grid', alignContent: 'center' }}>
                    <div style={{ fontSize: `${layout.stencilMm}mm`, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
                    <div style={{ fontSize: `${layout.codeMm}mm`, lineHeight: 1.1, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: `${layout.padMm}mm` }}>{boxAddressWords(c.id).toUpperCase()}</div>
                    <div style={{ fontSize: `${layout.wordsMm}mm`, lineHeight: 1.1 }}>{TAPE_WORDS}</div>
                  </div>
                </div>
              )
              // The screen draws each box once; the paper gets its copies, 1 1 2 2 3 3. The test strip is one strip.
              return Array.from({ length: testOnly ? 1 : copies }, (_, copy) => strip(copy))
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
        {/* The press is the last thing done, so it is the last thing in the window, and it stays in reach while the strips scroll (v2.6878). A sticky box is held inside its parent's content box, so `bottom` gives back the window's own bottom padding. */}
        <div className="on-site-labels-chrome" style={{ position: 'sticky', bottom: '-1rem', margin: '0.75rem -1.25rem -1rem', padding: '0.6rem 1.25rem 0.8rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.4rem' }} data-testid="labels-foot">
          {usbSlip ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }} data-testid="labels-usb-slip">{usbSlip}</div> : null}
          {progress ? <div role="status" style={{ color: 'var(--text-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="labels-usb-progress">{tapeProgressWords(progress.done, progress.total)}</div> : null}
          {sentWords && !progress ? <div role="status" style={{ color: 'var(--text-green-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="labels-usb-sent">{sentWords}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {direct && !link ? (
              /* Not connected yet: the press is the connection, since a print with no printer does nothing. */
              <button type="button" disabled={usbBusy != null} style={btnPrimary} onClick={() => void connect()} data-testid="labels-connect">{usbBusy === 'connecting' ? 'Connecting…' : PTOUCH_CONNECT_LABEL}</button>
            ) : (
              <button type="button" disabled={dead} aria-disabled={dead} style={{ ...btnPrimary, ...deadStyle }} onClick={() => run(false)} data-testid="labels-print">{pressLabel}</button>
            )}
            {/* One strip before a run (punch list #304): the first ticked box, so the test is a real label and a wrong paper size costs one strip. */}
            {tape && !one && !(direct && !link) ? <button type="button" disabled={dead} aria-disabled={dead} style={{ ...btn, ...deadStyle }} onClick={() => run(true)} data-testid="labels-test-strip">{TAPE_TEST_STRIP_LABEL}</button> : null}
            {/* v2.6800 (punch list #294): one row per box for Brother's P-touch Editor, which merges a CSV into a tape label template. */}
            {one ? null : <button type="button" style={{ ...quietLink, marginLeft: 'auto' }} title="One row per cage or box: the stencil, the place, the code with its dash, the address and the QR's text, for a label editor that merges a CSV" onClick={exportCsv}>Export the labels as a CSV</button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
