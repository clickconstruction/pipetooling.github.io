/**
 * A receipt link (punch list #299, PR 1, v2.7101): what `/r/<code>` opens, with no sign-in. The link carries one card
 * charge, or the few a text folds together. The page shows the charge's store, amount, day and whose card, and takes a
 * photo of the receipt. The photo is a counter ticket (#295) already on its charge, so the office reads it on the Team
 * queue as any ticket. The ten-letter code is the key, as an estimate's link is; the page shows nothing else: no other
 * charge, no job's folder, no price list.
 *
 * A photo is shrunk on the phone to the large size, so small print reads, and posted to the `receipt-link` function. No
 * sign-in means no outbox: a photo that has not sent waits on this page with Try again, sends by itself when the signal
 * returns, and is lost if the page is left, which the page says. Light, on the portal's paper, as `/e`, `/pay` and
 * `/b` are.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { shrinkReportPhoto } from '../lib/photos/shrink'
import { CARD, COPPER, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PAPER_RED, PORTAL_FONT, portalPressFill } from '../lib/portal/portalTheme'
import {
  RECEIPT_COMPANY,
  RECEIPT_LINK_CAPS,
  RECEIPT_LINK_WORDS,
  RECEIPT_PAGE_WORDS as W,
  receiptCardWords,
  receiptChargeWords,
  receiptClosesWords,
  receiptJobLine,
  receiptLinkCode,
  receiptOnChargeWords,
  receiptWhenWords,
  type ReceiptJobPick,
  type ReceiptPageCharge,
} from '../lib/tickets/receiptLink'
import { receiptLinkIo, type ReceiptLinkIo, type ReceiptLinkView } from '../lib/tickets/receiptLinkIo'
import { formatCurrency } from '../lib/format'

type View = ReceiptLinkView | { kind: 'loading' }

/** A photo that has not reached the server yet: it lives on this page alone. */
type Waiting = { pageId: string; blob: Blob; width: number; height: number; originalBytes: number; replace: string | null; preview: string | null }

const page: CSSProperties = { minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, fontSize: 16, lineHeight: 1.45 }
const column: CSSProperties = { maxWidth: 460, margin: '0 auto', padding: '16px 16px 40px' }
const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, padding: 14, marginTop: 12, display: 'grid', gap: 12 }
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED }
const press: CSSProperties = { display: 'block', width: '100%', minHeight: 50, borderRadius: 10, border: `1px solid ${HAIR}`, font: 'inherit', fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }
const wordPress: CSSProperties = { background: 'none', border: 'none', padding: '6px 0', minHeight: 32, font: 'inherit', fontSize: 14, color: COPPER, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }
const fact: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }
const tiny: CSSProperties = { fontSize: 12.5, color: MUTED }
const hidden: CSSProperties = { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }

const newId = (): string => crypto.randomUUID()

function chipStyle(on: boolean, dim: boolean): CSSProperties {
  return {
    minHeight: 40,
    borderRadius: 999,
    border: `1px solid ${on ? PAPER_GREEN : HAIR}`,
    background: on ? NOTE_BAND : CARD,
    color: on ? PAPER_GREEN : INK,
    font: 'inherit',
    fontSize: 14,
    fontWeight: on ? 700 : 500,
    padding: '6px 14px',
    cursor: dim ? 'default' : 'pointer',
    opacity: dim ? 0.6 : 1,
    textAlign: 'left',
  }
}

function Stop({ head, body, door }: { head: string; body: string; door?: boolean }) {
  return (
    <div data-theme="light" style={page}>
      <div style={column}>
        <div style={eyebrow}>{W.eyebrow}</div>
        <div style={card} role="status">
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{head}</h1>
          <p style={{ margin: 0, color: MUTED }}>{body}</p>
          {door ? (
            <a href="/tally" data-testid="receipt-open-tally" style={{ ...press, background: CARD, color: INK, textAlign: 'center', textDecoration: 'none', lineHeight: '32px', boxSizing: 'border-box' }}>
              {W.openTally}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function pickOf(c: ReceiptPageCharge): ReceiptJobPick | null {
  if (c.ticket?.noOneJob) return { noOneJob: true }
  if (c.ticket?.jobId) return { jobId: c.ticket.jobId }
  return null
}

function samePick(a: ReceiptJobPick | null, b: ReceiptJobPick): boolean {
  if (!a) return false
  return b.noOneJob ? a.noOneJob === true : !a.noOneJob && a.jobId === b.jobId
}

function ChargeCard({ code, charge, io, shrink, onCharge, onWaiting }: { code: string; charge: ReceiptPageCharge; io: ReceiptLinkIo; shrink: typeof shrinkReportPhoto; onCharge: (c: ReceiptPageCharge) => void; onWaiting: (id: string, waiting: boolean) => void }) {
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  const [sending, setSending] = useState(false)
  const [lost, setLost] = useState(false)
  const [words, setWords] = useState<string | null>(null)
  const [kept, setKept] = useState(false)
  const [busyJob, setBusyJob] = useState(false)
  /** The chip tapped before any photo: it rides with the first page. */
  const [pick, setPick] = useState<ReceiptJobPick | null>(null)
  /** Pictures this visit took, by page id, so a thumbnail needs no second download. */
  const [mine, setMine] = useState<ReadonlyMap<string, string>>(new Map())
  const cameraRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<string | null>(null)
  const waitingRef = useRef<Waiting | null>(null)
  waitingRef.current = waiting
  const pickRef = useRef(pick)
  pickRef.current = pick

  useEffect(() => {
    onWaiting(charge.id, waiting !== null)
  }, [charge.id, waiting, onWaiting])

  const send = useCallback(
    async (w: Waiting) => {
      setSending(true)
      setLost(false)
      setWords(null)
      const answer = await io.addPage(code, { charge: charge.id, pageId: w.pageId, blob: w.blob, width: w.width, height: w.height, originalBytes: w.originalBytes, job: pickRef.current, replace: w.replace })
      setSending(false)
      if (answer.ok) {
        if (w.preview) setMine((m) => new Map(m).set(w.pageId, w.preview!))
        setWaiting(null)
        setKept(answer.kept)
        onCharge(answer.charge)
        return
      }
      if (answer.why === 'signal') {
        setLost(true)
        return
      }
      // A refusal is final for this photo: it goes, and the reason stays.
      if (w.preview) URL.revokeObjectURL(w.preview)
      setWaiting(null)
      setWords(answer.words)
    },
    [charge.id, code, io, onCharge],
  )

  // The signal came back: the photo that waits goes by itself.
  useEffect(() => {
    const again = () => {
      const w = waitingRef.current
      if (w) void send(w)
    }
    window.addEventListener('online', again)
    return () => window.removeEventListener('online', again)
  }, [send])

  const onPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    const replace = replaceRef.current
    replaceRef.current = null
    if (!file) return
    setWords(null)
    setKept(false)
    const pdf = (file.type || '').toLowerCase() === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    let next: Waiting
    if (pdf) {
      next = { pageId: newId(), blob: file, width: 0, height: 0, originalBytes: file.size, replace, preview: null }
    } else {
      setSending(true)
      try {
        const shot = await shrink(file, 'large')
        next = { pageId: newId(), blob: shot.blob, width: shot.width, height: shot.height, originalBytes: file.size, replace, preview: URL.createObjectURL(shot.blob) }
      } catch {
        setSending(false)
        setWords(RECEIPT_LINK_WORDS.notAPicture)
        return
      }
    }
    if (next.blob.size > RECEIPT_LINK_CAPS.pageBytes) {
      if (next.preview) URL.revokeObjectURL(next.preview)
      setSending(false)
      setWords(RECEIPT_LINK_WORDS.tooBig)
      return
    }
    setWaiting(next)
    void send(next)
  }

  const openCamera = (replace: string | null) => {
    replaceRef.current = replace
    cameraRef.current?.click()
  }
  const openFiles = (replace: string | null) => {
    replaceRef.current = replace
    filesRef.current?.click()
  }

  const tapJob = async (p: ReceiptJobPick) => {
    if (!charge.ticket) {
      setPick((was) => (samePick(was, p) ? null : p))
      return
    }
    if (busyJob || samePick(pickOf(charge), p)) return
    setBusyJob(true)
    setWords(null)
    const answer = await io.setJob(code, charge.id, p)
    setBusyJob(false)
    if (answer.ok) onCharge(answer.charge)
    else setWords(answer.why === 'signal' ? W.jobNoSignal : answer.words)
  }

  const t = charge.ticket
  const job = receiptJobLine(charge)
  const on = receiptOnChargeWords(charge)
  const chosen = t ? pickOf(charge) : pick
  const showChips = charge.dayJobs.length > 0 && !charge.sortedJob && !charge.dead && (!t || t.canChangeJob)
  const lastPage = t && t.pages.length > 0 ? t.pages[t.pages.length - 1]! : null
  const idle = !sending && !waiting

  return (
    <section style={card} data-testid="receipt-charge" aria-label={receiptChargeWords(charge)}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => void onPicked(e)} tabIndex={-1} aria-hidden style={hidden} data-testid="receipt-camera-input" />
      <input ref={filesRef} type="file" accept="image/*,application/pdf" onChange={(e) => void onPicked(e)} tabIndex={-1} aria-hidden style={hidden} data-testid="receipt-file-input" />

      {t ? (
        <div style={{ ...eyebrow, color: PAPER_GREEN }} data-testid="receipt-on-charge">
          {W.onCharge}
        </div>
      ) : null}
      <h2 style={{ margin: 0, fontSize: t ? 18 : 20, lineHeight: 1.25 }}>{t ? on.headline : charge.store}</h2>
      {t && on.line ? <div style={{ fontSize: 14 }}>{on.line}</div> : null}

      <div style={{ background: NOTE_BAND, borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6 }}>
        <div style={{ ...fact, fontSize: 16 }}>
          <span>{charge.moneyBack ? 'Came back' : 'Charged'}</span>
          <b>${formatCurrency(charge.amount)}</b>
        </div>
        {t ? (
          <div style={fact}>
            <span style={{ color: MUTED }}>Store</span>
            <span>{charge.store}</span>
          </div>
        ) : null}
        {charge.when ? (
          <div style={fact}>
            <span style={{ color: MUTED }}>When</span>
            <span>{receiptWhenWords(charge.when)}</span>
          </div>
        ) : null}
        <div style={fact}>
          <span style={{ color: MUTED }}>Card</span>
          <span>{receiptCardWords(charge.cardOf)}</span>
        </div>
        <div style={fact}>
          <span style={{ color: MUTED }}>Job</span>
          <span style={job.quiet ? { color: MUTED } : undefined}>{job.words}</span>
        </div>
      </div>

      {charge.dead ? <div style={{ fontSize: 14 }}>{W.deadLine}</div> : null}

      {t && t.pages.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="receipt-pages">
          {t.pages.map((p, i) =>
            p.pdf ? (
              <div key={p.id} style={{ width: 72, height: 92, borderRadius: 8, border: `1px solid ${HAIR}`, background: NOTE_BAND, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: MUTED }}>
                {W.pdf}
              </div>
            ) : (
              <img key={p.id} src={mine.get(p.id) ?? io.pageUrl(code, p.id)} alt={`Page ${i + 1} of the receipt`} style={{ width: 72, height: 92, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HAIR}`, background: NOTE_BAND }} />
            ),
          )}
        </div>
      ) : null}

      {waiting ? (
        <div role="status" style={{ display: 'grid', gap: 8 }} data-testid="receipt-waiting">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {waiting.preview ? <img src={waiting.preview} alt="The photo that is sending" style={{ width: 56, height: 72, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HAIR}` }} /> : null}
            <div style={{ fontSize: 14 }}>
              <div style={{ fontWeight: 700, color: lost ? PAPER_RED : INK }}>{lost ? W.noSignal : W.sending}</div>
              <div style={tiny}>{W.leaveNote}</div>
            </div>
          </div>
          {lost ? (
            <button type="button" style={{ ...press, ...portalPressFill(true) }} onClick={() => void send(waiting)} data-testid="receipt-retry">
              {W.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {words ? (
        <div role="alert" style={{ fontSize: 14, color: PAPER_RED }} data-testid="receipt-words">
          {words}
        </div>
      ) : null}
      {kept ? <div style={tiny}>{W.keptNote}</div> : null}

      {!charge.dead && !t ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <button type="button" style={{ ...press, ...portalPressFill(idle) }} disabled={!idle} onClick={() => openCamera(null)} data-testid="receipt-camera">
            {W.camera}
          </button>
          <button type="button" style={{ ...wordPress, textAlign: 'center' }} disabled={!idle} onClick={() => openFiles(null)} data-testid="receipt-file">
            {W.file}
          </button>
        </div>
      ) : null}

      {!charge.dead && t ? (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          {t.door === 'link' && lastPage && !lastPage.pdf ? (
            <button type="button" style={wordPress} disabled={!idle} onClick={() => openCamera(lastPage.id)} data-testid="receipt-retake">
              {W.retake}
            </button>
          ) : null}
          {t.canAddPage ? (
            <button type="button" style={wordPress} disabled={!idle} onClick={() => openFiles(null)} data-testid="receipt-add-page">
              {W.addPage}
            </button>
          ) : null}
          {t.canAddPage ? <span style={tiny}>{W.addPageNote}</span> : null}
        </div>
      ) : null}

      {showChips ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {W.jobAsk} <span style={{ fontWeight: 400, color: MUTED }}>{W.jobSkip}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-testid="receipt-jobs">
            {charge.dayJobs.map((j) => {
              const isOn = samePick(chosen, { jobId: j.id })
              return (
                <button key={j.id} type="button" aria-pressed={isOn} style={chipStyle(isOn, busyJob)} disabled={busyJob} onClick={() => void tapJob({ jobId: j.id })}>
                  {isOn ? '✓ ' : ''}
                  {j.label}
                </button>
              )
            })}
            <button type="button" aria-pressed={samePick(chosen, { noOneJob: true })} style={chipStyle(samePick(chosen, { noOneJob: true }), busyJob)} disabled={busyJob} onClick={() => void tapJob({ noOneJob: true })}>
              {samePick(chosen, { noOneJob: true }) ? '✓ ' : ''}
              {W.notOneJob}
            </button>
          </div>
          <div style={tiny}>{W.jobNote}</div>
        </div>
      ) : null}
      {!t && charge.sortedJob && !charge.dead ? <div style={tiny}>{W.sortedNote}</div> : null}
      {t && !charge.dead ? <div style={tiny}>{W.closeNote}</div> : null}
    </section>
  )
}

/** The page itself, given the link's code: it reads no router, so a render test hands it a code and its doors. */
export function ReceiptLinkPage({ code: given, io = receiptLinkIo, shrink = shrinkReportPhoto }: { code: string | null | undefined; io?: ReceiptLinkIo; shrink?: typeof shrinkReportPhoto }) {
  const code = useMemo(() => receiptLinkCode(given), [given])
  const [view, setView] = useState<View>(code ? { kind: 'loading' } : { kind: 'not_found' })
  const [reloadKey, setReloadKey] = useState(0)
  const waitingIds = useRef(new Set<string>())

  useEffect(() => {
    document.title = `Receipt · ${RECEIPT_COMPANY}`
  }, [])

  useEffect(() => {
    if (!code) return
    let live = true
    setView({ kind: 'loading' })
    void io.read(code).then((v) => {
      if (live) setView(v)
    })
    return () => {
      live = false
    }
  }, [code, io, reloadKey])

  // A photo that has not sent lives on this page alone: leaving asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (waitingIds.current.size === 0) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const onWaiting = useCallback((id: string, waiting: boolean) => {
    if (waiting) waitingIds.current.add(id)
    else waitingIds.current.delete(id)
  }, [])

  const onCharge = useCallback((next: ReceiptPageCharge) => {
    setView((v) => (v.kind === 'open' ? { ...v, charges: v.charges.map((c) => (c.id === next.id ? next : c)) } : v))
  }, [])

  if (view.kind === 'loading') {
    return (
      <div data-theme="light" style={page}>
        <div style={column}>
          <div style={eyebrow}>{W.eyebrow}</div>
          <div style={{ ...card, color: MUTED }} role="status" aria-busy="true">
            Opening the charge…
          </div>
        </div>
      </div>
    )
  }
  if (view.kind === 'closed') return <Stop head={W.closedHeadline} body={W.closedLine} door />
  if (view.kind === 'not_found') return <Stop head={W.closedHeadline} body={W.notFoundLine} />
  if (view.kind === 'locked') return <Stop head={W.lockedHeadline} body={W.lockedLine} />
  if (view.kind === 'signal' || view.kind === 'failed') {
    return (
      <div data-theme="light" style={page}>
        <div style={column}>
          <div style={eyebrow}>{W.eyebrow}</div>
          <div style={card} role="alert">
            <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{W.signalHeadline}</h1>
            <p style={{ margin: 0, color: MUTED }}>{view.kind === 'signal' ? W.signalLine : view.words}</p>
            <button type="button" style={{ ...press, ...portalPressFill(true) }} onClick={() => setReloadKey((k) => k + 1)} data-testid="receipt-reload">
              {W.retry}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const several = view.charges.length > 1
  return (
    <div data-theme="light" style={page}>
      <div style={column}>
        <div style={eyebrow}>{W.eyebrow}</div>
        {several ? <h1 style={{ margin: '6px 0 0', fontSize: 20, lineHeight: 1.25 }}>{view.charges.length} charges on your card</h1> : null}
        {view.charges.map((c) => (
          <ChargeCard key={c.id} code={code!} charge={c} io={io} shrink={shrink} onCharge={onCharge} onWaiting={onWaiting} />
        ))}
        <p style={{ ...tiny, margin: '14px 2px 0' }}>
          {several ? 'This link is for these charges alone. It shows nothing else.' : W.onlyThis} {receiptClosesWords(view.closesOn)}
        </p>
      </div>
    </div>
  )
}

/** The route, `/r/:code`: outside the Layout, so the sign-in gate never swallows a link. */
export default function ReceiptLink() {
  const { code } = useParams<{ code: string }>()
  return <ReceiptLinkPage code={code} />
}
