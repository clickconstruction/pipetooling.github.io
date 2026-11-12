/**
 * Show us the problem (punch list #319, the spike, v2.6981): what a First look's link opens, with no sign-in. A caller
 * adds a few photos or a short video of the problem, and the office prices it before a truck rolls. The link's
 * ten-letter code is the key, as an estimate's link is; the page says who asked and how many files the link holds, and
 * never a name, an address, a price or a picture sent before.
 *
 * Every file is kept on the phone the moment it is picked (`lib/firstLook/kept.ts`), then sent straight to storage
 * through a one-file address the `first-look` function hands out: a photo shrunk first and sent in one request, a
 * video in pieces that pick up after a lost signal (`sendFile.ts`, `pieces.ts`). With no signal the page says so and
 * tries again by itself; opened again later it offers what is still kept. Light, on the portal's paper, as `/e`,
 * `/pay` and `/b` are.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import {
  FIRST_LOOK_COMPANY,
  FIRST_LOOK_WORDS as W,
  firstLookAskedWords,
  firstLookBytesWords,
  firstLookCode,
  firstLookCountWords,
  firstLookKindOfMime,
  firstLookMimeOf,
  firstLookSendLabel,
  firstLookSignRefusal,
  type FirstLookKind,
  type FirstLookPagePayload,
  type FirstLookPageView,
  type FirstLookThanks,
} from '../lib/firstLook/look'
import { KEPT_MAX_AGE_MS, openKeptStore, type KeptFile, type KeptStore } from '../lib/firstLook/kept'
import { sendKeptFile } from '../lib/firstLook/sendFile'
import { showUsIo, type ShowUsIo } from '../lib/firstLook/showUsIo'
import { shrinkReportPhoto } from '../lib/photos/shrink'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PAPER_RED, PORTAL_FONT, portalPressFill } from '../lib/portal/portalTheme'

type ItemState = 'kept' | 'sending' | 'sent' | 'refused'

type Item = {
  id: string
  kind: FirstLookKind
  name: string
  bytes: number
  seconds: number | null
  state: ItemState
  /** Bytes storage holds, while it sends. */
  sent: number
  /** Why it will not go, when refused. */
  words: string | null
  /** A picture to draw for a photo picked in this visit. */
  thumb: string | null
  /** Sent in an earlier press of Send, so it no longer counts toward the next one. */
  delivered: boolean
}

type View = FirstLookPageView | { kind: 'signal' }

const RETRY_MS = 15_000

const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** A video's length, as the phone reads it. Null when it cannot say within a few seconds. */
function videoSeconds(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const url = URL.createObjectURL(blob)
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => finish(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null)
    el.onerror = () => finish(null)
    window.setTimeout(() => finish(null), 4000)
    el.src = url
  })
}

const page: CSSProperties = { minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, fontSize: 16, lineHeight: 1.45 }
const column: CSSProperties = { maxWidth: 460, margin: '0 auto', padding: '16px 16px 40px' }
const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, padding: 14, marginTop: 12 }
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED }
const press: CSSProperties = { display: 'block', width: '100%', minHeight: 50, borderRadius: 10, border: `1px solid ${HAIR}`, font: 'inherit', fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }
const quiet: CSSProperties = { ...press, background: CARD, color: INK }
const small: CSSProperties = { minHeight: 40, borderRadius: 9, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '6px 12px' }

function Brand({ phone }: { phone: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <strong style={{ fontSize: 17 }}>{FIRST_LOOK_COMPANY}</strong>
      {phone ? (
        <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} style={{ marginLeft: 'auto', color: COPPER, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          {phone}
        </a>
      ) : null}
    </div>
  )
}

function Stop({ head, body, phone }: { head: string; body: string; phone?: string }) {
  return (
    <div data-theme="light" style={page}>
      <div style={column}>
        <Brand phone={phone ?? ''} />
        <div style={card} role="status">
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{head}</h1>
          <p style={{ margin: '8px 0 0', color: MUTED }}>{body}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * The page itself, given the link's code. It reads no router, so the same component is the app's route
 * (`ShowUsRoute.tsx`) and the whole of the page's own small entry (`src/showEntry.tsx`, punch list #319 PR 4).
 */
export default function ShowUs({ code: given, io = showUsIo }: { code: string | null | undefined; io?: ShowUsIo }) {
  const code = useMemo(() => firstLookCode(given), [given])
  const [view, setView] = useState<View>(code ? { kind: 'loading' } : { kind: 'not_found' })
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [counts, setCounts] = useState<{ photos: number; videos: number }>({ photos: 0, videos: 0 })
  const [waiting, setWaiting] = useState(false)
  const [lasting, setLasting] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [place, setPlace] = useState<string | null>(null)
  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)
  const [thanks, setThanks] = useState<FirstLookThanks | null>(null)

  const storeRef = useRef<KeptStore | null>(null)
  const keptRef = useRef<Map<string, KeptFile>>(new Map())
  const pumping = useRef(false)
  const pumpRef = useRef<() => void>(() => {})
  const alive = useRef(true)
  const thumbs = useRef<string[]>([])
  const takePhotoRef = useRef<HTMLInputElement>(null)
  const takeVideoRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLInputElement>(null)

  const patchItem = useCallback((id: string, change: Partial<Item>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...change } : it)))
  }, [])

  // The page opens: what the link holds, and what this phone still keeps for it.
  useEffect(() => {
    if (!code) return
    alive.current = true
    let live = true
    ;(async () => {
      const [answer, store] = await Promise.all([io.read(code), storeRef.current ? Promise.resolve(storeRef.current) : openKeptStore()])
      if (!live) return
      storeRef.current = store
      setLasting(store.lasting)
      setView(answer)
      if (answer.kind !== 'open') return
      setCounts({ photos: answer.payload.look.photos, videos: answer.payload.look.videos })
      await store.sweep(Date.now() - KEPT_MAX_AGE_MS)
      const kept = await store.list(code)
      if (!live) return
      for (const k of kept) if (!keptRef.current.has(k.id)) keptRef.current.set(k.id, k)
      setItems((list) => {
        const have = new Set(list.map((it) => it.id))
        const fresh = kept.filter((k) => !have.has(k.id)).map((k): Item => ({ id: k.id, kind: k.kind, name: k.name, bytes: k.blob.size, seconds: k.seconds, state: 'kept', sent: 0, words: null, thumb: null, delivered: false }))
        return [...list, ...fresh]
      })
      if (kept.length > 0) pumpRef.current()
    })()
    return () => {
      live = false
    }
  }, [code, io, reloadKey])

  useEffect(
    () => () => {
      alive.current = false
      for (const url of thumbs.current) URL.revokeObjectURL(url)
    },
    [],
  )

  useEffect(() => {
    document.title = `${W.heading} · ${FIRST_LOOK_COMPANY}`
  }, [])

  // One file at a time, oldest first. A lost signal stops the run; the page tries again by itself.
  const pump = useCallback(async () => {
    if (!code || pumping.current) return
    const store = storeRef.current
    if (!store) return
    pumping.current = true
    setWaiting(false)
    try {
      for (;;) {
        if (!alive.current) return
        const next = [...keptRef.current.values()].sort((a, b) => a.keptAt - b.keptAt)[0]
        if (!next) return
        patchItem(next.id, { state: 'sending' })
        const outcome = await sendKeptFile(next, {
          sign: (file) => io.sign(code, file),
          done: (input) => io.done(code, input),
          putWhole: io.putWhole,
          pieces: io.pieces,
          piecePlan: io.piecePlan,
          remember: async (change) => {
            Object.assign(next, change)
            await store.patch(next.id, change)
          },
          onProgress: (sent) => patchItem(next.id, { sent }),
          now: () => Date.now(),
        })
        if (!alive.current) return
        if (outcome.state === 'sent') {
          keptRef.current.delete(next.id)
          await store.remove(next.id)
          patchItem(next.id, { state: 'sent', sent: next.blob.size })
          setCounts({ photos: outcome.photos, videos: outcome.videos })
          continue
        }
        if (outcome.state === 'refused') {
          keptRef.current.delete(next.id)
          await store.remove(next.id)
          patchItem(next.id, { state: 'refused', words: outcome.words })
          if (outcome.gone) {
            setReloadKey((k) => k + 1)
            return
          }
          continue
        }
        patchItem(next.id, { state: 'kept' })
        setWaiting(true)
        return
      }
    } finally {
      pumping.current = false
    }
  }, [code, io, patchItem])

  useEffect(() => {
    pumpRef.current = () => void pump()
  }, [pump])

  // While a file waits on the signal: try again when it is back, when the page is looked at again, and on a timer.
  useEffect(() => {
    if (view.kind !== 'open' || !waiting) return
    const again = () => void pump()
    const seen = () => {
      if (document.visibilityState === 'visible') void pump()
    }
    window.addEventListener('online', again)
    document.addEventListener('visibilitychange', seen)
    const timer = window.setInterval(again, RETRY_MS)
    return () => {
      window.removeEventListener('online', again)
      document.removeEventListener('visibilitychange', seen)
      window.clearInterval(timer)
    }
  }, [view.kind, waiting, pump])

  const payload: FirstLookPagePayload | null = view.kind === 'open' ? view.payload : null

  const addFiles = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? [])
      e.target.value = ''
      const store = storeRef.current
      if (!code || !payload || !store || picked.length === 0) return
      setNote(null)
      setThanks(null)
      let photos = counts.photos + [...keptRef.current.values()].filter((k) => k.kind === 'photo').length
      let videos = counts.videos + [...keptRef.current.values()].filter((k) => k.kind === 'video').length
      for (const file of picked) {
        let mime = firstLookMimeOf(file)
        const kind = firstLookKindOfMime(mime)
        if (!kind) {
          setNote(`${file.name || 'That file'} is not a photo or a video, so it was left out.`)
          continue
        }
        let blob: Blob = file
        if (kind === 'photo') {
          try {
            const shrunk = await shrinkReportPhoto(file, 'large')
            blob = shrunk.blob
            if (shrunk.blob.type) mime = shrunk.blob.type
          } catch {
            /* it goes as it came */
          }
        }
        const refusal = firstLookSignRefusal({ mime, bytes: blob.size }, { photos, videos, photoSigns: 0, videoSigns: 0 })
        if (refusal) {
          setNote(refusal.words)
          continue
        }
        const seconds = kind === 'video' ? await videoSeconds(blob) : null
        const kept: KeptFile = { id: newId(), code, kind, name: file.name || (kind === 'photo' ? 'photo' : 'video'), mime, blob, keptAt: Date.now(), seconds, fileId: null, location: null, resumed: 0, pieceFails: 0, startedAt: null }
        await store.put(kept)
        keptRef.current.set(kept.id, kept)
        if (kind === 'photo') photos += 1
        else videos += 1
        let thumb: string | null = null
        if (kind === 'photo') {
          thumb = URL.createObjectURL(blob)
          thumbs.current.push(thumb)
        }
        setItems((list) => [...list, { id: kept.id, kind, name: kept.name, bytes: blob.size, seconds, state: 'kept', sent: 0, words: null, thumb, delivered: false }])
      }
      void pump()
    },
    [code, payload, counts, pump],
  )

  const sendAll = useCallback(async () => {
    if (!code || sending) return
    setSending(true)
    setNote(null)
    const answer = await io.send(code, { place, words: words.trim() || null })
    setSending(false)
    if (answer.ok) {
      setThanks(answer.thanks)
      setItems((list) => list.map((it) => (it.state === 'sent' ? { ...it, delivered: true } : it)))
      window.scrollTo(0, 0)
      return
    }
    setNote(answer.why === 'signal' ? `${W.noSignal} Press it again in a moment.` : answer.words)
  }, [code, io, place, words, sending])

  if (view.kind === 'loading') {
    return (
      <div data-theme="light" style={page}>
        <div style={column}>
          <Brand phone="" />
          <p style={{ color: MUTED }} role="status">
            Opening…
          </p>
        </div>
      </div>
    )
  }
  if (view.kind === 'not_found') return <Stop head={W.notFoundHead} body={W.notFoundBody} />
  if (view.kind === 'locked') return <Stop head={W.lockedHead} body={W.lockedBody} />
  if (view.kind === 'closed') return <Stop head={W.closedHead} body={W.closedBody} phone={view.phone} />
  if (view.kind === 'expired') return <Stop head={W.expiredHead} body={W.expiredBody} phone={view.phone} />
  if (view.kind === 'signal' || view.kind === 'error' || !payload) {
    return (
      <div data-theme="light" style={page}>
        <div style={column}>
          <Brand phone="" />
          <div style={card} role="alert">
            <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{view.kind === 'signal' ? 'This phone has no signal right now' : 'The page did not open'}</h1>
            <p style={{ margin: '8px 0 12px', color: MUTED }}>{view.kind === 'signal' ? 'The link needs a signal once, to open. Try again when you have one.' : 'Something went wrong on our side. Try again, or call the office.'}</p>
            <button type="button" style={{ ...press, ...portalPressFill(true) }} onClick={() => { setView({ kind: 'loading' }); setReloadKey((k) => k + 1) }}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const phone = payload.office.phone
  const active = items.filter((it) => !it.delivered)
  const sentNow = active.filter((it) => it.state === 'sent')
  const pending = active.filter((it) => it.state === 'kept' || it.state === 'sending')
  const current = active.find((it) => it.state === 'sending') ?? null
  const percent = current && current.bytes > 0 ? Math.min(99, Math.floor((current.sent / current.bytes) * 100)) : null
  const label = firstLookSendLabel({
    photos: sentNow.filter((it) => it.kind === 'photo').length,
    videos: sentNow.filter((it) => it.kind === 'video').length,
    sending: pending.length,
    percent,
    waitingForSignal: waiting && pending.length > 0,
  })
  const keptWords = firstLookCountWords(pending.filter((it) => it.kind === 'photo').length, pending.filter((it) => it.kind === 'video').length)
  const before = firstLookCountWords(payload.look.photos, payload.look.videos)
  /** Files that went up on an earlier visit whose Send was never pressed: the page offers the press again. */
  const unsentBefore = payload.look.sentCount === 0 && before !== '' && active.length === 0

  const foot = (
    <p style={{ margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${HAIR}`, fontSize: 13, color: FAINT }}>
      <strong style={{ color: INK }}>{W.only}</strong> {W.emergency}{' '}
      {phone ? (
        <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} style={{ color: COPPER, fontWeight: 700 }}>
          {phone}
        </a>
      ) : (
        'the office'
      )}
      .
    </p>
  )

  if (thanks) {
    return (
      <div data-theme="light" style={page}>
        <div style={column}>
          <Brand phone={phone} />
          <p role="status" style={{ ...card, borderColor: PAPER_GREEN, color: PAPER_GREEN, fontWeight: 700 }}>
            {thanks.got}
          </p>
          <div style={card}>
            <div style={eyebrow}>What happens next</div>
            <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              {thanks.steps.map((s) => (
                <li key={s} style={{ marginBottom: 4 }}>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" style={quiet} onClick={() => setThanks(null)}>
              {W.more}
            </button>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: FAINT }}>{W.closeTab}</p>
          {foot}
        </div>
      </div>
    )
  }

  return (
    <div data-theme="light" style={page}>
      <div style={column}>
        <Brand phone={phone} />
        <h1 style={{ margin: '14px 0 4px', fontSize: 26, lineHeight: 1.15 }}>{W.heading}</h1>
        <p style={{ margin: 0, color: MUTED }}>{firstLookAskedWords(payload.look.askedBy)}</p>
        {before && active.length === 0 && !unsentBefore ? <p style={{ margin: '8px 0 0', fontSize: 14, color: FAINT }}>This link already has {before} from you. Add more below.</p> : null}
        {unsentBefore ? (
          <div style={card}>
            <p style={{ margin: 0 }}>
              Your {before} {payload.look.photos + payload.look.videos === 1 ? 'is' : 'are'} in, and not sent to us yet.
            </p>
            <button type="button" disabled={sending} onClick={() => void sendAll()} style={{ ...press, ...portalPressFill(!sending), marginTop: 10 }}>
              {sending ? 'Sending…' : `Send ${before}`}
            </button>
          </div>
        ) : null}

        <input ref={takePhotoRef} type="file" accept="image/*" capture="environment" onChange={addFiles} style={{ display: 'none' }} data-testid="show-us-take-photo" />
        <input ref={takeVideoRef} type="file" accept="video/*" capture="environment" onChange={addFiles} style={{ display: 'none' }} data-testid="show-us-take-video" />
        <input ref={chooseRef} type="file" accept="image/*,video/*" multiple onChange={addFiles} style={{ display: 'none' }} data-testid="show-us-choose" />

        {active.length === 0 ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" style={{ ...press, ...portalPressFill(true) }} onClick={() => takePhotoRef.current?.click()}>
                {W.takePhoto}
              </button>
              <button type="button" style={{ ...press, ...portalPressFill(true) }} onClick={() => takeVideoRef.current?.click()}>
                {W.takeVideo}
              </button>
            </div>
            <button type="button" style={quiet} onClick={() => chooseRef.current?.click()}>
              {W.choose}
            </button>
          </div>
        ) : null}

        {note ? (
          <p role="alert" style={{ ...card, background: NOTE_BAND, color: PAPER_RED, fontSize: 14 }}>
            {note}
          </p>
        ) : null}

        {waiting && pending.length > 0 ? (
          <p role="status" style={{ ...card, background: NOTE_BAND, fontSize: 14 }}>
            <strong>{W.kept}</strong> {W.noSignal}
          </p>
        ) : null}

        {active.length > 0 ? (
          <div style={card}>
            <div style={eyebrow}>
              {[
                sentNow.length ? `${firstLookCountWords(sentNow.filter((i) => i.kind === 'photo').length, sentNow.filter((i) => i.kind === 'video').length)} in` : '',
                pending.length ? `${keptWords} ${waiting ? 'kept' : 'sending'}` : '',
              ]
                .filter(Boolean)
                .join(' · ') || 'Nothing in yet'}
            </div>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 8 }}>
              {active.map((it) => {
                const pct = it.bytes > 0 ? Math.min(100, Math.floor((it.sent / it.bytes) * 100)) : 0
                const line =
                  it.state === 'sent'
                    ? 'In'
                    : it.state === 'refused'
                      ? it.words ?? 'Left out'
                      : it.state === 'sending'
                        ? `Sending · ${firstLookBytesWords(it.sent) || '0 KB'} of ${firstLookBytesWords(it.bytes)}`
                        : waiting
                          ? 'Kept on this phone'
                          : 'Next to go'
                return (
                  <li key={it.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 8, border: `1px solid ${HAIR}`, background: NOTE_BAND, overflow: 'hidden', display: 'grid', placeItems: 'center', fontSize: 12, color: MUTED, fontWeight: 700 }}>
                      {it.thumb ? <img src={it.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : it.kind === 'video' ? '▶' : 'Photo'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {it.kind === 'video' ? `Video${it.seconds ? ` · ${Math.round(it.seconds)} s` : ''}` : 'Photo'} <span style={{ fontWeight: 400, color: FAINT }}>· {firstLookBytesWords(it.bytes)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: it.state === 'sent' ? PAPER_GREEN : it.state === 'refused' ? PAPER_RED : MUTED }}>{line}</div>
                      {it.state === 'sending' ? (
                        <div aria-hidden style={{ height: 6, borderRadius: 3, background: HAIR, overflow: 'hidden', marginTop: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: COPPER }} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: FAINT }}>{waiting && pending.length > 0 ? (lasting ? W.keptLater : 'Keep this page open. This browser holds them only while the page is open.') : pending.length > 0 ? W.keepOpen : ''}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <button type="button" style={small} onClick={() => takePhotoRef.current?.click()}>
                + {W.takePhoto}
              </button>
              <button type="button" style={small} onClick={() => takeVideoRef.current?.click()}>
                + {W.takeVideo}
              </button>
              <button type="button" style={small} onClick={() => chooseRef.current?.click()}>
                {W.choose}
              </button>
              {waiting && pending.length > 0 ? (
                <button type="button" style={small} onClick={() => void pump()}>
                  {W.tryNow}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {active.length > 0 ? (
          <div style={card}>
            <div style={eyebrow} id="show-us-place">
              {W.placeHead}
            </div>
            <div role="group" aria-labelledby="show-us-place" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {W.places.map((p) => {
                const on = place === p
                return (
                  <button key={p} type="button" aria-pressed={on} onClick={() => setPlace(on ? null : p)} style={{ ...small, borderRadius: 999, minHeight: 36, borderColor: on ? COPPER : HAIR, color: on ? COPPER : INK }}>
                    {p}
                  </button>
                )
              })}
            </div>
            <label htmlFor="show-us-words" style={{ ...eyebrow, display: 'block', marginTop: 12 }}>
              {W.wordsHead} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>({W.wordsHint})</span>
            </label>
            <textarea id="show-us-words" value={words} maxLength={1000} onChange={(e) => setWords(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 9, border: `1px solid ${HAIR}`, padding: '8px 10px', font: 'inherit', background: CARD, color: INK }} />
          </div>
        ) : null}

        {active.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <button type="button" disabled={!label.ready || sending} onClick={() => void sendAll()} style={{ ...press, ...portalPressFill(label.ready && !sending), cursor: label.ready && !sending ? 'pointer' : 'default' }}>
              {sending ? 'Sending…' : label.label}
            </button>
          </div>
        ) : null}

        <div style={card}>
          <div style={eyebrow}>{W.tipsHead}</div>
          <ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 15 }}>
            {W.tips.map((t) => (
              <li key={t} style={{ marginBottom: 3 }}>
                {t}
              </li>
            ))}
          </ol>
          <p style={{ margin: '10px 0 0', paddingTop: 10, borderTop: `1px solid ${HAIR}`, fontSize: 14, color: MUTED }}>{W.why}</p>
        </div>

        <p style={{ margin: '14px 0 0', fontSize: 13, color: FAINT }}>
          <strong style={{ color: INK }}>{W.wayRound}</strong> {W.wayRoundRest}
        </p>
        {foot}
      </div>
    </div>
  )
}
