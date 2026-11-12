/**
 * First look on a thread (punch list #319 PR 1): the look's card above a person's lines (`threadSlots.tsx`'s
 * `aboveLines`). One card a look that is still open: who asked, where it stands, the photos drawn, a video in a player,
 * the pictures they texted in since the ask, their own words, and the presses: **Start an estimate**, **Book a visit**,
 * **Ask for more** and **Close the look**. It reads again when the thread gains a line and every half minute while a
 * link is out, and stamps the look as looked at the first time the office sees files on it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import type { Contact } from '../../lib/contacts/kernel'
import { SHOW_ASK_WORDS } from '../../lib/firstLook/ask'
import { askForPhotos } from '../../lib/firstLook/askBus'
import { LOOK_CARD_WORDS, lookAskedWords, lookCards, lookStanding, lookWordsFor, type LookCard, type ThreadLook, type ThreadLookFile } from '../../lib/firstLook/card'
import { firstLookState } from '../../lib/firstLook/look'
import { supabaseFirstLookThreadIo, type FirstLookThreadIo } from '../../lib/firstLook/threadIo'
import { LEAD_DOOR_WORDS, newestInboundWords } from '../../lib/messages/leadDoors'
import type { LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import { formatDenverCalendarDayShort, formatDenverDateTimeShort } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useOpenThread } from '../gc/messages/openThread'
import { useLookDoors } from './useLookDoors'

const DEFAULT_IO = supabaseFirstLookThreadIo()

/** How often the card reads again while a link is out, so files show without a press. */
export const LOOK_CARD_REREAD_MS = 30_000

const wrap: CSSProperties = { borderBottom: '1px solid var(--border)', background: 'var(--bg-blue-tint)', padding: '0.55rem 0.9rem', display: 'grid', gap: '0.5rem' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.6rem 0.7rem', display: 'grid', gap: '0.45rem' }
const head: CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem' }
const press: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.25rem 0.7rem', background: 'var(--surface)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', font: 'inherit' }
const quiet: CSSProperties = { ...press, color: 'var(--text-muted)', fontWeight: 500 }
const thumb: CSSProperties = { width: 76, height: 76, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }
const fileChip: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-base)', background: 'var(--surface)', display: 'inline-flex', gap: 6, alignItems: 'center' }

/** One file on the card: a photo as a picture, a video in a player, either as a named chip when the browser cannot draw it. */
function LookFile({ kind, url, label, texted }: { kind: 'photo' | 'video'; url: string | undefined; label: string; texted: boolean }) {
  const [failed, setFailed] = useState(false)
  const title = texted ? `${label}, ${LOOK_CARD_WORDS.texted}` : label
  if (!url) {
    return (
      <span data-look-file="waiting" style={fileChip} title={LOOK_CARD_WORDS.notDrawn}>
        {label}
      </span>
    )
  }
  if (failed) {
    return (
      <span data-look-file="chip" style={fileChip} title={kind === 'video' ? LOOK_CARD_WORDS.videoNotPlayed : undefined}>
        {label}
        <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
          {LOOK_CARD_WORDS.open}
        </a>
      </span>
    )
  }
  if (kind === 'video') {
    return (
      <video data-look-file="video" controls preload="metadata" src={url} title={title} aria-label={title} onError={() => setFailed(true)} style={{ maxWidth: 'min(100%, 260px)', maxHeight: 180, borderRadius: 8, border: '1px solid var(--border)' }} />
    )
  }
  return (
    <a data-look-file="photo" href={url} target="_blank" rel="noreferrer" title={title}>
      <img src={url} alt={title} loading="lazy" onError={() => setFailed(true)} style={thumb} />
    </a>
  )
}

function OneLook({ contact, cardOf, urls, nowIso, io, doorsIo, onChanged }: { contact: Contact; cardOf: LookCard; urls: Readonly<Record<string, string>>; nowIso: string; io: FirstLookThreadIo; doorsIo?: LeadDoorsIo; onChanged: () => void }) {
  const open = useOpenThread()
  const toasts = useOptionalToastContext()
  const doors = useLookDoors(contact, doorsIo)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const { look } = cardOf
  const words = lookWordsFor(look, newestInboundWords(open?.lines ?? [], contact.id))
  const say = (text: string, tone: 'success' | 'error' | 'info') => toasts?.showToast(text, tone)
  const hasDoors = doors.has
  const pressing = busy !== null || doors.pressing
  const book = () => doors.book(words)
  const startEstimate = () => doors.startEstimate(words)
  const close = async () => {
    setBusy('close')
    try {
      await io.stamp(look.id, 'closed')
      say(LOOK_CARD_WORDS.closed, 'success')
      onChanged()
    } catch (e) {
      say(formatErrorMessage(e, 'The look was not closed.'), 'error')
    } finally {
      setBusy(null)
      setClosing(false)
    }
  }

  let photoAt = 0
  let videoAt = 0
  const label = (kind: 'photo' | 'video') => (kind === 'photo' ? `Photo ${++photoAt}` : `Video ${++videoAt}`)
  return (
    <section data-first-look-card={look.id} aria-label={LOOK_CARD_WORDS.title} style={card}>
      <div style={head}>
        <strong>{LOOK_CARD_WORDS.title}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{lookAskedWords(look, formatDenverCalendarDayShort(Date.parse(look.made_at)))}</span>
      </div>
      <div data-look-standing style={{ fontSize: '0.85rem' }}>
        {lookStanding(cardOf, nowIso, (iso) => formatDenverDateTimeShort(Date.parse(iso)))}
      </div>
      {cardOf.files.length + cardOf.texted.length > 0 && (
        <div data-look-files style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {cardOf.files.map((f) => (
            <LookFile key={f.id} kind={f.kind} url={urls[`look:${f.storage_path}`]} label={label(f.kind)} texted={false} />
          ))}
          {cardOf.texted.map((f) => (
            <LookFile key={f.id} kind={f.kind} url={urls[`text:${f.id}`]} label={label(f.kind)} texted />
          ))}
        </div>
      )}
      {(look.words?.trim() || look.place?.trim()) && (
        <div data-look-words style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{look.place?.trim() ? `${look.place.trim()}. ` : ''}</span>
          {look.words?.trim() && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>{LOOK_CARD_WORDS.theirWords}: </span>
              {look.words.trim()}
            </>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {hasDoors && (
          <>
            <button type="button" style={press} title={LEAD_DOOR_WORDS.estimateTip} disabled={pressing} onClick={() => void startEstimate()}>
              {LOOK_CARD_WORDS.startEstimate}
            </button>
            <button type="button" style={press} title={LEAD_DOOR_WORDS.bookTip} disabled={pressing} onClick={() => void book()}>
              {LOOK_CARD_WORDS.bookVisit}
            </button>
          </>
        )}
        <button type="button" style={press} disabled={pressing} onClick={() => askForPhotos(contact.id)}>
          {cardOf.files.length + cardOf.texted.length === 0 ? SHOW_ASK_WORDS.again : SHOW_ASK_WORDS.more}
        </button>
        {closing ? (
          <>
            <span style={{ fontSize: '0.8rem' }}>{LOOK_CARD_WORDS.closeAsk}</span>
            <button type="button" style={press} disabled={busy === 'close'} onClick={() => void close()}>
              {LOOK_CARD_WORDS.close}
            </button>
            <button type="button" style={quiet} disabled={busy === 'close'} onClick={() => setClosing(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" style={quiet} title={LOOK_CARD_WORDS.closeTip} disabled={pressing} onClick={() => setClosing(true)}>
            {LOOK_CARD_WORDS.close}
          </button>
        )}
      </div>
      {!hasDoors && contact.kind === 'unknown' && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{LOOK_CARD_WORDS.nameFirst}</div>}
    </section>
  )
}

export function FirstLookCards({ contact, io = DEFAULT_IO, doorsIo }: { contact: Contact; io?: FirstLookThreadIo; doorsIo?: LeadDoorsIo }) {
  const open = useOpenThread()
  const lines = open?.lines
  const lineCount = lines?.length ?? 0
  const [read, setRead] = useState<{ looks: ThreadLook[]; files: ThreadLookFile[] }>({ looks: [], files: [] })
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)
  // The card's clock: set at each read, so a link's last day is judged when the rows are fresh.
  const [nowIso, setNowIso] = useState(() => new Date().toISOString())
  const stamped = useRef(new Set<string>())
  const again = useCallback(() => setTick((t) => t + 1), [])

  // The looks on this thread: on open, when the thread gains a line, and on the card's own clock while a link is out.
  useEffect(() => {
    let live = true
    io.looks(contact.id).then(
      (got) => {
        if (!live) return
        setRead(got)
        setNowIso(new Date().toISOString())
      },
      // A read that fails leaves the card as it was; the next line or tick reads again.
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [io, contact.id, lineCount, tick])

  const cards = useMemo(() => lookCards(read.looks, read.files, lines ?? [], contact.id, nowIso), [read, lines, contact.id, nowIso])
  const anyTaking = read.looks.some((l) => firstLookState(l, nowIso) === 'open')
  useEffect(() => {
    if (!anyTaking) return
    const id = window.setInterval(again, LOOK_CARD_REREAD_MS)
    return () => window.clearInterval(id)
  }, [anyTaking, again])

  // Sign what the cards draw, once per set of files.
  const lookPaths = cards.flatMap((c) => c.files.map((f) => f.storage_path))
  const textedIds = cards.flatMap((c) => c.texted.map((t) => t.id))
  const wanted = [...lookPaths.map((p) => `look:${p}`), ...textedIds.map((id) => `text:${id}`)].join('|')
  useEffect(() => {
    if (!wanted) return
    let live = true
    Promise.all([io.signLookFiles(lookPaths).catch(() => ({})), io.signTexted(textedIds).catch(() => ({}))]).then(([looks, texted]) => {
      if (!live) return
      const next: Record<string, string> = {}
      for (const [path, url] of Object.entries(looks as Record<string, string>)) next[`look:${path}`] = url
      for (const [id, url] of Object.entries(texted as Record<string, string>)) next[`text:${id}`] = url
      setUrls(next)
    })
    return () => {
      live = false
    }
    // The paths and ids are in `wanted`; the arrays are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [io, wanted])

  // The first time the office sees files on a look, it is looked at.
  useEffect(() => {
    for (const c of cards) {
      if (c.look.looked_at || c.files.length + c.texted.length === 0 || stamped.current.has(c.look.id)) continue
      stamped.current.add(c.look.id)
      void io.stamp(c.look.id, 'looked').catch(() => undefined)
    }
  }, [cards, io])

  if (!cards.length) return null
  return (
    <div data-first-looks style={wrap}>
      {cards.map((c) => (
        <OneLook key={c.look.id} contact={contact} cardOf={c} urls={urls} nowIso={nowIso} io={io} doorsIo={doorsIo} onChanged={again} />
      ))}
    </div>
  )
}
