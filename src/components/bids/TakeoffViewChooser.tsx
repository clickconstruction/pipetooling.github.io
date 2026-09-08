import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { TAKEOFF_VIEWS, viewForChooserKey, type TakeoffView } from '../../lib/bids/takeoffView'
import { isTypingTarget } from '../../lib/bids/takeoffFocus'

/**
 * The view chooser (v2.3082): every time a Combined bid is opened on Takeoffs,
 * a centered box asks which way to work — Old, One at a time, Sheet — with a
 * drawn preview of each. A pick opens that view straight away through the
 * tab's normal view switch (so the pills and the seamless hop keep working);
 * there is no way past the box without choosing. Keys 1 · 2 · 3 pick a card.
 * By Stage bids never see it (the tab skips it — those views are Combined-only).
 */

const ACCENT = '#3b82f6'

const wire: CSSProperties = { background: 'var(--border)', borderRadius: 2, height: 5 }
const wireStrong: CSSProperties = { ...wire, background: 'var(--border-strong)' }
const wireBlue: CSSProperties = { ...wire, background: ACCENT }
const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 4, padding: 5, display: 'grid', gap: 4, alignContent: 'start' }

function Thumb({ children, hotkey }: { children: ReactNode; hotkey: string }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 10', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', overflow: 'hidden', padding: 8, display: 'grid', gap: 5 }} aria-hidden="true">
      <span style={{ position: 'absolute', top: 6, right: 6, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontVariantNumeric: 'tabular-nums' }}>
        {hotkey}
      </span>
      {children}
    </div>
  )
}

const row: CSSProperties = { display: 'grid', gridTemplateColumns: '34px 1fr 26px 18px 24px', gap: 4, alignItems: 'center' }

function OldThumb() {
  const line = (strong: boolean) => (
    <div style={row}>
      <span style={strong ? wireStrong : undefined} />
      <span style={wire} /><span style={wire} /><span style={wire} /><span style={wire} />
    </div>
  )
  return (
    <Thumb hotkey="1">
      <div style={row}><span style={wireStrong} /><span style={wire} /><span style={wireBlue} /><span /><span /></div>
      <div style={{ ...box, alignContent: 'stretch' }}>{line(true)}{line(false)}{line(true)}{line(true)}{line(false)}</div>
    </Thumb>
  )
}

function OneThumb() {
  return (
    <Thumb hotkey="2">
      <div style={{ display: 'grid', gridTemplateColumns: '34% 1fr', gap: 5, height: '100%' }}>
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 4 }}>
          <span style={wireStrong} /><span style={wireStrong} /><span style={wireStrong} /><span /><span style={wireBlue} />
        </div>
        <div style={box}>
          <span style={wire} />
          <span style={{ ...wire, height: 8, background: 'var(--bg-blue-tint)', border: `1px solid ${ACCENT}` }} />
          <span style={wire} /><span style={wire} /><span style={wire} />
        </div>
        <div style={box}>
          <span style={{ ...wireStrong, width: '45%' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <span style={{ ...wire, height: 14, background: 'var(--bg-blue-tint)', border: `1px solid ${ACCENT}` }} />
            <span style={{ ...wire, height: 14 }} />
          </div>
          <span style={wire} /><span style={wire} />
          <span style={{ ...wireBlue, width: '35%', justifySelf: 'end' }} />
        </div>
      </div>
    </Thumb>
  )
}

function SheetThumb() {
  const panel = (children: ReactNode) => <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 4, display: 'grid', gap: 3 }}>{children}</div>
  return (
    <Thumb hotkey="3">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 34%', gap: 5, height: '100%' }}>
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 4 }}>
          <span style={wireStrong} /><span style={wireStrong} /><span style={wireStrong} /><span /><span style={wireBlue} />
        </div>
        <div style={box}>
          <span style={wireStrong} /><span style={wire} /><span style={wire} /><span style={wireStrong} /><span style={wire} /><span style={wireStrong} /><span style={wire} />
        </div>
        <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
          {panel(<><span style={wire} /><span style={{ ...wireStrong, height: 9, width: '60%' }} /></>)}
          {panel(<><span style={wire} /><span style={wire} /></>)}
          {panel(<span style={wire} />)}
        </div>
      </div>
    </Thumb>
  )
}

const COPY: Record<TakeoffView, { desc: string | null; thumb: () => ReactNode }> = {
  old: { desc: null, thumb: () => <OldThumb /> },
  new1: { desc: 'Walk the fixtures in order. Each one shows what the book and your last bids gave it, and Enter moves you on.', thumb: () => <OneThumb /> },
  new2: { desc: 'The whole sheet you know, plus a side panel that shows what Pricing will see and what still needs a price.', thumb: () => <SheetThumb /> },
}

export function TakeoffViewChooser({
  bidLabel,
  fixtures,
  costed,
  onPick,
}: {
  /** "BP398 ZZ Test" — the bid number and project name as the tab title shows them. */
  bidLabel: string
  fixtures: number
  costed: number
  onPick: (view: TakeoffView) => void
}) {
  const firstRef = useRef<HTMLButtonElement>(null)
  // Focus lives inside the dialog so One at a time's Enter / arrow shortcuts behind it stay quiet.
  useEffect(() => {
    firstRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const v = viewForChooserKey(e.key)
      if (!v) return
      e.preventDefault()
      onPick(v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPick])

  const card: CSSProperties = { textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'inherit', padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', font: 'inherit', minWidth: 0 }

  return (
    <div data-testid="takeoff-view-chooser" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="takeoff-view-chooser-title" style={{ width: 'min(960px, 100%)', maxHeight: '100%', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)', padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Bids → Takeoffs · {bidLabel} · {fixtures} fixture{fixtures === 1 ? '' : 's'}, {costed} costed
          </div>
          <h2 id="takeoff-view-chooser-title" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center', textWrap: 'balance' }}>
            How do you want to cost this takeoff?
          </h2>
          <p style={{ margin: 0, color: 'var(--text-600)', textAlign: 'center' }}>You keep the fixture you're on when you switch.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {TAKEOFF_VIEWS.map((v, i) => {
            const c = COPY[v.id]
            return (
              <button
                key={v.id}
                ref={i === 0 ? firstRef : undefined}
                type="button"
                onClick={() => onPick(v.id)}
                title={v.title}
                aria-labelledby={`takeoff-view-card-${v.id}-name`}
                aria-describedby={c.desc ? `takeoff-view-card-${v.id}-desc` : undefined}
                style={card}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {c.thumb()}
                <span id={`takeoff-view-card-${v.id}-name`} style={{ display: 'flex', flex: c.desc ? undefined : 1, alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center' }}>{v.label}</span>
                {c.desc ? <span id={`takeoff-view-card-${v.id}-desc`} style={{ color: 'var(--text-600)', fontSize: '0.86rem', textAlign: 'center' }}>{c.desc}</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
