/**
 * Before we start, on the GC's page (punch list #382, PR 9): one card a stage, for a job whose two switches are on.
 * **Still needed from you** on top, each open bullet its own white box with a large tick box that turns green.
 * Nothing is ticked for them. One link ticks them all, and one press sends: *Yes, 3 are ready*. A photo goes with a
 * yes, and a bullet that needs one says so. *Not ready yet?* sends a day. **Already settled** sits below a rule,
 * small and grey, with how we know. After our Go with nothing open the card reads *Crew confirmed for (day)*.
 *
 * The page shows no bullet of ours, no name of ours, no trip, no cost, no day they gave before and no days moved:
 * `gcPage.ts` decides what is here, and the function holds every answer against it. Light always, as their page is.
 */
import { useRef, useState } from 'react'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../../lib/portal/portalFailure'
import { CARD, HAIR, INK, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { GC_PAGE_PHOTO_MAX_BYTES, GC_PAGE_WORDS as W, type GcPageStage } from '../../lib/startChecks/gcPage'
import { PortalFailureNote } from './PortalFailureNote'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/submit-portal-request`

type Photo = { path: string; fileName: string; bytes: number }
type Ui = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; words: string } | { kind: 'failed'; failure: PortalFailureCause }

async function post(body: Record<string, unknown>): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; failure: PortalFailureCause }> {
  try {
    const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || !json?.ok) return { ok: false, failure: portalFailureCause(res.status, json, 'send') }
    return { ok: true, json }
  } catch (e) {
    return { ok: false, failure: portalFailureKind(e) }
  }
}

export function PortalStartChecks({ jobId, jobLabel, jobAddress, stage, token, todayYmd, phone = null, onSent }: { jobId: string; jobLabel: string; jobAddress?: string | null; stage: GcPageStage; token: string; todayYmd: string; phone?: string | null; onSent?: () => void }) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [photos, setPhotos] = useState<Record<string, Photo>>({})
  const [adding, setAdding] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  // What this visit already sent: the page is not read again after a send, so the card moves those rows itself.
  const [sentNow, setSentNow] = useState<Record<string, 'word' | 'photo'>>({})
  const file = useRef<HTMLInputElement>(null)
  const photoFor = useRef<string | null>(null)
  const sample = !!sampleStateFromToken(token)
  const busy = ui.kind === 'sending' || adding != null

  // A bullet sent with a photo is settled. One that asks for a photo and got a word alone stays, waiting on its photo.
  const need = stage.need.filter((b) => sentNow[b.id] !== 'photo' && !(sentNow[b.id] === 'word' && !b.wantsPhoto)).map((b) => (sentNow[b.id] === 'word' ? { ...b, waitsOnPhoto: true } : b))
  const settled = [...stage.settled, ...stage.need.filter((b) => !need.some((n) => n.id === b.id)).map((b) => ({ id: b.id, words: b.words, how: sentNow[b.id] === 'photo' ? 'your photo, today' : 'you told us today' }))]
  // A photo is a yes: adding one ticks its bullet. A bullet whose word we already have is sent for its photo alone.
  const ready = need.filter((b) => ticked[b.id] || photos[b.id])
  const fresh = ready.filter((b) => !b.waitsOnPhoto || photos[b.id])
  const allTicked = need.length > 0 && need.every((b) => ticked[b.id] || photos[b.id] || b.waitsOnPhoto)

  async function addPhoto(bulletId: string, picked: File) {
    setAdding(bulletId)
    setUi({ kind: 'idle' })
    try {
      const shrunk = await shrinkPhoto(picked)
      if (shrunk.blob.size > GC_PAGE_PHOTO_MAX_BYTES) {
        setUi({ kind: 'failed', failure: 'refused' })
        return
      }
      if (sample) {
        setPhotos((p) => ({ ...p, [bulletId]: { path: 'sample', fileName: picked.name, bytes: shrunk.blob.size } }))
        return
      }
      const type = shrunk.shrunk ? 'image/jpeg' : picked.type || 'image/jpeg'
      const slot = await post({ token, kind: 'start_check_photo', jobId, fixtureId: stage.fixtureId, bulletId, bytes: shrunk.blob.size, type })
      if (!slot.ok) {
        setUi({ kind: 'failed', failure: slot.failure })
        return
      }
      const put = await fetch(String(slot.json.signedUrl), { method: 'PUT', headers: { apikey: anonKey, 'Content-Type': type, 'x-upsert': 'true' }, body: shrunk.blob })
      if (!put.ok) {
        setUi({ kind: 'failed', failure: portalFailureCause(put.status, null, 'send') })
        return
      }
      setPhotos((p) => ({ ...p, [bulletId]: { path: String(slot.json.path), fileName: picked.name.slice(0, 200) || 'photo.jpg', bytes: shrunk.blob.size } }))
    } catch (e) {
      setUi({ kind: 'failed', failure: portalFailureKind(e) })
    } finally {
      setAdding(null)
    }
  }

  async function send(body: { ready: string[]; photos: Array<Photo & { bulletId: string }>; readyDay: string | null }, words: string) {
    setUi({ kind: 'sending' })
    if (!sample) {
      const res = await post({ token, kind: 'start_check_answer', jobId, fixtureId: stage.fixtureId, ...body })
      if (!res.ok) {
        setUi({ kind: 'failed', failure: res.failure })
        return
      }
    }
    setUi({ kind: 'sent', words })
    setSentNow((d) => ({ ...d, ...Object.fromEntries(body.ready.map((id) => [id, 'word' as const])), ...Object.fromEntries(body.photos.map((p) => [p.bulletId, 'photo' as const])) }))
    setTicked({})
    setPhotos({})
    setDay('')
    onSent?.()
  }

  const box = (on: boolean) => ({ width: 30, height: 30, flex: 'none', borderRadius: 7, border: `2px solid ${on ? PAPER_GREEN : MUTED}`, background: on ? PAPER_GREEN : 'var(--surface)', color: '#fff', fontSize: 20, fontWeight: 800, lineHeight: 1, cursor: busy ? 'wait' : 'pointer', padding: 0 }) as const
  const linkPress = { background: 'none', border: 'none', color: '#1d4e89', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit' } as const

  return (
    <section data-testid="portal-start-checks" data-start-stage={stage.fixtureId} style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 10, padding: '0.9rem 1rem', color: INK }}>
      <div style={{ display: 'flex', gap: '0.4rem 0.8rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{W.heading(stage.name)}</h3>
        <span style={{ fontSize: 12.5, color: MUTED }}>{[jobLabel, jobAddress].filter(Boolean).join(' · ')}</span>
      </div>
      {/* The same bar the office reads, for what we need from them only. */}
      <div role="img" aria-label={`${stage.pct}% ready`} style={{ display: 'flex', gap: 4, alignItems: 'center', margin: '8px 0 0', flexWrap: 'wrap' }}>
        {stage.marks.map((yes, i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${yes ? PAPER_GREEN : MUTED}`, background: yes ? PAPER_GREEN : 'var(--surface)' }} />
        ))}
        <span style={{ fontSize: 12.5, fontWeight: 700, marginLeft: 4 }}>{stage.pct}%</span>
      </div>

      {stage.crewConfirmedFor ? (
        <p data-start-confirmed style={{ margin: '10px 0 0', padding: '0.5rem 0.7rem', borderRadius: 8, background: '#e7f4ea', color: PAPER_GREEN, fontWeight: 800, fontSize: 15 }}>{W.confirmed(stage.crewConfirmedFor)}</p>
      ) : null}

      {need.length > 0 ? (
        <>
          <div style={{ display: 'flex', gap: '0.3rem 0.8rem', alignItems: 'baseline', flexWrap: 'wrap', margin: '12px 0 6px' }}>
            <strong style={{ fontSize: 13.5 }}>{W.need(need.length)}</strong>
            {!allTicked ? (
              <button type="button" style={linkPress} disabled={busy} onClick={() => setTicked(Object.fromEntries(need.filter((b) => !b.waitsOnPhoto).map((b) => [b.id, true])))}>
                {W.all}
              </button>
            ) : null}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {need.map((b) => {
              const on = !!ticked[b.id] || !!photos[b.id]
              const photo = photos[b.id]
              return (
                <div key={b.id} data-start-need={b.id} data-ticked={on ? 'yes' : 'no'} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: on ? '#e7f4ea' : 'var(--surface)', border: `1px solid ${on ? PAPER_GREEN : HAIR}`, borderRadius: 9, padding: '0.6rem 0.7rem' }}>
                  {/* Their word is already in for a bullet that waits on its photo: the box is theirs to leave. */}
                  {b.waitsOnPhoto ? (
                    <span aria-hidden style={{ ...box(!!photo), cursor: 'default', display: 'grid', placeItems: 'center' }}>{photo ? '✓' : ''}</span>
                  ) : (
                    <button type="button" role="checkbox" aria-checked={on} aria-label={b.words} disabled={busy} style={box(on)} onClick={() => setTicked((t) => ({ ...t, [b.id]: !on }))}>
                      {on ? '✓' : ''}
                    </button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{b.words}</div>
                    {b.waitsOnPhoto || b.wantsPhoto ? <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{b.waitsOnPhoto ? W.photoOwed : W.photoWanted}</div> : null}
                    <div style={{ marginTop: 4, fontSize: 12.5 }} data-screen-only>
                      {photo ? (
                        <span style={{ color: PAPER_GREEN, fontWeight: 700 }}>{W.photoAdded(photo.fileName)}</span>
                      ) : (
                        <button
                          type="button"
                          style={linkPress}
                          disabled={busy}
                          onClick={() => {
                            photoFor.current = b.id
                            file.current?.click()
                          }}
                        >
                          {adding === b.id ? 'Adding the photo…' : W.addPhoto}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            aria-label="A photo for this item"
            style={{ display: 'none' }}
            onChange={(e) => {
              const picked = e.target.files?.[0]
              const id = photoFor.current
              e.target.value = ''
              if (picked && id) void addPhoto(id, picked)
            }}
          />
          <div data-screen-only style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <button
              type="button"
              disabled={busy || fresh.length === 0}
              onClick={() => void send({ ready: fresh.filter((b) => !b.waitsOnPhoto).map((b) => b.id), photos: fresh.filter((b) => photos[b.id]).map((b) => ({ bulletId: b.id, ...(photos[b.id] as Photo) })), readyDay: null }, W.sent)}
              style={{ minHeight: 44, padding: '0 1.1rem', borderRadius: 8, border: 'none', background: fresh.length === 0 ? DEAD_PRESS_FILL : PAPER_GREEN, color: fresh.length === 0 ? DEAD_PRESS_TEXT : '#fff', fontWeight: 800, fontSize: 15, cursor: busy || fresh.length === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              {ui.kind === 'sending' ? 'Sending…' : fresh.length === 0 ? W.sendNone : W.send(fresh.length)}
            </button>
          </div>
          <div data-screen-only style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: 13.5 }}>
            <label htmlFor={`start-day-${stage.fixtureId}`} style={{ fontWeight: 600 }}>
              {W.notReady}
            </label>
            <input id={`start-day-${stage.fixtureId}`} type="date" min={todayYmd} value={day} disabled={busy} onChange={(e) => setDay(e.target.value)} style={{ minHeight: 40, padding: '0 0.5rem', borderRadius: 7, border: `1px solid ${HAIR}`, fontFamily: 'inherit', fontSize: 14, color: INK, background: 'var(--surface)' }} />
            <button type="button" disabled={busy || !day || day < todayYmd} onClick={() => void send({ ready: [], photos: [], readyDay: day }, W.daySent(day))} style={{ minHeight: 40, padding: '0 0.9rem', borderRadius: 7, border: `1px solid ${INK}`, background: 'var(--surface)', color: INK, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', opacity: !day || day < todayYmd ? 0.5 : 1 }}>
              {W.sendDay}
            </button>
          </div>
        </>
      ) : !stage.crewConfirmedFor ? (
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED }}>{W.nothingNeeded}</p>
      ) : null}

      {ui.kind === 'sent' ? (
        <p role="status" style={{ margin: '10px 0 0', fontSize: 13.5, fontWeight: 700, color: PAPER_GREEN }}>
          {ui.words}
        </p>
      ) : null}
      <PortalFailureNote failure={ui.kind === 'failed' ? portalFailure(ui.failure, 'send', 'en', { phone }) : null} />

      {settled.length > 0 ? (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${HAIR}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED }}>{W.settled(settled.length)}</div>
          <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 2 }}>
            {settled.map((b) => (
              <li key={b.id} data-start-settled={b.id} style={{ fontSize: 12.5, color: MUTED }}>
                ✓ {b.words}
                {b.how ? <span> ({b.how})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export default PortalStartChecks
