/**
 * First looks, the desk (punch list #319, the spike, v2.6981): where the owner or a developer makes a look's link and
 * sees what came in on it. A look is one ask for photos or a video of a problem; its link opens the customer's page
 * with no sign-in (`ShowUs.tsx`). This page makes the link, hands it over as a link, a QR and the text to send, and
 * draws each look with its photos, its video in a player, and what the spike measures of each upload: its size,
 * whether it went in pieces, how often it picked up after a drop, how long it took and which phone sent it.
 *
 * While this is a spike nothing texts anyone from here: the office copies the ask and sends it from the thread.
 * The `first-look` function is the only thing that reads or writes a look, and it lets in the owner and the
 * developers alone.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import { EmptyState } from '../components/EmptyState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../lib/deadPress'
import { formatDenverDateTimeShort } from '../utils/dateUtils'
import {
  canOpenFirstLooks,
  firstLookAskLine,
  firstLookDeskName,
  firstLookDeskStanding,
  firstLookFileFacts,
  showUsPath,
  type FirstLookDeskFile,
  type FirstLookDeskRow,
} from '../lib/firstLook/look'
import { firstLookDeskIo, type FirstLookDeskIo } from '../lib/firstLook/deskIo'

const REFRESH_MS = 15_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 12 }
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const pressStyle: CSSProperties = { minHeight: 38, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: 13 }

const when = (iso: string | null): string => (iso ? formatDenverDateTimeShort(Date.parse(iso)) : '')

type Fresh = { code: string; lookId: string; label: string }

function FileTile({ file }: { file: FirstLookDeskFile }) {
  const facts = firstLookFileFacts(file)
  return (
    <li style={{ minWidth: 0 }}>
      {!file.finished_at || !file.url ? (
        <div style={{ aspectRatio: '4 / 3', borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'grid', placeItems: 'center', ...muted }}>{file.kind === 'video' ? 'A video' : 'A photo'} started, not in yet</div>
      ) : file.kind === 'video' ? (
        <video controls preload="metadata" playsInline src={file.url} style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 8, background: 'var(--bg-muted)' }} />
      ) : (
        <a href={file.url} target="_blank" rel="noreferrer" aria-label="Open the photo">
          <img src={file.url} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
        </a>
      )}
      <div style={{ ...muted, marginTop: 4, overflowWrap: 'anywhere' }}>{facts || (file.kind === 'video' ? 'Video' : 'Photo')}</div>
    </li>
  )
}

export default function FirstLooks({ io = firstLookDeskIo }: { io?: FirstLookDeskIo }) {
  const { user, role, profileName, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const contactParam = params.get('contact')
  const contactId = contactParam && UUID_RE.test(contactParam) ? contactParam : null

  const [looks, setLooks] = useState<FirstLookDeskRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Fresh | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const lookedRef = useRef<Set<string>>(new Set())

  const gate = pageGate({ loading: authLoading, user, role }, (r) => canOpenFirstLooks(r))
  const open = gate === 'open'

  const load = useCallback(async () => {
    const answer = await io.list()
    if (!answer.ok) {
      setError(answer.error.message)
      return
    }
    setError(null)
    setLooks(answer.value)
    // The first time this desk draws a look whose files were sent, someone is looking at it.
    if (document.visibilityState === 'visible') {
      for (const l of answer.value) {
        if (l.sentAt && !lookedRef.current.has(l.id)) {
          lookedRef.current.add(l.id)
          void io.looked(l.id)
        }
      }
    }
  }, [io])

  useEffect(() => {
    if (!open) return
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [open, load])

  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  const origin = window.location.origin
  const linkOf = (code: string): string => `${origin}${showUsPath(code)}`
  const me = profileName ?? ''

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000)
    } catch {
      setError('The browser did not let the page copy. Select the link and copy it by hand.')
    }
  }

  const mint = async () => {
    setBusy('mint')
    const answer = await io.mint({ contactId, label: label.trim() })
    setBusy(null)
    if (!answer.ok) {
      setError(answer.error.message)
      return
    }
    setError(null)
    setFresh({ code: answer.value.code, lookId: answer.value.lookId, label: label.trim() })
    setLabel('')
    void load()
  }

  const act = async (key: string, run: () => Promise<{ ok: true } | { ok: false; error: { message: string } }>) => {
    setBusy(key)
    const answer = await run()
    setBusy(null)
    if (!answer.ok) setError(answer.error.message)
    else setError(null)
    setRemoving(null)
    void load()
  }

  const makeDead = busy === 'mint'

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '16px 16px 60px' }}>
      <div style={eyebrow}>Punch list 319 · a spike · the owner and the developers</div>
      <h1 style={{ margin: '4px 0 6px', fontSize: 24 }}>First looks</h1>
      <p style={{ margin: 0, maxWidth: '70ch', color: 'var(--text-700)' }}>
        Make a link, open it on a phone, and add photos and a short video. What comes in shows here, with how each upload went. Nothing is texted from this page. Copy the ask and send it from the person's thread.
      </p>

      <div style={cardStyle}>
        <div style={eyebrow}>{contactId ? 'A link for this person' : 'A link to try'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <label htmlFor="first-look-label" style={{ position: 'absolute', left: -9999 }}>
            What to call this look
          </label>
          <input
            id="first-look-label"
            value={label}
            maxLength={120}
            placeholder="What to call it, such as My phone"
            onChange={(e) => setLabel(e.target.value)}
            style={{ flex: '1 1 220px', minWidth: 0, minHeight: 38, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }}
          />
          <button
            type="button"
            disabled={makeDead}
            onClick={() => void mint()}
            style={{ ...pressStyle, border: 'none', background: makeDead ? DEAD_PRESS_FILL : '#2563eb', color: makeDead ? DEAD_PRESS_TEXT : 'white', cursor: makeDead ? 'default' : 'pointer' }}
          >
            {makeDead ? 'Making the link…' : 'Make a link'}
          </button>
        </div>
        {contactId ? <p style={{ ...muted, margin: '8px 0 0' }}>Tied to the person whose thread you came from. When their files are sent, a line lands on that thread.</p> : <p style={{ ...muted, margin: '8px 0 0' }}>Tied to nobody. Good for trying it on your own phone.</p>}
      </div>

      {fresh ? (
        <div style={{ ...cardStyle, borderColor: 'var(--text-link)' }} data-testid="first-look-fresh">
          <div style={eyebrow}>The new link{fresh.label ? ` · ${fresh.label}` : ''}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8, alignItems: 'flex-start' }}>
            <div data-theme="light" style={{ background: 'var(--surface)', padding: 8, borderRadius: 8, lineHeight: 0 }}>
              <QRCodeSVG value={linkOf(fresh.code)} size={132} />
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, overflowWrap: 'anywhere', color: 'var(--text-strong)' }}>{linkOf(fresh.code)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <button type="button" style={pressStyle} onClick={() => void copy('link', linkOf(fresh.code))}>
                  {copied === 'link' ? 'Copied the link' : 'Copy the link'}
                </button>
                <button type="button" style={pressStyle} onClick={() => void copy('ask', firstLookAskLine({ customerFirst: null, me, url: linkOf(fresh.code) }))}>
                  {copied === 'ask' ? 'Copied the ask' : 'Copy the ask'}
                </button>
                <a href={showUsPath(fresh.code)} target="_blank" rel="noreferrer" style={{ ...pressStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  Open the page ↗
                </a>
              </div>
              <p style={{ ...muted, margin: '10px 0 0' }}>Point a phone's camera at the square, or send the link. The link is shown this once. It takes files for 7 days.</p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ ...cardStyle, borderColor: 'var(--border-red)', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>What came in</h2>
        <button type="button" style={{ ...pressStyle, minHeight: 32, fontSize: 13 }} onClick={() => void load()}>
          Read again
        </button>
        <span style={muted}>It reads again by itself every 15 seconds.</span>
      </div>

      {looks == null ? (
        error ? null : (
          <p style={muted} role="status">
            Reading…
          </p>
        )
      ) : looks.length === 0 ? (
        <div style={cardStyle}>
          <EmptyState main="A look shows here once it has a link." next={{ label: 'Make a link', onPress: () => void mint() }} tail="makes the first." />
        </div>
      ) : (
        looks.map((look) => {
          const closing = busy === `close:${look.id}`
          const dropping = busy === `remove:${look.id}`
          return (
            <section key={look.id} style={cardStyle} aria-label={firstLookDeskName(look)}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 16, color: 'var(--text-strong)' }}>{firstLookDeskName(look)}</strong>
                <span style={{ fontSize: 13, fontWeight: 700, color: look.sentAt ? 'var(--text-green-700)' : 'var(--text-700)' }}>{firstLookDeskStanding(look)}</span>
              </div>
              <div style={{ ...muted, marginTop: 2 }}>
                {[
                  `Asked ${when(look.madeAt)}${look.askedBy ? ` by ${look.askedBy}` : ''}`,
                  look.openedAt ? `opened ${when(look.openedAt)}` : '',
                  look.sentAt ? `sent ${when(look.sentAt)}` : '',
                  look.state === 'open' ? `takes files until ${when(look.expiresAt)}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {look.place || look.words ? (
                <p style={{ margin: '8px 0 0', padding: '6px 10px', borderLeft: '3px solid var(--border-strong)', background: 'var(--bg-subtle)', borderRadius: '0 6px 6px 0', fontSize: 14 }}>
                  {look.place ? <strong>{look.place}. </strong> : null}
                  {look.words}
                </p>
              ) : null}
              {look.files.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                  {look.files.map((f) => (
                    <FileTile key={f.id} file={f} />
                  ))}
                </ul>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {look.state === 'open' ? (
                  <button type="button" disabled={closing} style={pressStyle} onClick={() => void act(`close:${look.id}`, () => io.close(look.id))}>
                    {closing ? 'Closing…' : 'Close the link'}
                  </button>
                ) : null}
                {removing === look.id ? (
                  <>
                    <button type="button" disabled={dropping} style={{ ...pressStyle, borderColor: 'var(--border-red)', color: 'var(--text-red-700)' }} onClick={() => void act(`remove:${look.id}`, () => io.remove(look.id))}>
                      {dropping ? 'Removing…' : look.files.length === 0 ? 'Remove it' : `Remove it and its ${look.files.length} ${look.files.length === 1 ? 'file' : 'files'}`}
                    </button>
                    <button type="button" style={pressStyle} onClick={() => setRemoving(null)}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" style={pressStyle} onClick={() => setRemoving(look.id)}>
                    Remove this look…
                  </button>
                )}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
