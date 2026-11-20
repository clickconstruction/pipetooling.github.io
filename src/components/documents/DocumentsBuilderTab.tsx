/**
 * The Documents page's **Document builder** tab (punch list #404, the owner's ask of 2026-11-19), for a dev only. It
 * lists the builders, one row each, with chips that say where each stands and an Open press. A builder makes one kind
 * of paper. There is no New builder press: a new kind is added in `lib/documentBuilder/builders.ts`.
 *
 * Open, a builder takes the tab's whole body, and the address keeps which one (`?tab=builder&builder=sub-nda`), so a
 * reload and the browser's Back both land where the person was. Today the one builder is the Sub NDA: its
 * step-by-step flow (`DocumentBuilderFlow`) over a made-up job. Nothing here reads or writes the database yet, and
 * the review's press requires nothing of anyone.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { DocumentBuilderFlow } from '../documentBuilder/DocumentBuilderFlow'
import {
  BUILDER_PARAM,
  DOCUMENT_BUILDERS,
  DOCUMENT_BUILDER_WORDS as WORDS,
  builderChips,
  openBuilderFromSearch,
  type BuilderChip,
  type BuilderChipTone,
  type DocumentBuilderEntry,
} from '../../lib/documentBuilder/builders'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { FRAME_SCROLL_MARGIN_CSS, frameHeightCss, framePlace, frameScrollsIntoView, type FramePlace } from '../../lib/documentBuilder/frame'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.25 }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const CHIPS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 6px', alignItems: 'center' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }
const CHIP_TONES: Record<BuilderChipTone, CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  wait: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
const DEV_CHIP: CSSProperties = { ...CHIP, background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' }
const OPEN_PRESS: CSSProperties = { border: 0, background: '#2563eb', color: 'white', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: 40, cursor: 'pointer' }
const BACK_PRESS: CSSProperties = {
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  borderRadius: 8,
  padding: '3px 10px',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  minHeight: 32,
  cursor: 'pointer',
}

function Chips({ chips }: { chips: BuilderChip[] }) {
  if (chips.length === 0) return null
  return (
    <span style={CHIPS}>
      {chips.map((c) => (
        <span key={c.words} style={{ ...CHIP, ...CHIP_TONES[c.tone] }}>
          {c.words}
        </span>
      ))}
    </span>
  )
}

/**
 * The flow in a frame that fits on the screen whole, so the slider and the Next press stay in reach while the page
 * above them scrolls. Where the frame starts is measured, since the bars above it differ by screen and by role, and
 * `lib/documentBuilder/frame.ts` decides from that how the frame is sized: to the bottom of the screen on a computer,
 * and to the screen from the builder's own top on a phone, where the builder then scrolls itself to the top once.
 */
function FlowOnScreen({ def, anchor }: { def: PaperDef; anchor: RefObject<HTMLElement | null> }) {
  const holder = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<FramePlace | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      if (!holder.current || !anchor.current) return
      const frameTop = holder.current.getBoundingClientRect().top
      const next = framePlace({
        top: Math.round(frameTop + window.scrollY),
        inset: Math.round(frameTop - anchor.current.getBoundingClientRect().top),
        screen: window.innerHeight,
      })
      setPlace((was) => (was && was.from === next.from && was.offset === next.offset ? was : next))
    }
    measure()
    window.addEventListener('resize', measure)
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    watch?.observe(document.body)
    return () => {
      window.removeEventListener('resize', measure)
      watch?.disconnect()
    }
  }, [anchor])

  // Once, as the builder opens: on a screen with too little room under the tab row, bring the builder to the top.
  const scrolled = useRef(false)
  const scrolls = frameScrollsIntoView(place)
  useEffect(() => {
    if (!scrolls || scrolled.current) return
    scrolled.current = true
    if (typeof anchor.current?.scrollIntoView === 'function') anchor.current.scrollIntoView({ block: 'start' })
  }, [scrolls, anchor])

  return (
    <div ref={holder} style={{ minWidth: 0 }}>
      <DocumentBuilderFlow def={def} style={{ height: frameHeightCss(place) }} />
    </div>
  )
}

/** The Sub NDA, open: the bar with the way back, then what a GC would walk, on the made-up job. */
function WalkedBuilder({ entry, onBack }: { entry: DocumentBuilderEntry; onBack: () => void }) {
  const def = SECRECY_PAPER_FIXTURE
  const anchor = useRef<HTMLDivElement>(null)
  return (
    <div ref={anchor} style={{ display: 'grid', gap: 10, minWidth: 0, scrollMarginTop: FRAME_SCROLL_MARGIN_CSS }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
        <button type="button" style={BACK_PRESS} onClick={onBack}>
          {`‹ ${WORDS.back}`}
        </button>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>{entry.name}</span>
        <Chips chips={builderChips(entry)} />
      </div>
      <div style={{ maxWidth: 492, margin: '0 auto', width: '100%', minWidth: 0, display: 'grid', gap: 8 }}>
        <FlowOnScreen def={def} anchor={anchor} />
        <p style={FINE}>
          {`${def.title} on job ${def.job}, for ${def.protectedParty}. Every name is made up, and nobody is asked to sign. The disclaimer, the breach lines, the site lines and the meanings are placeholders. No clause wording is on this page.`}
        </p>
      </div>
    </div>
  )
}

export default function DocumentsBuilderTab() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const open = openBuilderFromSearch(location.search)

  /** Open a builder, or go back to the list with null. Each is its own step in the browser's history. */
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id == null) next.delete(BUILDER_PARAM)
    else next.set(BUILDER_PARAM, id)
    setSearchParams(next)
  }

  if (open) return <WalkedBuilder entry={open} onBack={() => setOpen(null)} />

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
        <h2 style={CARD_TITLE}>{WORDS.title}</h2>
        <span style={DEV_CHIP}>{WORDS.devOnly}</span>
      </div>
      <p style={MUTED}>{WORDS.lead}</p>
      <div>
        {DOCUMENT_BUILDERS.map((b, i) => (
          <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', alignItems: 'center', padding: i === 0 ? '0 0 10px' : '10px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-strong)' }}>{b.name}</div>
              <div style={MUTED}>{b.says}</div>
              <Chips chips={builderChips(b)} />
            </div>
            <button type="button" aria-label={`${WORDS.open} ${b.name}`} style={OPEN_PRESS} onClick={() => setOpen(b.id)}>
              {WORDS.open}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
