/**
 * Share a painted map (punch list #345, PR 4; re-laid by #394): one sheet for every way out. A link
 * shows the map to anyone who holds it, with no sign-in, stays current when the map is added to,
 * and can be ended.
 *
 * The owner, 2026-11-18: *how could I offer this page with less words and in a more intuitive way
 * where the user doesn't have to put in the effort to read so much?* So the sheet has no Make a
 * link step. Every press that sends makes the link itself, one press leads in blue, and each press
 * is a picture and a name with no sentence under it (`lib/paintedMap/paintedMapShare.ts`). What a
 * reader sees and does not is one line with a press that opens the rest, before the link goes
 * anywhere.
 *
 * The code is handed out once and the table keeps only its hash. So the device that made a link
 * remembers it, to send it again, and any other device makes a link of its own on its first press.
 *
 * **Text it from my phone…** opens the phone's own Messages with the words written. The phone picks
 * the link's code (step 3), so the address is known at the press and Messages opens inside it, while
 * the server is told behind. That is done only once the server has said a link can be made, asked
 * when the sheet opens, so a text is never written around a link that would be refused. Without
 * that yes the link is made first and Messages opens about a second after the press. A phone may
 * refuse that. The sheet then says the link is ready and the same press, now **Open Messages**,
 * works at once.
 *
 * **Text the customer…** (v2.7338, renamed here): for the office team, on a map that is on a job,
 * the link goes to the job's customer from the company's number. The press opens the customer's own
 * box on Text in place (`ContractTextDoor`), with the map's name and the link in it. Nothing is
 * sent in the press: the box's send window is the confirm (`lib/paintedMap/paintedMapText.ts`).
 */
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ConfirmDialog from '../ConfirmDialog'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PAINTED_MAP_SHARE_WORDS, linkEndsWords, linkMadeDayWords, paintedMapLinkOpen, paintedMapLinkUrl, visitLine, type PaintedMapLinkRow, type PaintedMapVisitRow } from '../../lib/paintedMap/paintedMapLink'
import { formatDenverDateTimeShort } from '../../utils/dateUtils'
import { canMakePaintedMapLink, endPaintedMapLinks, loadPaintedMapLinks, loadPaintedMapVisits, pickPaintedMapLinkCode, registerPaintedMapLink, rememberPaintedMapLink, rememberedPaintedMapLink } from '../../lib/paintedMap/paintedMapLinkIo'
import { PAINTED_MAP_SHARE_SHEET_WORDS as W, paintedMapEndWords, paintedMapLinksOutWords, paintedMapOwnTextHref, paintedMapShareTileName, paintedMapShareWays, type PaintedMapShareTile } from '../../lib/paintedMap/paintedMapShare'
import { PAINTED_MAP_MESSAGES_LATE_MS, copyWhenMade, onPageLeft, openPhoneMessages } from '../../lib/paintedMap/paintedMapShareIo'
import { PAINTED_MAP_TEXT_WORDS, paintedMapTextWords, type PaintedMapTextJob } from '../../lib/paintedMap/paintedMapText'
import { loadPaintedMapTextJob } from '../../lib/paintedMap/paintedMapTextIo'
import { isPhoneDevice } from '../../lib/quo/dial'
import type { ReplyIo } from '../../lib/messages/replyIo'
import type { Contact } from '../../lib/contacts/kernel'
import { ContractTextDoor } from '../jobs/ContractTextDoor'
import { PaintedMapCopiesFold, PaintedMapPictureView, usePaintedMapCopies, type PaintedMapCopiesIo, type PaintedMapWhole } from './PaintedMapCopies'
import { PaintedMapShareIcon, type PaintedMapShareIconName } from './PaintedMapShareIcon'
import { PAINTED_MAP_SHEET_Z } from '../../lib/windowLayers'
import { formatErrorMessage } from '../../utils/errorHandling'

type Props = {
  mapId: string
  mapName: string
  /** The map with its lines and places, for a copy: a picture, a page to print. Left out, the sheet offers the link alone. */
  whole?: PaintedMapWhole | null
  onClose: () => void
  /** Where links point. The app's own address by default. */
  origin?: string
  /** Text the customer…: the office team writes to a customer (`jobBoxOffered`). Left out, the sheet offers no such text. */
  mayText?: boolean
  /** The job the map is on, for Text the customer…. Left out, the copy's job is used. */
  jobId?: string | null
  /** Whether this is a phone, where the person's own Messages can be opened. The device says by default. */
  phone?: boolean
  /** For a smoke: the job's read, the customer's box's contact and sends, the phone's Messages and the copies' browser parts. */
  loadJob?: (jobId: string) => Promise<PaintedMapTextJob | null>
  textBox?: { load?: (customerId: string) => Promise<Contact>; io?: ReplyIo }
  openMessages?: (href: string) => Promise<boolean>
  copiesIo?: PaintedMapCopiesIo
  /**
   * Told when a picture of the map comes onto the screen and when it leaves (punch list #387). The picture is Esri's
   * photograph, and a map's window that draws on Google takes Google's map down while one shows.
   */
  onPictureShown?: (shown: boolean) => void
}

/** The press that is making the link right now. A copy makes one quietly. */
type Making = 'own-text' | 'customer-text' | 'copy' | 'code' | 'another' | 'quiet'

const base: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const press: CSSProperties = { ...base, minHeight: 48, padding: '0 0.9rem', borderRadius: 10 }
/** The one blue press. White words sit on #2563eb, never a paler blue. */
const leadPress: CSSProperties = { ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', width: '100%', minHeight: 56, padding: '0.4rem 0.8rem', borderRadius: 10, background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontSize: '1.0625rem' }
const widePress: CSSProperties = { ...base, display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', minHeight: 56, padding: '0.4rem 0.8rem', borderRadius: 10, textAlign: 'left' }
const tilePress: CSSProperties = { ...base, display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 60, padding: '0.4rem 0.7rem', borderRadius: 10, textAlign: 'left', lineHeight: 1.2 }
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const quietPress: CSSProperties = { minHeight: 44, padding: '0 0.2rem', background: 'none', border: 'none', color: 'var(--text-link)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }
const linkWords: CSSProperties = { font: '600 0.8125rem/1.3 ui-monospace, SFMono-Regular, Menlo, monospace', overflowWrap: 'anywhere', userSelect: 'all' }

const TILE_ICON: Record<PaintedMapShareTile, PaintedMapShareIconName> = { code: 'code', copy: 'copy', picture: 'picture', another: 'another' }

/** A moment in the app's words, or nothing for a time that is not one. */
const whenOf = (iso: string): string | null => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverDateTimeShort(ms) : null
}

const isPhoneHere = (): boolean => typeof navigator !== 'undefined' && isPhoneDevice(navigator.userAgent, navigator.maxTouchPoints)

export function PaintedMapShareSheet({ mapId, mapName, whole = null, onClose, origin = typeof window !== 'undefined' ? window.location.origin : '', mayText = false, jobId, phone, loadJob = loadPaintedMapTextJob, textBox, openMessages = openPhoneMessages, copiesIo, onPictureShown }: Props) {
  const isTopmost = useModalStackEntry()
  const [mine, setMine] = useState<{ code: string; endsOn: string | null } | null>(() => rememberedPaintedMapLink(mapId))
  const [links, setLinks] = useState<PaintedMapLinkRow[] | null>(null)
  /** Who opened the map's links. The office's and the painter's to read: anyone else gets none, and the sheet says nothing. */
  const [visits, setVisits] = useState<PaintedMapVisitRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [making, setMaking] = useState<Making | null>(null)
  /** The sheet shows one thing at a time: every way, the code alone, or the picture alone. */
  const [view, setView] = useState<'ways' | 'code' | 'picture'>('ways')
  /** The link was made and the phone did not open Messages by itself: the press reads Open Messages. */
  const [messagesWait, setMessagesWait] = useState(false)
  const [copied, setCopied] = useState(false)
  /** The browser would not copy: the link shows, to press and hold. */
  const [copyRefused, setCopyRefused] = useState(false)
  const [seeOpen, setSeeOpen] = useState(false)
  const [foldOpen, setFoldOpen] = useState(false)
  const [ending, setEnding] = useState(false)
  /** Text the customer…: closed, reading the job, or the customer's box open on it. */
  const [texting, setTexting] = useState<{ kind: 'closed' } | { kind: 'opening' } | { kind: 'open'; job: PaintedMapTextJob }>({ kind: 'closed' })
  const minting = useRef<Promise<{ url: string; endsOn: string | null } | null> | null>(null)
  /** When the phone was last handed the Messages address, for a page that is left later than the wait. */
  const handedAt = useRef(0)
  const [onPhone] = useState(() => phone ?? isPhoneHere())
  /** The server said a link can be made, so the phone's own text may leave inside the press. */
  const [mayHandOff, setMayHandOff] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const ways = paintedMapShareWays({ office: mayText, jobId: jobId === undefined ? (whole?.map.jobId ?? null) : jobId, phone: onPhone, canShare, copies: !!whole })

  const readLinks = useCallback(async () => {
    const res = await loadPaintedMapLinks(mapId)
    if (res.ok) setLinks(res.value)
    else setError(res.error)
    // The list of who opened it is words beside the link. A read of it that fails costs the list and never the sheet.
    const who = await loadPaintedMapVisits(mapId).catch(() => null)
    setVisits(who?.ok ? who.value : [])
  }, [mapId])

  useEffect(() => {
    void readLinks()
  }, [readLinks])

  // Asked once, on a phone alone: only the phone's own text is handed over inside the press.
  useEffect(() => {
    if (!onPhone) return
    let live = true
    void canMakePaintedMapLink(mapId).then((yes) => live && setMayHandOff(yes))
    return () => {
      live = false
    }
  }, [mapId, onPhone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, onClose])

  const nowIso = new Date().toISOString()
  const open = (links ?? []).filter((l) => paintedMapLinkOpen(l, nowIso))
  // The link this device remembers is used only while a link of the map is still open: ended from elsewhere, it is forgotten.
  const live = mine && (links === null || open.length > 0) ? mine : null
  const url = live ? paintedMapLinkUrl(origin, live.code) : null
  const opened = open.reduce((sum, l) => sum + (l.open_count ?? 0), 0)

  // The wait for Messages can end before a slow phone has switched apps. A page that is left after
  // a hand-off did open Messages, so what the sheet said about it not opening is taken back.
  useEffect(
    () =>
      onPageLeft(() => {
        if (Date.now() - handedAt.current > PAINTED_MAP_MESSAGES_LATE_MS) return
        setMessagesWait(false)
        setError((words) => (words === W.noMessages ? null : words))
        setSaid((words) => (words === W.ready ? null : words))
      }),
    [],
  )

  useEffect(() => {
    if (mine && links !== null && open.length === 0) {
      rememberPaintedMapLink(mapId, null)
      setMine(null)
    }
  }, [mine, links, open.length, mapId])

  /**
   * Starts a link whose code this phone picks. The address is known at once. `registered` settles when
   * the server has it, with the link as it stands, or with nothing when the server refused or the signal
   * was lost. The ask for it leaves before this returns. A quiet make (a copy's) says nothing when it
   * fails, since the copy goes on without it.
   */
  const startLink = (by: Making): { url: string; registered: Promise<{ url: string; endsOn: string | null } | null> } => {
    const picked = pickPaintedMapLinkCode()
    const run = (async () => {
      setMaking(by)
      try {
        const made = await registerPaintedMapLink(mapId, picked)
        const link = { code: made.code, endsOn: made.endsOn }
        rememberPaintedMapLink(mapId, link)
        // The list from before the press has no open link in it, and against it a link just made would
        // look like one ended elsewhere and be forgotten. So the list is emptied until it is read again.
        setLinks(null)
        setMine(link)
        void readLinks()
        return { url: paintedMapLinkUrl(origin, made.code), endsOn: made.endsOn }
      } catch (e) {
        if (by !== 'quiet') setError(formatErrorMessage(e, 'The link was not made.'))
        return null
      } finally {
        setMaking(null)
        minting.current = null
      }
    })()
    minting.current = run
    return { url: paintedMapLinkUrl(origin, picked), registered: run }
  }

  /** The link this device sends: the one it holds, or one made now. Two presses in the same moment share one make. */
  const ensureLink = (by: Making): Promise<{ url: string; endsOn: string | null } | null> => {
    if (url && live) return Promise.resolve({ url, endsOn: live.endsOn })
    return minting.current ?? startLink(by).registered
  }

  const clearSaid = () => {
    setError(null)
    setSaid(null)
    setCopyRefused(false)
  }
  /** Another way was pressed: the text press goes back to its own name. Either name opens Messages. */
  const otherWay = () => {
    clearSaid()
    setMessagesWait(false)
  }

  /** Text it from my phone…: the phone's own Messages, the words written, nobody picked. */
  const ownText = async () => {
    if (making) return
    clearSaid()
    const had = url
    if (!had && mayHandOff) {
      // No link is out and the server said one can be made. The ask for it leaves first, then the phone
      // is handed the address, both inside the press: no wait, and no question from the phone's browser.
      const started = startLink('own-text')
      handedAt.current = Date.now()
      const [left, link] = await Promise.all([openMessages(paintedMapOwnTextHref(mapName, started.url)), started.registered])
      // The text is already written. A link that was then refused, lost, or made under another code is not the one in it.
      if (!link) setError((reason) => `${reason ?? 'The link was not made.'} ${W.textLinkDead}`)
      else if (link.url !== started.url) setError(W.textLinkDead)
      else if (!left) setError(W.noMessages)
      return
    }
    const link = had ? { url: had } : await ensureLink('own-text')
    if (!link) return
    handedAt.current = Date.now()
    const went = await openMessages(paintedMapOwnTextHref(mapName, link.url))
    if (went) {
      setMessagesWait(false)
    } else if (had) {
      // The link was already made, so nothing stood between the press and Messages: this phone will not open it.
      setMessagesWait(false)
      setError(W.noMessages)
    } else {
      setMessagesWait(true)
      setSaid(W.ready)
    }
  }

  const copy = async () => {
    if (making) return
    otherWay()
    setCopied(false)
    // Called before anything is awaited, so Safari takes the copy inside the press.
    const made = ensureLink('copy')
    const done = await copyWhenMade(made.then((link) => link?.url ?? null))
    if (done) {
      setCopied(true)
      setSaid(W.copiedSaid)
    } else if (await made) {
      // The link is made and the clipboard is closed to the page: the link shows, to press and hold.
      setCopyRefused(true)
    }
  }

  const sendAnotherWay = async () => {
    if (making) return
    otherWay()
    const had = url
    const link = had ? { url: had } : await ensureLink('another')
    if (!link) return
    try {
      await navigator.share({ title: mapName, text: mapName, url: link.url })
    } catch (e) {
      // Closed without sending: nothing to say. Refused after the wait for the link: the press again works at once.
      if ((e as { name?: string }).name === 'AbortError') return
      if (had) setError(W.noShareSheet)
      else setSaid(W.readyAnother)
    }
  }

  const showCode = async () => {
    if (making) return
    otherWay()
    if (await ensureLink('code')) setView('code')
  }

  const textIt = async (textJobId: string) => {
    if (making) return
    if (texting.kind !== 'closed') {
      setTexting({ kind: 'closed' })
      return
    }
    clearSaid()
    if (!(await ensureLink('customer-text'))) return
    setTexting({ kind: 'opening' })
    try {
      const job = await loadJob(textJobId)
      if (job) setTexting({ kind: 'open', job })
      else {
        setTexting({ kind: 'closed' })
        setError(PAINTED_MAP_TEXT_WORDS.jobGone)
      }
    } catch (e) {
      setTexting({ kind: 'closed' })
      setError(formatErrorMessage(e, PAINTED_MAP_TEXT_WORDS.jobGone))
    }
  }

  const copies = usePaintedMapCopies({ whole, link: url && live ? { url, endsOn: live.endsOn } : null, ensureLink: () => ensureLink('quiet'), ...(copiesIo ? { io: copiesIo } : {}) })

  // Said before the picture is painted and not after, so the picture and a Google map are never on the screen together.
  const pictureShown = view === 'picture' && !!copies.picture
  const tellPictureShown = useRef(onPictureShown)
  tellPictureShown.current = onPictureShown
  useLayoutEffect(() => {
    tellPictureShown.current?.(pictureShown)
  }, [pictureShown])

  const picture = async () => {
    if (making) return
    otherWay()
    // A picture already made is shown again. The map cannot change while this sheet is over it.
    if (copies.picture || (await copies.makePicture())) setView('picture')
  }

  const end = async () => {
    setEnding(false)
    if (busy) return
    setBusy(true)
    clearSaid()
    try {
      const n = await endPaintedMapLinks(mapId)
      rememberPaintedMapLink(mapId, null)
      setMine(null)
      setView('ways')
      setMessagesWait(false)
      setCopied(false)
      setTexting({ kind: 'closed' })
      setSaid(n === 1 ? 'The link is ended. Anyone who opens it now reads that the map is no longer shared.' : `${n} links are ended. Anyone who opens one now reads that the map is no longer shared.`)
      await readLinks()
    } catch (e) {
      setError(formatErrorMessage(e, 'The link was not ended.'))
    } finally {
      setBusy(false)
    }
  }

  const tilePressed: Record<PaintedMapShareTile, () => void> = { code: () => void showCode(), copy: () => void copy(), picture: () => void picture(), another: () => void sendAnotherWay() }
  const tileBusy = (tile: PaintedMapShareTile): boolean => (tile === 'picture' ? copies.drawing : making === tile)
  /** A tile's words: its name, or what it is doing, or that it is done. */
  const tileWords = (tile: PaintedMapShareTile): string => {
    if (tile === 'picture') return copies.drawing ? 'Making the picture…' : paintedMapShareTileName(tile)
    if (making === tile) return W.making
    return tile === 'copy' && copied ? W.copied : paintedMapShareTileName(tile)
  }
  const linkShown = url ? url.replace(/^https?:\/\//, '') : null

  const linkBlock =
    open.length > 0 ? (
      <div data-painted-share-state style={{ display: 'grid', gap: '0.3rem', fontSize: '0.875rem', color: 'var(--text-700)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
        <span>{paintedMapLinksOutWords({ open: open.length, since: linkMadeDayWords(open[open.length - 1]?.made_at), opened })}</span>
        {live ? <span>{linkEndsWords(live.endsOn)}</span> : null}
        <button type="button" style={{ ...press, justifySelf: 'start', minHeight: 44, fontSize: '0.875rem', margin: '0.15rem 0 0.2rem', ...(busy ? dead : {}) }} disabled={busy} onClick={() => setEnding(true)}>
          {paintedMapEndWords(open.length)}
        </button>
        {visits.length > 0 ? (
          <div data-painted-share-visits style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-700)' }}>{PAINTED_MAP_SHARE_WORDS.whoHead}</div>
            {visits.map((v) => {
              const line = visitLine(v, whenOf)
              return (
                <div key={line.id} data-painted-share-visit style={{ fontSize: '0.875rem', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', display: 'grid', gap: '0.1rem' }}>
                  <span>
                    <b>{line.name}</b>
                    {line.teammate ? <span style={{ color: 'var(--text-muted)' }}> · {PAINTED_MAP_SHARE_WORDS.signedIn}</span> : null}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{line.detail}</span>
                  {line.where && line.whereUrl ? (
                    <span style={{ fontSize: '0.8125rem' }}>
                      {line.where}{' '}
                      {/* A full-height target that takes one line's room: it reaches past its words. */}
                      <a href={line.whereUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-blue-700)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-12px 0' }}>
                        {PAINTED_MAP_SHARE_WORDS.seeWhere}
                      </a>
                    </span>
                  ) : line.where ? (
                    // Their phone gave only an area: its middle is nobody's place, so there is no place to open.
                    <span data-painted-share-visit-area style={{ fontSize: '0.8125rem' }}>{line.where}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    ) : null

  return createPortal(
    <>
      <div
        data-painted-map-share
        style={{ position: 'fixed', inset: 0, zIndex: PAINTED_MAP_SHEET_Z, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
        onClick={(e) => {
          // The map's window sits behind: this press closes the sheet alone.
          e.stopPropagation()
          onClose()
        }}
      >
        <div role="dialog" aria-modal="true" aria-label="Share this map" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Share this map</h2>
            <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 44, padding: '0 0.25rem' }}>
              Close
            </button>
          </div>
          <div style={{ display: 'grid', gap: '0.6rem', padding: '0.85rem 1rem calc(0.8rem + env(safe-area-inset-bottom, 0px))' }}>
            {view === 'code' && url ? (
              <>
                {/* A scanner needs dark on white: this panel stays light in both themes. */}
                <div data-theme="light" data-painted-share-code style={{ display: 'grid', justifyItems: 'center', gap: '0.4rem', padding: '0.9rem', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)' }}>
                  <QRCodeSVG value={url} size={230} level="M" marginSize={2} title={`A code that opens ${mapName}`} />
                  <b>Point a phone’s camera here</b>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>It opens the map. No app, no sign-in.</span>
                  <span data-painted-share-link style={linkWords}>{linkShown}</span>
                </div>
                <button type="button" style={press} onClick={() => setView('ways')}>
                  {W.hideCode}
                </button>
              </>
            ) : view === 'picture' && copies.picture ? (
              <PaintedMapPictureView copies={copies} onBack={() => setView('ways')} backWords={W.back} />
            ) : (
              <>
                {error ? <p role="alert" style={note}>{error}</p> : null}
                {copyRefused && linkShown ? (
                  <p role="alert" style={{ ...note, display: 'grid', gap: '0.2rem' }}>
                    {W.wouldNotCopy}
                    <span data-painted-share-link style={linkWords}>{linkShown}</span>
                  </p>
                ) : null}
                {said ? <p role="status" data-painted-share-said style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-700)' }}>{said}</p> : null}
                {!foldOpen && copies.error ? <p role="alert" style={note}>{copies.error}</p> : null}
                {!foldOpen && copies.said ? <p role="status" data-painted-copies-said style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-700)' }}>{copies.said}</p> : null}

                {ways.ownText ? (
                  <button type="button" data-painted-share-own-text data-painted-share-at-once={mayHandOff} style={making === 'own-text' ? { ...leadPress, ...dead } : leadPress} disabled={making !== null} onClick={() => void ownText()}>
                    {making === 'own-text' ? (
                      W.making
                    ) : (
                      <>
                        <PaintedMapShareIcon name="text" />
                        {messagesWait ? W.openMessages : W.ownText}
                      </>
                    )}
                  </button>
                ) : null}
                {ways.customer.kind === 'offered' ? (
                  <button
                    type="button"
                    data-painted-share-text
                    style={making === 'customer-text' || texting.kind === 'opening' ? { ...widePress, ...dead } : ways.lead === 'customer-text' ? { ...widePress, background: '#2563eb', borderColor: '#2563eb', color: '#fff' } : widePress}
                    aria-expanded={texting.kind !== 'closed'}
                    disabled={making !== null || texting.kind === 'opening'}
                    onClick={() => void textIt(ways.customer.kind === 'offered' ? ways.customer.jobId : '')}
                  >
                    <PaintedMapShareIcon name="customer" color={ways.lead === 'customer-text' || making === 'customer-text' || texting.kind === 'opening' ? 'currentColor' : 'var(--text-link)'} />
                    <span style={{ display: 'grid', gap: 1 }}>
                      {making === 'customer-text' ? W.making : texting.kind === 'opening' ? PAINTED_MAP_TEXT_WORDS.opening : W.customer}
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, opacity: ways.lead === 'customer-text' ? 0.9 : 1, color: ways.lead === 'customer-text' ? 'inherit' : 'var(--text-muted)' }}>{W.customerSub}</span>
                    </span>
                  </button>
                ) : null}
                {ways.customer.kind === 'no-job' ? (
                  // The press keeps its place so the office does not hunt for it, and says why it is dead.
                  <button type="button" data-painted-share-text-none style={{ ...widePress, ...dead }} disabled>
                    <PaintedMapShareIcon name="customer" />
                    <span style={{ display: 'grid', gap: 1 }}>
                      {W.customer}
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{ways.customer.words}</span>
                    </span>
                  </button>
                ) : null}
                {texting.kind === 'open' && url ? (
                  <ContractTextDoor
                    title={PAINTED_MAP_TEXT_WORDS.head}
                    jobId={texting.job.id}
                    jobName={texting.job.name}
                    jobStatus={texting.job.status}
                    customerId={texting.job.customerId}
                    typedPhone=""
                    words={paintedMapTextWords(mapName, url)}
                    onClose={() => setTexting({ kind: 'closed' })}
                    // The box's own toast says whether the text went or waits: the door only closes.
                    onSent={() => setTexting({ kind: 'closed' })}
                    {...(textBox?.load ? { load: textBox.load } : {})}
                    {...(textBox?.io ? { io: textBox.io } : {})}
                  />
                ) : null}
                {ways.lead === 'copy' ? (
                  <button type="button" data-painted-share-tile="copy" style={making === 'copy' ? { ...leadPress, ...dead } : leadPress} disabled={making !== null} onClick={() => void copy()}>
                    {making === 'copy' ? (
                      W.making
                    ) : (
                      <>
                        <PaintedMapShareIcon name={copied ? 'copied' : 'copy'} />
                        {copied ? W.copied : W.copy}
                      </>
                    )}
                  </button>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {ways.tiles.map((tile, i) => {
                    const waiting = tileBusy(tile)
                    const done = tile === 'copy' && copied
                    // An odd tile out takes the whole row, so none sits beside a hole.
                    const alone = i === ways.tiles.length - 1 && ways.tiles.length % 2 === 1
                    return (
                      <button key={tile} type="button" data-painted-share-tile={tile} style={{ ...tilePress, ...(alone ? { gridColumn: '1 / -1' } : {}), ...(waiting ? dead : {}), ...(done ? { borderColor: 'var(--text-green-700)' } : {}) }} disabled={making !== null || copies.drawing} onClick={tilePressed[tile]}>
                        <PaintedMapShareIcon name={done ? 'copied' : TILE_ICON[tile]} color={waiting ? 'currentColor' : done ? 'var(--text-green-700)' : 'var(--text-link)'} />
                        {tileWords(tile)}
                      </button>
                    )
                  })}
                </div>

                {ways.fold ? (
                  <>
                    <button type="button" data-painted-share-fold aria-expanded={foldOpen} onClick={() => setFoldOpen((on) => !on)} style={{ ...base, display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 48, padding: '0 0.8rem', borderRadius: 10, borderColor: 'var(--border)', background: 'var(--bg-subtle)', textAlign: 'left' }}>
                      <PaintedMapShareIcon name="print" size={22} />
                      {W.fold}
                      <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{foldOpen ? '▴' : '▾'}</span>
                    </button>
                    {foldOpen ? <PaintedMapCopiesFold copies={copies} /> : null}
                  </>
                ) : null}

                {linkBlock}

                <div data-painted-share-see style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.2rem' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{W.short}</span>
                  <button type="button" style={{ ...quietPress, flex: 'none' }} aria-expanded={seeOpen} onClick={() => setSeeOpen((on) => !on)}>
                    {seeOpen ? W.seeHide : W.seePress}
                  </button>
                </div>
                {seeOpen ? (
                  <div data-painted-share-see-all style={{ fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', borderRadius: 8, padding: '0.5rem 0.65rem', display: 'grid', gap: '0.2rem' }}>
                    <span>{PAINTED_MAP_SHARE_WORDS.open}</span>
                    <span>{PAINTED_MAP_SHARE_WORDS.asks}</span>
                    <span>{PAINTED_MAP_SHARE_WORDS.see}</span>
                    <span>{PAINTED_MAP_SHARE_WORDS.notSee}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
      {ending ? (
        <ConfirmDialog
          zIndex={PAINTED_MAP_SHEET_Z + 60}
          title={open.length === 1 ? 'End this link?' : `End all ${open.length} links?`}
          body="Anyone who opens it after this reads that the map is no longer shared. A copy they already saved is theirs to keep."
          confirmLabel={open.length === 1 ? 'End the link' : `End the ${open.length} links`}
          cancelLabel="Keep it"
          onConfirm={() => void end()}
          onCancel={() => setEnding(false)}
        />
      ) : null}
    </>,
    document.fullscreenElement ?? document.body,
  )
}
