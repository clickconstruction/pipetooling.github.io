import { Fragment, useEffect, useRef, type CSSProperties } from 'react'
import { LIEN_FIND_PLACEHOLDER, lienFindCountWords, lienFindParts, type LienFindFact } from '../../lib/jobs/lienDeskFind'

/**
 * The find box at the top of the Lien desk's list (v2.4721): one box on every list, narrowing
 * as you type. `/` focuses it from anywhere on the desk (never from another field), Esc clears
 * it while it has the focus, × clears it on a phone. Controlled: the desk owns the words.
 */
type Props = {
  value: string
  onChange: (value: string) => void
  /** How many rows match right now; shown beside the words while finding. */
  matched: number
  isMobile: boolean
}

const kbd: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.68rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', color: 'var(--text-muted)', background: 'var(--surface)' }

export default function LienDeskFindBox({ value, onChange, matched, isMobile }: Props) {
  const ref = useRef<HTMLInputElement | null>(null)
  const finding = value.trim().length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      ref.current?.focus()
      ref.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      data-testid="lien-desk-find"
      data-finding={finding ? 'yes' : 'no'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0.5rem 0.75rem 0.35rem', padding: '4px 8px 4px 9px', border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)' }}
    >
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1 }}>⌕</span>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            e.preventDefault()
            onChange('')
          }
        }}
        placeholder={LIEN_FIND_PLACEHOLDER}
        aria-label="Find on the list"
        autoComplete="off"
        data-testid="lien-desk-find-input"
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-strong)', outline: 'none', padding: '2px 0' }}
      />
      {finding ? (
        <>
          <span data-testid="lien-desk-find-count" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{lienFindCountWords(matched)}</span>
          <button type="button" onClick={() => { onChange(''); ref.current?.focus() }} aria-label="Clear the find" data-testid="lien-desk-find-clear" style={{ border: 'none', background: 'var(--bg-subtle)', color: 'var(--text-muted)', borderRadius: 999, width: 20, height: 20, fontSize: '0.8rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </>
      ) : isMobile ? null : (
        <span style={kbd} aria-hidden="true">/</span>
      )}
    </div>
  )
}

/** A row's text with the typed words marked. */
export function LienFindMarked({ text, words }: { text: string; words: ReadonlyArray<string> }) {
  if (!words.length) return <>{text}</>
  return (
    <>
      {lienFindParts(text, words).map((p, i) =>
        p.hit ? (
          <mark key={i} data-lien-find-mark style={{ background: 'var(--bg-amber-tint)', color: 'inherit', padding: '0 1px', borderRadius: 2 }}>
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  )
}

/** The hidden facts a find landed on, written into the row so the hit makes sense. */
export function LienFindHits({ hits, words }: { hits: ReadonlyArray<LienFindFact> | undefined; words: ReadonlyArray<string> }) {
  if (!hits?.length) return null
  return (
    <>
      {hits.map((h) => (
        <span key={h.label} data-lien-find-hit={h.label} style={{ color: 'var(--text-700)' }}>
          · {h.label} <LienFindMarked text={h.text} words={words} />
        </span>
      ))}
    </>
  )
}
