/**
 * Reserve stickers (punch list #329, PR 2, v2.7272; *Print blank stickers* until v2.7484): the window that mints a
 * run of stickers before their boxes and prints it on Brother tape. Minting is the reserving: each sticker gets a
 * code of its own, and its name when the run has names, held for a box someone says later. The ask says so in a line
 * under the names, and a run that is made says it is reserved. It asks how many (the card's quick presses or a typed
 * number), **Copies of each** as the labels window has, and the tape width, remembered on the device by
 * `labelPrefs.ts`. One press, *Reserve and print 200 sets*, calls `mint_sticker_run` as the caller
 * (`stickerRunsIo.ts`): the database numbers the run and makes the
 * stickers, and the strips print as soon as they are drawn. A refusal is said in the database's own words, and a run
 * refused before its numbers takes none.
 *
 * The strip is the tape label's own (`TapeStripBitmap`, `tapeStrip.ts`): the QR of `HTTPS://PRTS.CO/B/<CODE>` with its
 * quiet zone, the name large where a box's stencil goes and the dashed address on two lines, sent
 * over USB one at a time with the run chained behind one lead-in (`ptouchUsb.ts`), or through the browser's print
 * window behind **Use the print window instead**, as the labels window keeps it. A run that stops part way says how
 * many went and the press becomes *Print the rest, G163 to G300*. Opened on a run already minted (the fold's
 * **Reprint** and **Print the rest**) it mints nothing and prints what it was handed. **Export the stickers as a CSV**
 * writes the run for Brother's own editor. The words are `lib/materials/stickerRun.ts`. **What the stickers will look
 * like** (v2.7304, `StickerPreviewFold.tsx`) at the foot of the ask draws the run's strips before the press.
 *
 * A run names its boxes (design section 10, PR 8, v2.7391). The ask opens on one typed field, **Names**, filled with
 * the site's next free name: `G78` with How many 200 is G78 to G277, and a typed range such as `G78-300` sets the
 * count itself (`stickerNames.ts` is the rule, and its refusals are said under the field). Names that are live boxes
 * on the site are a notice; names an earlier run printed and that are on no box yet hold the press until **Print them
 * anyway**. The mint sends the names, and each strip prints its name large over the address. Cleared, the field
 * prints a run with no names. Since v2.7438 (Taunya's call of 2026-11-16) no strip and no line of this window
 * carries a sticker's running number: a sticker with no name prints its code larger in the name's place.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { readTapeCopies, readTapePrintedDay, readTapeWidth, writeTapeCopies, writeTapePrintedDay, writeTapeWidth } from '../../lib/materials/labelPrefs'
import { downloadFile } from '../../lib/materials/photoShare'
import { PTOUCH_CONNECT_LABEL, PTOUCH_COPY_LINK_LABEL, PTOUCH_LINK_COPIED, PTOUCH_LINK_NOT_COPIED, PTOUCH_NO_USB, PTOUCH_NO_USB_WHY, PTOUCH_CHECK_AGAIN_LABEL, PTOUCH_NOT_ANSWERING, PTOUCH_RECHECK_MS, PTOUCH_RECHECK_WORDS, PTOUCH_STOP_LABEL, PTOUCH_STOPPING, PTOUCH_STOPPING_LABEL, PTOUCH_STRIP_INSIDE, ptouchCannotPrintWords, ptouchNeedsRecheck, ptouchReadyLine, ptouchTapeDots, ptouchTapeFits } from '../../lib/materials/ptouchRaster'
import { PtouchPickCancelled, connectPtouch, ptouchUsbAvailable, type PtouchLink } from '../../lib/materials/ptouchUsb'
import { nextFreeName } from '../../lib/materials/boxName'
import { blankNamesNotice, liveNamesNotice, STICKER_NAMES_LABEL, STICKER_NAMES_PLACEHOLDER, STICKER_NAMES_READING_WORDS, STICKER_NAMES_UNREAD_WORDS, stickerNamesAsk } from '../../lib/materials/stickerNames'
import {
  PRINT_STICKERS_LABEL,
  printRestLabel,
  printRunLabel,
  reserveRunPressLabel,
  restAfterStop,
  runStripsWords,
  STICKER_COUNT_PRESETS,
  STICKER_MINT_FAILED,
  STICKER_MINTING,
  STICKER_RUN_MAX,
  STICKER_TEST_STRIP,
  STICKERS_GUIDE,
  STICKERS_GUIDE_HEADING,
  STICKERS_GUIDE_QUESTION,
  STICKERS_RESERVED_WORDS,
  stickerCountOf,
  stickerReadName,
  stickerReserveWords,
  stickerRunCountWords,
  stickerRunRequest,
  stickerSpanWords,
  stripNameChars,
  stickersCsvFileName,
  stickersCsvText,
  stickersSentWords,
  stickersStoppedWords,
  stickerStrip,
  type MintedRun,
  type MintedSticker,
  type StickerRun,
  type StickerRunRequest,
  type StickerStrip,
} from '../../lib/materials/stickerRun'
import { fetchSiteStickerNames, fetchStickerRuns, mintStickerRun, type SiteStickerNames } from '../../lib/materials/stickerRunsIo'
import { blankCountOf, jobBlankWords } from '../../lib/materials/stickerPlace'
import { LABEL_RANGE_FROM, LABEL_RANGE_TO, leftAfterRangePick, rangeCountWords, tickedRange } from '../../lib/materials/labelPick'
import { TAPE_COPIES_LABEL, TAPE_COPIES_MAX, TAPE_NAME_SMALL_RATIO, TAPE_TEST_STRIP_LABEL, TAPE_VIA_USB_LABEL, TAPE_VIA_WINDOW_LABEL, TAPE_WIDTHS_MM, clampTapeCopies, isTapeWidth, longestNameChars, repeatEach, tapeLayout, tapePrintCss, tapeProgressWords, tapeReadyWords, tapeSetupSteps, type TapeWidthMm } from '../../lib/materials/tapeLabel'
import { tapeAddressLines, tapeStripLines } from '../../lib/materials/tapeStrip'
import { printRootCss } from '../../lib/printRoot'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'
import StickerPreviewFold from './StickerPreviewFold'
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
  /** The mint and the print itself; a test hands spies. */
  mint?: (request: StickerRunRequest) => Promise<MintedRun>
  /** How many of the job's stickers are not yet on a box (v2.7298); a test hands a spy. */
  blankCount?: (jobId: string) => Promise<number>
  /** The site's boxes and its blank named stickers, for the Names field (v2.7391); a test hands a spy. */
  siteNames?: (jobId: string) => Promise<SiteStickerNames>
  print?: () => void
}

export default function PrintStickersModal({ jobId, jobLabel, role, run: given = null, onClose, onMinted, mint = mintStickerRun, blankCount = (id) => fetchStickerRuns(id).then(blankCountOf), siteNames = fetchSiteStickerNames, print = () => window.print() }: Props) {
  const [countText, setCountText] = useState<string>(String(STICKER_COUNT_PRESETS[3]))
  const [copiesState, setCopiesState] = useState<number>(() => (given ? given.run.copies : readTapeCopies()))
  const copies = clampTapeCopies(copiesState)
  const setCopies = (n: number) => { const c = clampTapeCopies(n); setCopiesState(c); writeTapeCopies(c) }
  const [width, setWidthState] = useState<TapeWidthMm>(() => readTapeWidth())
  const setWidth = (w: TapeWidthMm) => { setWidthState(w); writeTapeWidth(w) }
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
  /** The job's stickers still on no box (v2.7298): said before a new run is minted, so nobody prints 200 more over 96 unused. */
  const [blank, setBlank] = useState<number>(0)
  useEffect(() => {
    if (given) return
    let live = true
    blankCount(jobId).then((n) => { if (live) setBlank(n) }).catch(() => { if (live) setBlank(0) })
    return () => { live = false }
  }, [given, jobId, blankCount])
  /**
   * The site's boxes and its blank named stickers (section 10): undefined while they are read, null when the read
   * failed. The Names field opens on the site's next free name once they land, unless someone typed first.
   */
  const [site, setSite] = useState<SiteStickerNames | null | undefined>(given ? null : undefined)
  const [namesText, setNamesText] = useState('')
  const namesTouched = useRef(false)
  const offered = useMemo(() => (site ? nextFreeName(site.boxes) : null), [site])
  useEffect(() => {
    if (given) return
    let live = true
    siteNames(jobId)
      .then((got) => {
        if (!live) return
        setSite(got)
        const first = nextFreeName(got.boxes)
        if (first && !namesTouched.current) setNamesText(first)
      })
      .catch(() => { if (live) setSite(null) })
    return () => { live = false }
  }, [given, jobId, siteNames])
  /** The names **Print them anyway** was pressed for: a change to the names asks again. */
  const [anywayFor, setAnywayFor] = useState<string | null>(null)
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
  const [progress, setProgress] = useState<{ done: number; total: number; test: boolean } | null>(null)
  /** Whether what is left on the page is the rest of a run that stopped, or a range someone picked: the press reads differently. */
  const [isRest, setIsRest] = useState(false)
  const [sentWords, setSentWords] = useState<string | null>(null)
  /** Stop printing was pressed: the loop reads the ref before each strip, the press reads the state. */
  const stopRef = useRef(false)
  const [stopping, setStopping] = useState(false)
  const askStop = () => { stopRef.current = true; setStopping(true) }
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
    // The red line is left as it is: a printer that stopped for want of tape still answers, so the window is back on
    // it at once, and how many went and why must outlast that. The Connect press and the next run clear it.
    if (isTapeWidth(l.status.tapeMm)) { setWidthState(l.status.tapeMm); writeTapeWidth(l.status.tapeMm) }
  }, [])
  useEffect(() => {
    if (!direct || link) return
    let live = true
    void connectPtouch({ ask: false }).then((l) => { if (!l) return; if (live) adopt(l); else void l.close() }).catch(() => { /* the press says why */ })
    return () => { live = false }
  }, [direct, link, adopt])
  /**
   * A connected printer that cannot print (no tape, the cover open, a tape the sticker is not laid out for) is asked
   * again every few seconds while nothing prints, so a new cassette is seen with no press (Taunya, 2026-11-15). One
   * that stops answering is let go, and the press becomes Connect the P-touch.
   */
  const [, setStatusTick] = useState(0)
  const checking = useRef(false)
  const recheck = useCallback(async (l: PtouchLink) => {
    if (checking.current) return
    checking.current = true
    try {
      const status = await l.refresh()
      if (isTapeWidth(status.tapeMm)) { setWidthState(status.tapeMm); writeTapeWidth(status.tapeMm) }
      setStatusTick((t) => t + 1)
    } catch {
      void l.close()
      setLink((now) => (now === l ? null : now))
    } finally {
      checking.current = false
    }
  }, [])
  const needsRecheck = direct && link != null && usbBusy == null && ptouchNeedsRecheck(link.status)
  useEffect(() => {
    if (!needsRecheck || !link) return
    const timer = window.setInterval(() => { void recheck(link) }, PTOUCH_RECHECK_MS)
    return () => window.clearInterval(timer)
  }, [needsRecheck, link, recheck])
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

  // The Names field read with How many (`stickerNames.ts`): a range sets the count, a start alone takes How many.
  const typedCount = stickerCountOf(countText)
  const ask = stickerNamesAsk(namesText, typedCount ?? 0, offered)
  const rangeRefused = ask.tone === 'refused'
  const askNames = ask.range.kind === 'names' && (ask.countFollows || typedCount != null) ? ask.range.names : null
  const verdict = stickerRunRequest({ jobId, count: askNames ? askNames.length : countText, copies, role, names: askNames })
  const count = !rangeRefused && verdict.ok ? verdict.request.count : 0
  const liveNotice = askNames && site ? liveNamesNotice(askNames, site.boxes) : null
  const blankNotice = askNames && site ? blankNamesNotice(askNames, site.blankNames) : null
  const namesKey = askNames ? askNames.join(' ') : ''
  const held = blankNotice != null && anywayFor !== namesKey
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
    setProgress({ done: 0, total: labels.length, test })
    stopRef.current = false
    setStopping(false)
    let done = 0
    try {
      await link.print(labels, (n) => { done = n; setProgress({ done: n, total: labels.length, test }) }, () => stopRef.current)
      const today = todayYmdInAppTz()
      writeTapePrintedDay(today)
      setTapeDay(today)
      if (!test && done < labels.length) {
        // Stop printing was pressed (Taunya, 2026-11-15): the printer fed the last strip out and cut it, and the press prints the rest.
        setSentWords(stickersStoppedWords(done, toPrint.length, copies))
        setPrinting(restAfterStop(printing, done, copies))
        setIsRest(true)
      } else if (!test) {
        // The run stays on the page once printed, so the press prints it again as the fold's Reprint would.
        setSentWords(stickersSentWords(done, toPrint.length, copies))
      }
    } catch (e) {
      const inside = done > 0 && done < labels.length ? ` ${PTOUCH_STRIP_INSIDE}` : ''
      if (test) setSlip(`${formatErrorMessage(e, PTOUCH_NOT_ANSWERING)}${inside}`)
      else {
        setSlip(`${stickersSentWords(done, toPrint.length, copies, formatErrorMessage(e, PTOUCH_NOT_ANSWERING))}${inside}`)
        setPrinting(restAfterStop(printing, done, copies))
        setIsRest(true)
      }
      void link.close()
      setLink(null)
    } finally {
      setUsbBusy(null)
      setProgress(null)
      setStopping(false)
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

  const runMint = async (anyway = false) => {
    if (!verdict.ok || rangeRefused || site === undefined || minting || printerHolds) return
    if (held && !anyway) return
    if (anyway) setAnywayFor(namesKey)
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

  const pressLabel = stage === 'ask' ? reserveRunPressLabel(count, copies, askNames) : printing.length < (minted?.stickers.length ?? 0) && isRest ? printRestLabel(printing) : printRunLabel(printing, copies)
  /** Everything that holds the ask's press but the one hold **Print them anyway** lifts. */
  const askBlocked = !verdict.ok || rangeRefused || site === undefined || minting || printerHolds
  const dead = stage === 'ask' ? askBlocked || held : printing.length === 0 || printerHolds
  const deadStyle: CSSProperties = dead ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}
  const ready = tapeDay ? tapeReadyWords(width, formatWorkDateYmdMonthDayShort(tapeDay)) : null
  const showSetup = tapeDay == null || setupOpen
  const routeSwitch = usbHere ? <button type="button" style={quietLink} onClick={() => { setViaWindow((v) => !v); setSlip(null); setSentWords(null) }}>{viaWindow ? TAPE_VIA_USB_LABEL : TAPE_VIA_WINDOW_LABEL}</button> : null
  const stepBtn = (off: boolean): CSSProperties => ({ ...btn, minHeight: 32, width: 32, padding: 0, justifyContent: 'center', borderRadius: 999, fontSize: '1rem', ...(off ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) })
  const title = given ? `${given.title} · ${jobLabel}` : minted ? `${stickerSpanWords(minted.stickers) ? `Stickers ${stickerSpanWords(minted.stickers)}` : `${minted.stickers.length} ${minted.stickers.length === 1 ? 'sticker' : 'stickers'}`} · ${jobLabel}` : `${PRINT_STICKERS_LABEL} · ${jobLabel}`
  /** The run as its words read it: the names off the stickers when the run's own row came back without them. */
  const runForWords = minted ? { ...minted.run, names: minted.run.names ?? (minted.stickers.length > 0 && minted.stickers.every((s) => s.boxName) ? minted.stickers.map((s) => s.boxName!) : null) } : null
  const countWords = runForWords ? runStripsWords(runForWords, printing.length) : stickerRunCountWords(count, copies)
  /** The strips on the page: the run's, or the test strip alone while it prints. */
  const shownStrips: StickerStrip[] = testOnly ? [STICKER_TEST_STRIP] : strips
  /** A range of the run on the page by its two ends (Taunya, 2026-11-15): the same rule as Print labels, over the run's stickers. */
  const runIds = useMemo(() => (minted ? minted.stickers.map((s) => s.id) : []), [minted])
  const runLeft = useMemo(() => { const on = new Set(printing.map((s) => s.id)); return new Set(runIds.filter((id) => !on.has(id))) }, [runIds, printing])
  const runRange = tickedRange(runIds, runLeft)
  const pickRange = (end: 'from' | 'to', id: string) => {
    if (!minted) return
    const left = leftAfterRangePick(runIds, runLeft, end, id)
    setPrinting(minted.stickers.filter((s) => !left.has(s.id)))
    setIsRest(false)
    setSentWords(null)
    setSlip(null)
  }
  /** The strip going out now, for the progress line: its name, or its code, and which of its copies. */
  const progressSticker = progress && !progress.test ? strips[Math.min(Math.floor(progress.done / copies), strips.length - 1)] : undefined
  const progressAt = progress && progressSticker ? { name: progressSticker.stencil || tapeAddressLines(progressSticker.address).slice(-1)[0]!, copy: (Math.min(progress.done, progress.total - 1) % copies) + 1, copies } : null
  /** The print window cuts every strip of a run to one length: what the run's longest name or number needs. */
  const nameChars = longestNameChars(shownStrips.map((s) => 'X'.repeat(stripNameChars(s))))
  const layout = tapeLayout(width, nameChars)
  const domStrip = (s: StickerStrip, copy: number) => (
    <div key={`${s.id}:${copy}`} className={copy === 0 ? 'on-site-tape' : 'on-site-tape on-site-tape-copy'} data-testid={copy === 0 ? 'stickers-tape' : 'stickers-tape-copy'} style={{ ...(copy === 0 ? { display: 'grid' } : { display: 'none' }), width: `${layout.lengthMm}mm`, height: `${layout.widthMm}mm`, boxSizing: 'border-box', padding: `${layout.padMm}mm`, gridTemplateColumns: `${layout.qrMm}mm 1fr`, alignItems: 'center', gap: `${layout.padMm}mm`, background: 'var(--surface)', color: '#000', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <QRCodeSVG value={s.value} size={96} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={4} style={{ width: `${layout.qrMm}mm`, height: `${layout.qrMm}mm`, display: 'block' }} />
      <div style={{ minWidth: 0, display: 'grid', alignContent: 'center' }}>
        {/* The name large. A sticker with no name has none, and its code is drawn half again as large in its place. */}
        {s.stencil ? <div data-testid="stickers-tape-name" style={{ fontSize: `${s.small ? layout.stencilMm * TAPE_NAME_SMALL_RATIO : layout.stencilMm}mm`, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.stencil}</div> : null}
        {tapeStripLines(s.address, undefined, !s.stencil).map((line, i) => (
          <div key={line.text} data-testid="stickers-tape-address-line" style={{ fontSize: `${line.big ? layout.codeMm * 1.5 : layout.codeMm}mm`, lineHeight: 1.1, fontWeight: line.big ? 700 : 400, fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap', ...(i === 0 && s.stencil ? { marginTop: `${layout.padMm}mm` } : {}) }}>{line.text}</div>
        ))}
        {s.words ? <div style={{ fontSize: `${layout.wordsMm}mm`, lineHeight: 1.1 }}>{s.words}</div> : null}
      </div>
    </div>
  )
  return createPortal(
    <div className="on-site-stickers" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      {/* Printed alone at full size, as the labels window is (lib/printRoot.ts, v2.6432); the tape's @page rule comes last so it wins. */}
      <style>{`${printRootCss('on-site-stickers')} @media print { .on-site-stickers-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; } .on-site-stickers-chrome { display: none !important; } .on-site-stickers-list { display: block !important; } .on-site-tape-copy { display: grid !important; } } ${tapePrintCss(width, 'on-site-tape', nameChars)}`}</style>
      <div role="dialog" aria-modal="true" aria-label={given ? given.title : PRINT_STICKERS_LABEL} className="on-site-stickers-dialog" data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="on-site-stickers-chrome" style={{ display: 'grid', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{title}</h2>
              <span style={muted} data-testid="stickers-count-words">{countWords}</span>
              {/* A run that is made is reserved (the owner, 2026-11-16): said over the strips, which carry each sticker's own link. */}
              {stage === 'run' ? <span style={{ ...muted, display: 'block' }} data-testid="stickers-reserved-words">{STICKERS_RESERVED_WORDS}</span> : null}
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
              <a href={helpGuideHref(STICKERS_GUIDE, STICKERS_GUIDE_HEADING)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-amber-800)', fontWeight: 600, justifySelf: 'start' }}>{STICKERS_GUIDE_QUESTION}</a>
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
          {minted && minted.stickers.length > 2 ? (
            /* A range of the run by its two ends: reprint G103 to G130 without printing the whole run. */
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }} role="group" aria-label="A range of stickers" data-testid="stickers-range">
              {(['from', 'to'] as const).map((end) => (
                <label key={end} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  {end === 'from' ? LABEL_RANGE_FROM : LABEL_RANGE_TO}
                  <select value={(end === 'from' ? runRange?.fromId : runRange?.toId) ?? ''} disabled={usbBusy != null} onChange={(e) => pickRange(end, e.target.value)} style={{ minHeight: 32, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.4rem', font: 'inherit', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-strong)' }} data-testid={`stickers-range-${end}`}>
                    {runRange ? null : <option value="" disabled>Pick a sticker</option>}
                    {minted.stickers.map((s) => <option key={s.id} value={s.id}>{stickerReadName(s)}</option>)}
                  </select>
                </label>
              ))}
              <span style={muted} data-testid="stickers-range-count">{rangeCountWords(runIds, runLeft, ['sticker', 'stickers'])}</span>
            </div>
          ) : null}
          {stage === 'ask' ? (
            <div style={{ display: 'grid', gap: '0.6rem' }} data-testid="stickers-ask">
              {/* A run names its boxes (section 10): one typed field, open on the site's next free name. What it reads is said under it, and so is a refusal. */}
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontWeight: 600, fontSize: '0.85rem' }}>
                  {STICKER_NAMES_LABEL}
                  <input type="text" value={namesText} onChange={(e) => { namesTouched.current = true; setNamesText(e.target.value) }} placeholder={STICKER_NAMES_PLACEHOLDER} spellCheck={false} autoComplete="off" autoCapitalize="characters" style={{ minHeight: 36, flex: '1 1 180px', minWidth: 0, maxWidth: 280, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.6rem', font: 'inherit', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.03em', textTransform: 'uppercase', background: 'var(--surface)', color: 'var(--text-strong)' }} data-testid="stickers-names-input" />
                </label>
                {site === undefined ? (
                  <span style={muted} data-testid="stickers-names-reading">{STICKER_NAMES_READING_WORDS}</span>
                ) : (
                  <span role={rangeRefused ? 'note' : undefined} style={rangeRefused ? { fontSize: '0.85rem', color: 'var(--text-red-700)', fontWeight: 600 } : muted} data-testid="stickers-names-read">{ask.words}</span>
                )}
                {site === null ? <span style={muted} data-testid="stickers-names-unread">{STICKER_NAMES_UNREAD_WORDS}</span> : null}
                {liveNotice ? <span style={{ fontSize: '0.85rem', color: 'var(--text-green-700)', fontWeight: 600 }} data-testid="stickers-names-live">{liveNotice.words}</span> : null}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label="How many">
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>How many</span>
                {/* A typed range sets the count itself: How many shows it, and its presses rest until the range is gone. */}
                {STICKER_COUNT_PRESETS.map((n) => <button key={n} type="button" disabled={ask.countFollows} aria-disabled={ask.countFollows} aria-pressed={!ask.countFollows && countText === String(n)} style={{ ...chip(!ask.countFollows && countText === String(n)), ...(ask.countFollows ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) }} onClick={() => setCountText(String(n))} data-testid="stickers-count-preset">{n}</button>)}
                <input type="number" inputMode="numeric" min={1} max={STICKER_RUN_MAX} value={ask.countFollows ? String(ask.count) : countText} readOnly={ask.countFollows} onChange={(e) => { if (!ask.countFollows) setCountText(e.target.value) }} aria-label="How many, typed" title={ask.countFollows ? 'The typed range sets how many' : undefined} style={{ minHeight: 32, width: 84, borderRadius: 8, border: '1px solid var(--border-strong)', padding: '0 0.5rem', font: 'inherit', fontWeight: 700, background: 'var(--surface)', color: ask.countFollows ? 'var(--text-muted)' : 'var(--text-strong)' }} data-testid="stickers-count-input" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }} role="group" aria-label={TAPE_COPIES_LABEL}>
                <span style={{ fontWeight: 600 }}>{TAPE_COPIES_LABEL}</span>
                <button type="button" aria-label="One fewer copy" disabled={copies <= 1} aria-disabled={copies <= 1} style={stepBtn(copies <= 1)} onClick={() => setCopies(copies - 1)} data-testid="stickers-copies-less">−</button>
                <span aria-live="polite" style={{ minWidth: '1.25rem', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} data-testid="stickers-copies">{copies}</span>
                <button type="button" aria-label="One more copy" disabled={copies >= TAPE_COPIES_MAX} aria-disabled={copies >= TAPE_COPIES_MAX} style={stepBtn(copies >= TAPE_COPIES_MAX)} onClick={() => setCopies(copies + 1)} data-testid="stickers-copies-more">+</button>
                <span style={muted}>{copies > 1 ? 'A set is one sticker printed more than once, for a box with more than one side. Every copy opens the same box.' : 'For a box with more than one side, print each sticker more than once.'}</span>
              </div>
              {/* What the press holds (the owner, 2026-11-16): the window never prints a sticker with no link, and says so before the press. */}
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-strong)' }} data-testid="stickers-reserve-words">{stickerReserveWords(askNames != null)}</p>
              <p style={{ ...muted, margin: 0 }} data-testid="stickers-goes-on">
                New boxes made from these stickers go on {jobLabel}.{blank > 0 ? <> <span data-testid="stickers-blank-count">{jobBlankWords(blank)}</span></> : null}
              </p>
              {!verdict.ok && !rangeRefused ? <p role="note" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-red-700)', fontWeight: 600 }} data-testid="stickers-refusal">{verdict.words}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="on-site-stickers-list" style={{ display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
          {direct ? (
            <>
              {/* The test strip is drawn and kept ready while the window asks, so Print 1 test strip costs no wait; it is hidden on the screen. */}
              {stage === 'ask' ? <div style={{ display: 'none' }} aria-hidden><TapeStripBitmap id={STICKER_TEST_STRIP.id} stencil={STICKER_TEST_STRIP.stencil} address={STICKER_TEST_STRIP.address} value={STICKER_TEST_STRIP.value} words={STICKER_TEST_STRIP.words} dots={dots} onDrawn={onStripDrawn} /></div> : null}
              {strips.map((s) => <TapeStripBitmap key={s.id} id={s.id} stencil={s.stencil} address={s.address} value={s.value} words={s.words} stencilSmall={s.small} dots={dots} onDrawn={onStripDrawn} />)}
            </>
          ) : (
            shownStrips.flatMap((s) => Array.from({ length: testOnly ? 1 : copies }, (_, copy) => domStrip(s, copy)))
          )}
        </div>
        {/* What the stickers will look like (v2.7304): the run's real numbers through the printer's own drawing, above the presses, closed until this device opens it. */}
        {stage === 'ask' ? <div className="on-site-stickers-chrome" style={{ marginTop: '0.75rem' }}><StickerPreviewFold count={count} copies={copies} width={width} names={rangeRefused ? null : askNames} /></div> : null}
        <div className="on-site-stickers-chrome" style={{ position: 'sticky', bottom: '-1rem', margin: '0.75rem -1.25rem -1rem', padding: '0.6rem 1.25rem 0.8rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.4rem' }} data-testid="stickers-foot">
          {slip ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }} data-testid="stickers-slip">{slip}</div> : null}
          {needsRecheck && link ? (
            /* Why the press is grey, right above it: what the printer says, what to do, and that the window is looking. */
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', color: 'var(--text-amber-800)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-recheck">
              <span>{ptouchCannotPrintWords(link.status)} {PTOUCH_RECHECK_WORDS}</span>
              <button type="button" style={quietLink} onClick={() => void recheck(link)} data-testid="stickers-check-printer">{PTOUCH_CHECK_AGAIN_LABEL}</button>
            </div>
          ) : null}
          {stage === 'ask' && held && blankNotice ? <div role="status" style={{ color: 'var(--text-amber-800)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-names-blank">{blankNotice.words}</div> : null}
          {minting ? <div role="status" style={{ color: 'var(--text-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-minting">{STICKER_MINTING}</div> : null}
          {progress ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span role="status" style={{ color: 'var(--text-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-progress">{stopping ? PTOUCH_STOPPING : tapeProgressWords(progress.done, progress.total, progressAt)}</span>
              {/* A run can be stopped (Taunya, 2026-11-15): the strip after the one printing is sent as the run's last, fed out and cut. */}
              {progress.total > 1 ? <button type="button" disabled={stopping} aria-disabled={stopping} style={{ ...btn, minHeight: 32, ...(stopping ? { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) }} onClick={askStop} data-testid="stickers-stop">{stopping ? PTOUCH_STOPPING_LABEL : PTOUCH_STOP_LABEL}</button> : null}
            </div>
          ) : null}
          {sentWords && !progress ? <div role="status" style={{ color: 'var(--text-green-700)', fontSize: '0.85rem', fontWeight: 600 }} data-testid="stickers-sent">{sentWords}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {direct && !link ? (
              <button type="button" disabled={usbBusy != null} style={btnPrimary} onClick={() => void connect()} data-testid="stickers-connect">{usbBusy === 'connecting' ? 'Connecting…' : PTOUCH_CONNECT_LABEL}</button>
            ) : (
              <button type="button" disabled={dead} aria-disabled={dead} style={{ ...btnPrimary, ...deadStyle }} onClick={() => (stage === 'ask' ? void runMint() : runPrint())} data-testid="stickers-print">{pressLabel}</button>
            )}
            {/* The one hold (section 10, call 5): names an earlier run printed and that are on no box yet. This press prints the run as asked, those names with it. */}
            {stage === 'ask' && held && blankNotice && !askBlocked && !(direct && !link) ? <button type="button" style={btn} onClick={() => void runMint(true)} data-testid="stickers-print-anyway">{blankNotice.anywayLabel}</button> : null}
            {stage === 'ask' && !(direct && !link) ? <button type="button" disabled={printerHolds} aria-disabled={printerHolds} style={{ ...btn, ...(printerHolds ? deadStyle : {}) }} onClick={runTest} data-testid="stickers-test-strip">{TAPE_TEST_STRIP_LABEL}</button> : null}
            {minted ? <button type="button" style={{ ...quietLink, marginLeft: 'auto' }} title="One row a sticker: its name, the code with its dash, the address and the QR's text, for a label editor that merges a CSV" onClick={exportCsv} data-testid="stickers-csv">Export the stickers as a CSV</button> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
