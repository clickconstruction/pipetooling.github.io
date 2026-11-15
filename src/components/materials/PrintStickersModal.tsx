/**
 * Print blank stickers (punch list #329, PR 2, v2.7272): the window that mints a run of stickers before their boxes
 * and prints it on Brother tape. It asks how many (the card's quick presses or a typed number), **Copies of each** as
 * the labels window has, and the tape width, remembered on the device by `labelPrefs.ts`. One press, *Print 200
 * sets*, calls `mint_sticker_run` as the caller (`stickerRunsIo.ts`): the database numbers the run and makes the
 * stickers, and the strips print as soon as they are drawn. A refusal is said in the database's own words, and a run
 * refused before its numbers takes none.
 *
 * The strip is the tape label's own (`TapeStripBitmap`, `tapeStrip.ts`): the QR of `HTTPS://PRTS.CO/B/<CODE>` with its
 * quiet zone, the number large where a box's stencil goes, the dashed address and *Scan for what is inside*, sent
 * over USB one at a time with the run chained behind one lead-in (`ptouchUsb.ts`), or through the browser's print
 * window behind **Use the print window instead**, as the labels window keeps it. A run that stops part way says how
 * many went and the press becomes *Print the rest, 0163 to 0300*. Opened on a run already minted (the fold's
 * **Reprint** and **Print the rest**) it mints nothing and prints what it was handed. **Export the stickers as a CSV**
 * writes the run for Brother's own editor. The words are `lib/materials/stickerRun.ts`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { readTapeCopies, readTapePrintedDay, readTapeWidth, writeTapeCopies, writeTapePrintedDay, writeTapeWidth } from '../../lib/materials/labelPrefs'
import { downloadFile } from '../../lib/materials/photoShare'
import { PTOUCH_CONNECT_LABEL, PTOUCH_COPY_LINK_LABEL, PTOUCH_LINK_COPIED, PTOUCH_LINK_NOT_COPIED, PTOUCH_NO_USB, PTOUCH_NO_USB_WHY, PTOUCH_NOT_ANSWERING, PTOUCH_STRIP_INSIDE, ptouchReadyLine, ptouchTapeDots, ptouchTapeFits } from '../../lib/materials/ptouchRaster'
import { PtouchPickCancelled, connectPtouch, ptouchUsbAvailable, type PtouchLink } from '../../lib/materials/ptouchUsb'
import {
  lastRunWords,
  printRestLabel,
  printRunLabel,
  restAfterStop,
  runStripsWords,
  STICKER_COUNT_PRESETS,
  STICKER_MINT_FAILED,
  STICKER_MINTING,
  STICKER_RUN_MAX,
  STICKER_TEST_STRIP,
  STICKERS_GUIDE,
  STICKERS_GUIDE_HEADING,
  stickerRunCountWords,
  stickerRunPressLabel,
  stickerRunRequest,
  stickersCsvFileName,
  stickersCsvText,
  stickersSentWords,
  stickerStrip,
  type MintedRun,
  type MintedSticker,
  type StickerRun,
  type StickerRunRequest,
  type StickerStrip,
} from '../../lib/materials/stickerRun'
import { fetchLastStickerNumber, fetchStickerRuns, mintStickerRun } from '../../lib/materials/stickerRunsIo'
import { blankCountOf, jobBlankWords } from '../../lib/materials/stickerPlace'
import { stickerRangeWords } from '../../lib/materials/stickers'
import { TAPE_COPIES_LABEL, TAPE_COPIES_MAX, TAPE_TEST_STRIP_LABEL, TAPE_VIA_USB_LABEL, TAPE_VIA_WINDOW_LABEL, TAPE_WIDTHS_MM, clampTapeCopies, isTapeWidth, repeatEach, tapeLayout, tapePrintCss, tapeProgressWords, tapeReadyWords, tapeSetupSteps, type TapeWidthMm } from '../../lib/materials/tapeLabel'
import { printRootCss } from '../../lib/printRoot'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'
import TapeStripBitmap from './TapeStripBitmap'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const chip = (on: boolean): CSSProperties => ({ ...btn, minHeight: 32, borderRadius: 999, fontSize: '0.8rem', ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) })
const quietLink: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 28, color: 'var(--text-link)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const amberNote: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }

/** A run already minted, handed in by the fold: the window prints it and mints nothing. */
export type StickerRunToPrint = { run: StickerRun; stickers: MintedSticker[]; title: string }

type Props = {
  jobId: string
  jobLabel: string
  role: string | null | undefined
  run?: StickerRunToPrint | null
  onClose: () => void
  /** Told once a run is minted, so the page's Runs fold reads again. */
  onMinted?: (minted: MintedRun) => void
  /** The mint, the last number read and the print itself; a test hands spies. */
  mint?: (request: StickerRunRequest) => Promise<MintedRun>
  lastNumber?: () => Promise<number | null>
  /** How many of the job's stickers are not yet on a box (v2.7298); a test hands a spy. */
  blankCount?: (jobId: string) => Promise<number>
  print?: () => void
}

export default function PrintStickersModal({ jobId, jobLabel, role, run: given = null, onClose, onMinted, mint = mintStickerRun, lastNumber = fetchLastStickerNumber, blankCount = (id) => fetchStickerRuns(id).then(blankCountOf), print = () => window.print() }: Props) {
  const [countText, setCountText] = useState<string>(String(STICKER_COUNT_PRESETS[3]))
  const [copiesState, setCopiesState] = useState<number>(() => (given ? given.run.copies : readTapeCopies()))
  const copies = clampTapeCopies(copiesState)
  const setCopies = (n: number) => { const c = clampTapeCopies(n); setCopiesState(c); writeTapeCopies(c) }
  const [width, setWidthState] = useState<TapeWidthMm>(() => readTapeWidth())
  const setWidth = (w: TapeWidthMm) => { setWidthState(w); writeTapeWidth(w) }
  const layout = tapeLayout(width)
  /** The day this computer last printed tape; the first-time steps fold away once it has (punch list #304). */
  const [tapeDay, setTapeDay] = useState<string | null>(() => readTapePrintedDay())
  const [setupOpen, setSetupOpen] = useState(false)
  const [changingWidth, setChangingWidth] = useState(false)
  /** The run on the screen: the one handed in, or the one just minted. */
  const [minted, setMinted] = useState<MintedRun | null>(given ? { run: given.run, stickers: given.stickers } : null)
  /** The stickers the press prints now: the whole run, or the rest after a stop. */
  const [printing, setPrinting] = useState<MintedSticker[]>(given ? given.stickers : [])
  const stage: 'ask' | 'run' = minted ? 'run' : 'ask'
  const [minting, setMinting] = useState(false)
  /** The newest number any run the caller can see reached; undefined while it is read. */
  const [last, setLast] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    if (given) return
    let live = true
    lastNumber().then((n) => { if (live) setLast(n) }).catch(() => { if (live) setLast(null) })
    return () => { live = false }
  }, [given, lastNumber])
  /** The job's stickers still on no box (v2.7298): said before a new run is minted, so nobody prints 200 more over 96 unused. */
  const [blank, setBlank] = useState<number>(0)
  useEffect(() => {
    if (given) return
    let live = true
    blankCount(jobId).then((n) => { if (live) setBlank(n) }).catch(() => { if (live) setBlank(0) })
    return () => { live = false }
  }, [given, jobId, blankCount])
  /** The test strip: the list holds it alone while the print window is open. */
  const [testOnly, setTestOnly] = useState(false)
  useEffect(() => {
    if (!testOnly) return
    const clear = () => setTestOnly(false)
    window.addEventListener('afterprint', clear)
    return () => window.removeEventListener('afterprint', clear)
  }, [testOnly])

  // Straight to the P-touch over USB where the browser can (v2.6865); the print window behind one quiet press.
  const usbHere = useMemo(() => ptouchUsbAvailable(), [])
  const [viaWindow, setViaWindow] = useState(false)
  const direct = usbHere && !viaWindow
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
  const [slip, setSlip] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [sentWords, setSentWords] = useState<string | null>(null)
  /** Each strip as raster lines, as its canvas drew it; `drawnVersion` ticks so the auto print can wait for the whole run. */
  const stripsRef = useRef(new Map<string, Uint8Array[]>())
  const [drawnVersion, setDrawnVersion] = useState(0)
  const onStripDrawn = useCallback((id: string, drawn: Uint8Array[] | null) => {
    if (drawn) stripsRef.current.set(id, drawn)
    else stripsRef.current.delete(id)
    setDrawnVersion((v) => v + 1)
  }, [])
  const adopt = useCallback((l: PtouchLink) => {
    setLink(l)
    setSlip(null)
    if (isTapeWidth(l.status.tapeMm)) { setWidthState(l.status.tapeMm); writeTapeWidth(l.status.tapeMm) }
  }, [])
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
    setSlip(null)
    try {
      const l = await connectPtouch({ ask: true })
      if (l) adopt(l)
    } catch (e) {
      if (!(e instanceof PtouchPickCancelled)) setSlip(formatErrorMessage(e, PTOUCH_NOT_ANSWERING))
    } finally {
      setUsbBusy(null)
    }
  }
  const tapeFits = link != null && ptouchTapeFits(link.status)
  const printerHolds = usbBusy != null || (direct && link != null && !tapeFits)

  const verdict = stickerRunRequest({ jobId, count: countText, copies, role })
  const count = verdict.ok ? verdict.request.count : 0
  const strips: StickerStrip[] = useMemo(() => printing.map(stickerStrip), [printing])
  const dots = ptouchTapeDots(width) ?? 128

  /** The strips, or the test strip alone, sent to the printer one at a time. A stop keeps the rest for the next press. */
  const printDirect = async (toPrint: StickerStrip[], test: boolean) => {
    if (!link) return
    const drawn = toPrint.map((s) => stripsRef.current.get(s.id)).filter((l): l is Uint8Array[] => l != null)
    if (drawn.length !== toPrint.length) { setSlip('The strips are still being drawn. Press it again.'); return }
    const labels = test ? drawn : repeatEach(drawn, copies)
    setUsbBusy('printing')
    setSlip(null)
    setSentWords(null)
    setProgress({ done: 0, total: labels.length })
    let done = 0
    try {
      await link.print(labels, (n) => { done = n; setProgress({ done: n, total: labels.length }) })
      const today = todayYmdInAppTz()
      writeTapePrintedDay(today)
      setTapeDay(today)
      // The run stays on the page once printed, so the press prints it again as the fold's Reprint would.
      if (!test) setSentWords(stickersSentWords(done, toPrint.length, copies))
    } catch (e) {
      const inside = done > 0 && done < labels.length ? ` ${PTOUCH_STRIP_INSIDE}` : ''
      if (test) setSlip(`${formatErrorMessage(e, PTOUCH_NOT_ANSWERING)}${inside}`)
      else {
        setSlip(`${stickersSentWords(done, toPrint.length, copies, formatErrorMessage(e, PTOUCH_NOT_ANSWERING))}${inside}`)
        setPrinting(restAfterStop(printing, done, copies))
      }
      void link.close()
      setLink(null)
    } finally {
      setUsbBusy(null)
      setProgress(null)
    }
  }
  /**
   * A run just minted prints as soon as its strips are drawn; through the print window, as soon as they are on the
   * page. The flag is a ref, cleared in the same tick the print starts: a state flag cleared beside the print's own
   * updates was lost to React's batching in the test's DOM, and the run printed again on every render.
   */
  const pendingRef = useRef(false)
  const [pendingTick, setPendingTick] = useState(0)
  useEffect(() => {
    if (!pendingRef.current || stage !== 'run') return
    if (direct) {
      if (!link || usbBusy) return
      if (!strips.every((s) => stripsRef.current.has(s.id))) return
      pendingRef.current = false
      void printDirect(strips, false)
      return
    }
    pendingRef.current = false
    const today = todayYmdInAppTz()
    writeTapePrintedDay(today)
    setTapeDay(today)
    print()
    // The strips are what is printed; `drawnVersion` is the tick that says another is ready, `pendingTick` that a run was minted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTick, stage, direct, link, usbBusy, drawnVersion, strips])

  const runMint = async () => {
    if (!verdict.ok || minting || printerHolds) return
    setMinting(true)
    setSlip(null)
    setSentWords(null)
    try {
      const got = await mint(verdict.request)
      setMinted(got)
      setPrinting(got.stickers)
      pendingRef.current = true
      setPendingTick((t) => t + 1)
      onMinted?.(got)
    } catch (e) {
      setSlip(formatErrorMessage(e, STICKER_MINT_FAILED))
    } finally {
      setMinting(false)
    }
  }
  const runPrint = () => {
    if (printing.length === 0 || printerHolds) return
    if (direct) { void printDirect(strips, false); return }
    const today = todayYmdInAppTz()
    writeTapePrintedDay(today)
    setTapeDay(today)
    setSentWords(null)
    print()
  }
  const runTest = () => {
    if (printerHolds) return
    if (direct) { void printDirect([STICKER_TEST_STRIP], true); return }
    flushSync(() => setTestOnly(true))
    print()
  }
  const exportCsv = () => {
    if (!minted) return
    downloadFile(new File([stickersCsvText(minted.stickers)], stickersCsvFileName(minted.run, todayYmdInAppTz()), { type: 'text/csv' }))
  }

  const pressLabel = stage === 'ask' ? stickerRunPressLabel(count, copies) : printing.length < (minted?.stickers.length ?? 0) ? printRestLabel(printing) : printRunLabel(printing, copies)
  const dead = stage === 'ask' ? !verdict.ok || minting || printerHolds : printing.length === 0 || printerHolds
  const deadStyle: CSSProperties = dead ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}
  const ready = tapeDay ? tapeReadyWords(width, formatWorkDateYmdMonthDayShort(tapeDay)) : null
  const showSetup = tapeDay == null || setupOpen
  const routeSwitch = usbHere ? <button type="button" style={quietLink} onClick={() => { setViaWindow((v) => !v); setSlip(null); setSentWords(null) }}>{viaWindow ? TAPE_VIA_USB_LABEL : TAPE_VIA_WINDOW_LABEL}</button> : null
  const stepBtn = (off: boolean): CSSProperties => ({ ...btn, minHeight: 32, width: 32, padding: 0, justifyContent: 'center', borderRadius: 999, fontSize: '1rem', ...(off ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) })
  const title = given ? `${given.title} · ${jobLabel}` : minted ? `Stickers ${stickerRangeWords(minted.run.firstNumber, minted.run.lastNumber)} · ${jobLabel}` : `Print blank stickers · ${jobLabel}`
  const countWords = minted ? runStripsWords(minted.run, printing.length) : stickerRunCountWords(count, copies)
  /** The strips on the page: the run's, or the test strip alone while it prints. */
  const shownStrips: StickerStrip[] = testOnly ? [STICKER_TEST_STRIP] : strips
  const domStrip = (s: StickerStrip, copy: number) => (
    <div key={`${s.id}:${copy}`} className={copy === 0 ? 'on-site-tape' : 'on-site-tape on-site-tape-copy'} data-testid={copy === 0 ? 'stickers-tape' : 'stickers-tape-copy'} style={{ ...(copy === 0 ? { display: 'grid' } : { display: 'none' }), width: `${layout.lengthMm}mm`, height: `${layout.widthMm}mm`, boxSizing: 'border-box', padding: `${layout.padMm}mm`, gridTemplateColumns: `${layout.qrMm}mm 1fr`, alignItems: 'center', gap: `${layout.padMm}mm`, background: 'var(--surface)', color: '#000', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <QRCodeSVG value={s.value} size={96} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={4} style={{ width: `${layout.qrMm}mm`, height: `${layout.qrMm}mm`, display: 'block' }} />
      <div style={{ minWidth: 0, display: 'grid', alignContent: 'center' }}>
        <div style={{ fontSize: `${layout.stencilMm}mm`, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.stencil}</div>
        <div style={{ fontSize: `${layout.codeMm}mm`, lineHeight: 1.1, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: `${layout.padMm}mm` }}>{s.address}</div>
        <div style={{ fontSize: `${layout.wordsMm}mm`, lineHeight: 1.1 }}>{s.words}</div>
      </div>
    </div>
  )
  return createPortal(
    <div className="on-site-stickers" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      {/* Printed alone at full size, as the labels window is (lib/printRoot.ts, v2.6432); the tape's @page rule comes last so it wins. */}
      <style>{`${printRootCss('on-site-stickers')} @media print { .on-site-stickers-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; } .on-site-stickers-chrome { display: none !important; } .on-site-stickers-list { display: block !important; } .on-site-tape-copy { display: grid !important; } } ${tapePrintCss(width, 'on-site-tape')}`}</style>
      <div role="dialog" aria-modal="true" aria-label={given ? given.title : 'Print blank stickers'} className="on-site-stickers-dialog" data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="on-site-stickers-chrome" style={{ display: 'grid', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{title}</h2>
              <span style={muted} data-testid="stickers-count-words">{countWords}</span>
            </div>
            <button type="button" style={{ ...btn, flex: '0 0 auto' }} onClick={onClose}>Close</button>
          </div>
          {/* What a sticker prints on is settled by the card's call 3: Brother tape. One line says the tape, with the width and the setup one press away. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} data-testid="stickers-tape-line">
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: direct && link ? (tapeFits ? '#059669' : '#d97706') : 'var(--border-strong)', flex: '0 0 auto' }} />
            {direct && link ? (
              <span style={{ flex: '1 1 200px', minWidth: 0, fontWeight: 600 }} data-testid="stickers-printer-line">{ptouchReadyLine(link.model, link.status)}</span>
            ) : ready ? (
              <span style={{ flex: '1 1 200px', minWidth: 0 }}><strong>{ready.head}</strong> {viaWindow ? 'Through the browser’s print window.' : direct ? 'The app prints straight to the P-touch over USB.' : ready.tail}</span>
            ) : (
              <span style={{ flex: '1 1 200px', minWidth: 0 }}><strong>Brother tape · {width} mm.</strong> {direct ? 'The app prints straight to the P-touch over USB. Nothing to install.' : 'Through the browser’s print window.'}</span>
            )}
            {viaWindow ? routeSwitch : null}
            {!(direct && link) ? <button type="button" style={quietLink} aria-expanded={changingWidth} onClick={() => setChangingWidth((v) => !v)}>Tape width</button> : null}
            <button type="button" style={quietLink} aria-expanded={showSetup} onClick={() => setSetupOpen((v) => !v)}>Printer setup</button>
          </div>
          {changingWidth && !(direct && link) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }} role="group" aria-label="Tape width">
              <span style={muted}>Tape width</span>
              {TAPE_WIDTHS_MM.map((w) => <button key={w} type="button" aria-pressed={width === w} style={chip(width === w)} onClick={() => setWidth(w)}>{w} mm</button>)}
            </div>
          ) : null}
          {showSetup ? (
            <div style={amberNote} data-testid="stickers-tape-setup">
              <strong>{tapeDay == null ? 'First time on this computer' : 'Printer setup'}</strong>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.15rem' }}>
                {tapeSetupSteps(width, direct).map((step) => <li key={step}>{step}</li>)}
              </ol>
              <span>Then press {TAPE_TEST_STRIP_LABEL} before a whole run. The test strip is not a sticker.</span>
              <a href={helpGuideHref(STICKERS_GUIDE, STICKERS_GUIDE_HEADING)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-amber-800)', fontWeight: 600, justifySelf: 'start' }}>How do I print blank stickers?</a>
              {!viaWindow ? <span style={{ justifySelf: 'start' }}>{routeSwitch}</span> : null}
            </div>
          ) : null}
          {!usbHere ? (
            <div role="note" style={amberNote} data-testid="stickers-no-usb">
              <strong>{PTOUCH_NO_USB}</strong>
              <span>{PTOUCH_NO_USB_WHY}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="button" style={btn} onClick={() => void copyLink()} data-testid="stickers-copy-link">{PTOUCH_COPY_LINK_LABEL}</button>
                {linkWords ? <span role="status" style={{ fontWeight: 600 }}>{linkWords}</span> : null}
              </span>
            </div>
          ) : null}
          {stage === 'ask' ? (
            <div style={{ display: 'grid', gap: '0.6rem' }} data-testid="stickers-ask">
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label="How many">
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>How many</span>
                {STICKER_COUNT_PRESETS.map((n) => <button key={n} type="button" aria-pressed={countText === String(n)} style={chip(countText === String(n))} onClick={() => setCountText(String(n))} data-testid="stickers-count-preset">{n}</button>)}
                <input type="number" inputMode="numeric" min={1} max={STICKER_RUN_MAX} value={countText} onChange={(e) => setCountText(e.target.value)} aria-label="How many, typed" style={{ minHeight: 32, width: 84, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.5rem', font: 'inherit', fontWeight: 700, background: 'var(--surface)', color: 'var(--text-strong)' }} data-testid="stickers-count-input" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }} role="group" aria-label={TAPE_COPIES_LABEL}>
                <span style={{ fontWeight: 600 }}>{TAPE_COPIES_LABEL}</span>
                <button type="button" aria-label="One fewer copy" disabled={copies <= 1} aria-disabled={copies <= 1} style={stepBtn(copies <= 1)} onClick={() => setCopies(copies - 1)} data-testid="stickers-copies-less">−</button>
                <span aria-live="polite" style={{ minWidth: '1.25rem', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} data-testid="stickers-copies">{copies}</span>
                <button type="button" aria-label="One more copy" disabled={copies >= TAPE_COPIES_MAX} aria-disabled={copies >= TAPE_COPIES_MAX} style={stepBtn(copies >= TAPE_COPIES_MAX)} onClick={() => setCopies(copies + 1)} data-testid="stickers-copies-more">+</button>
                <span style={muted}>{copies > 1 ? 'A set is one sticker printed more than once, for a box with more than one side. Every copy opens the same box.' : 'For a box with more than one side, print each sticker more than once.'}</span>
              </div>
              <p style={{ ...muted, margin: 0 }} data-testid="stickers-last-run">
                {last === undefined ? 'Reading the last run…' : lastRunWords(last)} New boxes made from these stickers go on {jobLabel}.{blank > 0 ? <> <span data-testid="stickers-blank-count">{jobBlankWords(blank)}</span></> : null}
              </p>
              {!verdict.ok ? <p role="note" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-red-700)', fontWeight: 600 }} data-testid="stickers-refusal">{verdict.words}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="on-site-stickers-list" style={{ display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
          {direct ? (
            <>
              {/* The test strip is drawn and kept ready while the window asks, so Print 1 test strip costs no wait; it is hidden on the screen. */}
              {stage === 'ask' ? <div style={{ display: 'none' }} aria-hidden><TapeStripBitmap id={STICKER_TEST_STRIP.id} stencil={STICKER_TEST_STRIP.stencil} address={STICKER_TEST_STRIP.address} value={STICKER_TEST_STRIP.value} words={STICKER_TEST_STRIP.words} dots={dots} onDrawn={onStripDrawn} /></div> : null}
              {strips.map((s) => <TapeStripBitmap key={s.id} id={s.id} stencil={s.stencil} address={s.address} value={s.value} words={s.words} dots={dots} onDrawn={onStripDrawn} />)}
            </>
          ) : (
            shownStrips.flatMap((s) => Array.from({ length: testOnly ? 1 : copies }, (_, copy) => domStrip(s, copy)))
          )}
        </div>
        <div className="on-site-stickers-chrome" style={{ position: 'sticky', bottom: '-1rem', margin: '0.75rem -1.25rem -1rem', padding: '0.6rem 1.25rem 0.8rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.4rem' }} data-testid="stickers-foot">
          {slip ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }} data-testid="stickers-slip">{slip}</div> : null}
          {minting ? <div role="status" style={{ color: 'var(--text-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-minting">{STICKER_MINTING}</div> : null}
          {progress ? <div role="status" style={{ color: 'var(--text-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-progress">{tapeProgressWords(progress.done, progress.total)}</div> : null}
          {sentWords && !progress ? <div role="status" style={{ color: 'var(--text-green-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-sent">{sentWords}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {direct && !link ? (
              <button type="button" disabled={usbBusy != null} style={btnPrimary} onClick={() => void connect()} data-testid="stickers-connect">{usbBusy === 'connecting' ? 'Connecting…' : PTOUCH_CONNECT_LABEL}</button>
            ) : (
              <button type="button" disabled={dead} aria-disabled={dead} style={{ ...btnPrimary, ...deadStyle }} onClick={() => (stage === 'ask' ? void runMint() : runPrint())} data-testid="stickers-print">{pressLabel}</button>
            )}
            {stage === 'ask' && !(direct && !link) ? <button type="button" disabled={printerHolds} aria-disabled={printerHolds} style={{ ...btn, ...(printerHolds ? deadStyle : {}) }} onClick={runTest} data-testid="stickers-test-strip">{TAPE_TEST_STRIP_LABEL}</button> : null}
            {minted ? <button type="button" style={{ ...quietLink, marginLeft: 'auto' }} title="One row a sticker: the number, the code with its dash, the address and the QR's text, for a label editor that merges a CSV" onClick={exportCsv} data-testid="stickers-csv">Export the stickers as a CSV</button> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
