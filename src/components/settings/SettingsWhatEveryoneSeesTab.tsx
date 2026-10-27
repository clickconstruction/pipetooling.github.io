import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'
import type { LensAsk } from '../../lib/lens/answer/lensEngine'
import { auditBadges, auditFrame, type LensAudit } from '../../lib/lens/lensAudit'
import { applyDraftStyle, draftCss, type ThemeDraft } from '../../lib/lens/lensTokens'
import type { LensDraftMode } from './LensThemeDraft'
import { formatLensName, LENS_MOODS, type LensMood, type LensTheme } from '../../lib/lens/lensName'
import { LENS_PEOPLE, LENS_ROLES, type LensRole } from '../../lib/lens/lensPeople'
import { DEFAULT_KNOBS, LENS_AUDIENCES, LENS_MOOD_LABELS, LENS_WIDTH_ORDER, LENS_WIDTHS, askSummary, audienceScreens, lensFrames, lensScreens, sweepWindow, type LensAcross, type LensAudience, type LensFrameSpec, type LensKnobs, type LensWidth } from '../../lib/lens/lensTab'

/**
 * Settings → What everyone sees (punch list #194, dev only): every screen, as every role, in every
 * state, drawn live by the real app in sealed frames on an invented company. A frame is an iframe
 * of the app named `pipetooling-lens:{...}`, so `src/lib/lens/seal.ts` swaps its storage, network
 * and sensors before the app starts, and nothing in it reads or writes a real row. Pick who, where
 * and the state, then what varies; the other knobs hold. At most six frames are live at once (one on
 * a phone), so the tab never boots more apps than the browser can hold.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.75rem 1rem', marginBottom: '0.75rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const LABEL: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const PILL_ON: CSSProperties = { ...PILL, background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }
const BADGE: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, borderRadius: 6, padding: '0 0.4rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' }
const BADGE_BAD: CSSProperties = { ...BADGE, color: 'var(--text-red-700)', borderColor: 'var(--border-red)', background: 'var(--bg-red-tint)' }
const BADGE_OK: CSSProperties = { ...BADGE, color: 'var(--text-green-700)', borderColor: 'var(--text-green-700)', background: 'var(--bg-green-tint)' }
const LINK_BTN: CSSProperties = { font: 'inherit', fontSize: '0.72rem', color: 'var(--text-link)', background: 'none', border: 0, padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }

const MAX_LIVE = 6

/** The theme draft panel loads only when opened: it carries every token of index.css. */
const LensThemeDraft = lazy(() => import('./LensThemeDraft'))

/** The draft a dev was working on, kept on this device only (a convenience, never shared). */
const DRAFT_KEY = 'lens.themeDraft.v1'
function readDraft(): ThemeDraft {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as ThemeDraft | null
    if (raw && typeof raw === 'object' && raw.light && raw.dark) return { light: { ...raw.light }, dark: { ...raw.dark } }
  } catch {
    /* private mode or a bad value: start empty */
  }
  return { light: {}, dark: {} }
}

/** A frame's element id, so the sheet's flagged list can scroll to it. */
function frameDomId(key: string): string {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return `lens-frame-${(h >>> 0).toString(36)}`
}
/** A frame waiting its turn is a short card, so a phone does not scroll past empty boxes. */
const WAITING_HEIGHT = 120

function Pills<T extends string>({ items, value, onPick, label, disabled }: { items: readonly { key: T; label: string }[]; value: T; onPick: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, opacity: disabled ? 0.5 : 1 }}>
      {items.map((i) => (
        <button key={i.key} type="button" disabled={disabled} aria-pressed={i.key === value} style={i.key === value ? PILL_ON : PILL} onClick={() => onPick(i.key)}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(5.5rem, max-content) minmax(0, 1fr)', gap: '0.5rem 0.75rem', alignItems: 'center' }}>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  )
}

/** One sealed frame of the app, drawn at its real width and scaled into the space it is given. */
/** A frame has settled when its app has booted and its asks stop growing: two quiet polls, three seconds in, or eight at the most. */
const SETTLE_QUIET_POLLS = 2
const SETTLE_MIN_MS = 3000
const SETTLE_MAX_MS = 8000
/** A frame with nothing drawn by now is reported as such, so a sweep never waits on it. */
const SETTLE_GIVE_UP_MS = 16000
/** A customer's page, which answers from its sample token, is checked once it has had this long. */
const SETTLE_UNSEALED_MS = 6000

function LensFrame({ spec, displayWidth, maxHeight, live, onDraw, audit, onAudit, draftCss: draftText }: { spec: LensFrameSpec; displayWidth: number; maxHeight: number; live: boolean; onDraw: () => void; audit: LensAudit | null; onAudit: (key: string, audit: LensAudit) => void; draftCss: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [asks, setAsks] = useState<readonly LensAsk[]>([])
  const [nonce, setNonce] = useState(0)
  // The theme draft rides in the frame as one style sheet, over the shipped tokens.
  const applyDraft = useCallback(() => applyDraftStyle(ref.current?.contentDocument, draftText), [draftText])
  useEffect(() => applyDraft(), [applyDraft])
  useEffect(() => {
    setAsks([])
    if (!live) return
    const started = Date.now()
    let last = -1
    let quiet = 0
    let audited = false
    const read = () => {
      const win = ref.current?.contentWindow
      const got = win?.__lens?.asks
      if (got) setAsks((cur) => (cur.length === got.length ? cur : [...got]))
      const n = got?.length ?? 0
      quiet = n === last ? quiet + 1 : 0
      last = n
      const age = Date.now() - started
      // Settled once the app has booted (its first asks are in) and its asks stop growing.
      // A customer's page has no seal to count its asks, so it settles by time.
      const settled = spec.config ? n > 0 && ((quiet >= SETTLE_QUIET_POLLS && age >= SETTLE_MIN_MS) || age >= SETTLE_MAX_MS) : age >= SETTLE_UNSEALED_MS
      if (!audited && win?.document?.body && (settled || (n > 0 && age >= SETTLE_GIVE_UP_MS))) {
        audited = true
        let result: LensAudit
        try {
          result = auditFrame(win)
        } catch (e) {
          // A check that cannot read the screen says so, so a sweep never waits on it.
          result = { sideways: null, lowContrast: [], brokenImages: [], errors: [`The check could not read this screen: ${e instanceof Error ? e.message : String(e)}`] }
        }
        onAudit(spec.key, result)
      } else if (!audited && age >= SETTLE_GIVE_UP_MS) {
        audited = true
        onAudit(spec.key, { sideways: null, lowContrast: [], brokenImages: [], errors: [`The screen drew nothing in ${SETTLE_GIVE_UP_MS / 1000} seconds.`] })
      }
    }
    const t = setInterval(read, 1000)
    return () => clearInterval(t)
  }, [live, spec.key, nonce, onAudit])
  const dev = LENS_WIDTHS[spec.width]
  const scale = displayWidth / dev.w
  const height = Math.min(Math.round(dev.h * scale), maxHeight)
  const sum = askSummary(asks)
  const openAlone = () => (spec.config ? window.open(spec.to, formatLensName({ ...spec.config, n: Math.random().toString(36).slice(2) })) : window.open(spec.to, '_blank'))
  return (
    <figure id={frameDomId(spec.key)} style={{ margin: 0, width: displayWidth, maxWidth: '100%', display: 'grid', gap: 4, minWidth: 0 }}>
      <figcaption style={{ display: 'grid', gap: 3, fontSize: '0.75rem', color: 'var(--text-700)' }}>
        <b style={{ color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={spec.lead}>
          {spec.lead}
        </b>
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {live && !spec.config && <span style={BADGE}>Sample page</span>}
          {live && spec.config && (
            <>
              <span style={BADGE}>{sum.total} asks</span>
              <span style={sum.gaps.length > 0 ? BADGE_BAD : BADGE}>{sum.gaps.length === 1 ? '1 gap' : `${sum.gaps.length} gaps`}</span>
            </>
          )}
          {audit ? auditBadges(audit).map((b) => (
            <span key={b.text} style={b.tone === 'ok' ? BADGE_OK : BADGE_BAD}>
              {b.text}
            </span>
          )) : live ? <span style={BADGE}>Checking…</span> : <span style={BADGE}>Not drawn</span>}
        </span>
        {spec.fallback && <span style={MUTED}>{spec.fallback}</span>}
      </figcaption>
      <div style={{ position: 'relative', width: displayWidth, maxWidth: '100%', height: live ? height : Math.min(height, WAITING_HEIGHT), overflow: 'hidden', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--bg-page)' }}>
        {live ? (
          <iframe
            key={`${spec.key}|${nonce}`}
            ref={ref}
            name={spec.config ? formatLensName(spec.config) : undefined}
            src={spec.to}
            title={spec.title}
            onLoad={applyDraft}
            style={{ position: 'absolute', top: 0, left: 0, width: dev.w, height: dev.h, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          />
        ) : (
          <button type="button" onClick={onDraw} style={{ ...PILL, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            Draw it
          </button>
        )}
      </div>
      <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {live && (
          <button type="button" style={LINK_BTN} onClick={() => setNonce((n) => n + 1)} aria-label={`Reload ${spec.title}`}>
            Reload
          </button>
        )}
        <button type="button" style={LINK_BTN} onClick={openAlone} aria-label={`Open ${spec.title} alone`}>
          Open alone ↗
        </button>
      </span>
      {audit && (audit.lowContrast.length > 0 || audit.errors.length > 0 || audit.brokenImages.length > 0) && (
        <details style={MUTED}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-link)' }}>What the check found</summary>
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
            {audit.lowContrast.slice(0, 6).map((c) => (
              <li key={`${c.text}|${c.color}`}>
                {c.ratio}:1 · “{c.text}” in {c.color} on {c.bg}
              </li>
            ))}
            {audit.brokenImages.slice(0, 4).map((s) => (
              <li key={s}>Broken image · {s}</li>
            ))}
            {audit.errors.slice(0, 6).map((e, i) => (
              <li key={`${i}|${e}`}>{e}</li>
            ))}
          </ul>
        </details>
      )}
      {live && sum.total > 0 && (
        <details style={MUTED}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-link)' }}>What the world answered</summary>
          <p style={{ margin: '0.25rem 0 0' }}>
            {sum.world} from its rows, {sum.rule} by rule{sum.mood > 0 ? `, ${sum.mood} by the state` : ''}, {sum.missing + sum.unread} with no answer.
          </p>
          {sum.gaps.length > 0 && (
            <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
              {sum.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </details>
      )}
    </figure>
  )
}

const ACROSS: readonly { key: LensAcross; label: string }[] = [
  { key: 'widths', label: 'Widths and themes' },
  { key: 'roles', label: 'Roles' },
  { key: 'states', label: 'States' },
  { key: 'sheet', label: 'Every screen' },
]

export function SettingsWhatEveryoneSeesTab() {
  const [k, setK] = useState<LensKnobs>(DEFAULT_KNOBS)
  const narrow = useIsMobile()
  const [stageRef, stageWidth] = useMeasuredWidth<HTMLDivElement>()
  const [wrapRef, wrapWidth] = useMeasuredWidth<HTMLDivElement>()
  const screens = useMemo(() => (k.audience ? audienceScreens(k.audience) : lensScreens(k.as)), [k.as, k.audience])
  const frames = useMemo(() => lensFrames(k), [k])
  const maxLive = narrow ? 1 : MAX_LIVE
  const sheet = k.across === 'sheet'
  const [live, setLive] = useState<readonly string[]>([])
  const [audits, setAudits] = useState<Readonly<Record<string, LensAudit>>>({})
  const [sweeping, setSweeping] = useState(false)
  const [draft, setDraft] = useState<ThemeDraft>(readDraft)
  const [draftMode, setDraftMode] = useState<LensDraftMode>('draft')
  const [draftOpen, setDraftOpen] = useState(false)
  const draftText = draftMode === 'draft' ? draftCss(draft) : ''
  // Beside the frames, and sticky, only when both fit; stacked, a sticky panel would cover the frames.
  const draftBeside = draftOpen && (wrapWidth ?? 0) >= 360 + 16 + 560
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* private mode */
    }
  }, [draft])
  // A check read the frame as it looked, so a new draft means new checks.
  useEffect(() => setAudits({}), [draftText])
  const onAudit = useCallback((key: string, a: LensAudit) => setAudits((cur) => ({ ...cur, [key]: a })), [])
  // Every screen waits for Check every screen or a Draw it; the other views draw their first frames.
  useEffect(() => {
    setSweeping(false)
    setLive(sheet ? [] : frames.slice(0, maxLive).map((f) => f.key))
  }, [frames, maxLive, sheet])
  // The sweep: always the first frames not checked yet, so a checked frame makes room for the next.
  useEffect(() => {
    if (!sweeping) return
    const next = sweepWindow(frames.map((f) => f.key), new Set(Object.keys(audits)), maxLive)
    if (next.length === 0) setSweeping(false)
    setLive(next)
  }, [sweeping, audits, frames, maxLive])
  const draw = (key: string) => {
    setSweeping(false)
    setLive((cur) => [...cur.filter((x) => x !== key), key].slice(-maxLive))
  }
  const checked = frames.filter((f) => audits[f.key])
  const flagged = checked.filter((f) => auditBadges(audits[f.key]!).some((b) => b.tone === 'bad'))
  const count = (pick: (a: LensAudit) => boolean) => checked.filter((f) => pick(audits[f.key]!)).length
  const set = (patch: Partial<LensKnobs>) => setK((cur) => {
    const next = { ...cur, ...patch }
    if (patch.audience) {
      next.where = audienceScreens(patch.audience)[0]?.id ?? ''
      if (next.across !== 'sheet') next.across = 'widths'
      return next
    }
    if (patch.as && !lensScreens(patch.as).some((s) => s.id === next.where)) next.where = 'page:/dashboard'
    return next
  })
  const groups = useMemo(() => {
    const by = new Map<string, typeof screens>()
    for (const s of screens) {
      const g = s.kind === 'window' ? 'Windows' : s.kind === 'settings' ? 'Settings' : 'Pages'
      by.set(g, [...(by.get(g) ?? []), s])
    }
    return [...by.entries()]
  }, [screens])
  const cw = stageWidth ?? 900

  // Across widths and themes: a row per theme, the three widths scaled to fit side by side.
  const widthsLayout = (spec: LensFrameSpec): { w: number; max: number } => {
    if (cw < 760) return { w: Math.min(cw, spec.width === 'phone' ? 300 : cw), max: 460 }
    const total = LENS_WIDTH_ORDER.reduce((a, w) => a + LENS_WIDTHS[w].w, 0)
    const s = Math.min(0.42, (cw - 28) / total)
    return { w: Math.floor(LENS_WIDTHS[spec.width].w * s), max: 340 }
  }
  const tile = Math.min(cw, k.width === 'phone' ? 200 : k.width === 'tablet' ? 280 : 360)

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-700)', maxWidth: '72ch' }}>
        Nothing here reads or writes a real row. The customer's pages are under Who, outside. Their emails, texts and papers are on{' '}
        <Link to="/settings?tab=settings-what-customers-see">What customers see</Link>.
      </p>
      <div style={{ ...CARD, display: 'grid', gap: '0.6rem' }}>
        <Row label="Who">
          <span style={{ display: 'grid', gap: 6 }}>
            <Pills label="Who" items={LENS_ROLES.map((r) => ({ key: r, label: LENS_PEOPLE[r].label }))} value={k.audience ? ('' as LensRole) : k.as} onPick={(as: LensRole) => set({ as, audience: null })} disabled={k.across === 'roles'} />
            <Pills label="Who, outside" items={LENS_AUDIENCES.map((a) => ({ key: a.id, label: a.label }))} value={k.audience ?? ('' as LensAudience)} onPick={(audience: LensAudience) => set({ audience })} disabled={k.across === 'roles' || k.across === 'states'} />
          </span>
        </Row>
        <Row label="Where">
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            <select aria-label="Where" value={k.where} disabled={sheet} onChange={(e) => set({ where: e.target.value })} style={{ font: 'inherit', fontSize: '0.85rem', maxWidth: '100%', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}>
              {groups.map(([g, list]) => (
                <optgroup key={g} label={g}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} · {s.where}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span style={MUTED}>{k.audience ? `${screens.length} pages the ${LENS_AUDIENCES.find((a) => a.id === k.audience)?.label.toLowerCase()} sees, each on its sample. Their emails, texts and papers are on What customers see.` : `${screens.length} screens ${LENS_PEOPLE[k.as].label.toLowerCase()} can open`}</span>
          </span>
        </Row>
        <Row label="State">
          <Pills label="State" items={LENS_MOODS.map((m) => ({ key: m, label: LENS_MOOD_LABELS[m] }))} value={k.mood} onPick={(mood: LensMood) => set({ mood })} disabled={k.across === 'states' || k.audience !== null} />
        </Row>
        <Row label="Across">
          <Pills label="Across" items={k.audience ? ACROSS.filter((a) => a.key === 'widths' || a.key === 'sheet') : ACROSS} value={k.across} onPick={(across: LensAcross) => set({ across })} />
        </Row>
        <Row label="Width">
          <Pills label="Width" items={LENS_WIDTH_ORDER.map((w) => ({ key: w, label: LENS_WIDTHS[w].label }))} value={k.width} onPick={(width: LensWidth) => set({ width })} disabled={k.across === 'widths'} />
        </Row>
        <Row label="Theme">
          <Pills label="Theme" items={[{ key: 'light' as LensTheme, label: 'Light' }, { key: 'dark' as LensTheme, label: 'Dark' }]} value={k.theme} onPick={(theme: LensTheme) => set({ theme })} disabled={k.across === 'widths' || k.audience !== null} />
        </Row>
        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={MUTED}>
            {frames.length} frames · {Math.min(maxLive, frames.length)} drawn at once{narrow ? ' on a phone' : ''}. Tap Draw it on another to swap it in.
          </span>
          <button type="button" aria-expanded={draftOpen} style={draftOpen || draftText ? PILL_ON : PILL} onClick={() => setDraftOpen((o) => !o)}>
            {draftText ? 'Theme draft is on' : 'Theme draft'}
          </button>
        </span>
      </div>

      {sheet && (
        <div style={{ ...CARD, display: 'grid', gap: '0.5rem' }} aria-live="polite">
          <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={PILL_ON} onClick={() => setSweeping((s) => !s)}>
              {sweeping ? 'Stop checking' : checked.length > 0 && checked.length < frames.length ? 'Check the rest' : 'Check every screen'}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-700)' }}>
              <b style={{ color: 'var(--text-strong)' }}>{checked.length}</b> of {frames.length} screens checked, {Math.min(maxLive, frames.length)} at a time
            </span>
          </span>
          {checked.length > 0 && (
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                [count((a) => a.sideways !== null), 'scroll sideways'],
                [count((a) => a.lowContrast.length > 0), 'have text under 3:1'],
                [count((a) => a.brokenImages.length > 0), 'have a broken image'],
                [count((a) => a.errors.length > 0), 'caught an error'],
              ].map(([n, words]) => (
                <span key={String(words)} style={Number(n) > 0 ? BADGE_BAD : BADGE_OK}>
                  {n} {words}
                </span>
              ))}
            </span>
          )}
          {flagged.length > 0 && (
            <details style={MUTED}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-link)' }}>
                {flagged.length === 1 ? '1 screen to look at' : `${flagged.length} screens to look at`}
              </summary>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                {flagged.map((f) => (
                  <li key={f.key}>
                    <button type="button" style={LINK_BTN} onClick={() => document.getElementById(frameDomId(f.key))?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      {f.lead}
                    </button>{' '}
                    · {auditBadges(audits[f.key]!).filter((b) => b.tone === 'bad').map((b) => b.text).join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {/* The draft sits beside the frames when there is room, so a change and its effect are seen together. */}
      <div ref={wrapRef} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {draftOpen && (
        <div style={draftBeside ? { flex: '0 0 360px', position: 'sticky', top: 72, maxHeight: 'calc(100vh - 90px)', overflow: 'auto', minWidth: 0 } : { flex: '1 1 100%', minWidth: 0 }}>
          <Suspense fallback={<div style={{ ...CARD, ...MUTED }}>Loading the tokens…</div>}>
            <LensThemeDraft draft={draft} onDraft={setDraft} mode={draftMode} onMode={setDraftMode} />
          </Suspense>
        </div>
      )}
      <div ref={stageRef} style={{ display: 'grid', gap: '0.9rem', minWidth: 0, flex: '999 1 560px' }}>
        {k.across === 'widths' ? (
          (k.audience ? (['light'] as const) : (['light', 'dark'] as const)).map((theme) => (
            <div key={theme} style={{ display: 'grid', gap: '0.4rem' }}>
              <span style={LABEL}>{k.audience ? 'Light, as every customer page is' : theme === 'light' ? 'Light' : 'Dark'}</span>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {frames
                  .filter((f) => (f.config ? f.config.theme : 'light') === theme)
                  .map((f) => {
                    const { w, max } = widthsLayout(f)
                    return <LensFrame key={f.key} spec={f} displayWidth={w} maxHeight={max} live={live.includes(f.key)} onDraw={() => draw(f.key)} audit={audits[f.key] ?? null} onAudit={onAudit} draftCss={draftText} />
                  })}
              </div>
            </div>
          ))
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))` }}>
            {frames.map((f) => (
              <LensFrame key={f.key} spec={f} displayWidth={tile} maxHeight={420} live={live.includes(f.key)} onDraw={() => draw(f.key)} audit={audits[f.key] ?? null} onAudit={onAudit} draftCss={draftText} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
