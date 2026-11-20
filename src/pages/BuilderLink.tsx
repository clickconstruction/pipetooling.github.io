/**
 * A Document builder link, opened (punch list #404, step 4): `/d/:code`, a public page outside the app's frame, with
 * no login. It shows one published sheet to whoever holds the link: a sub, or the insurance agent a sub sent it on
 * to. The page is always light, and it prints as the one sheet.
 *
 * The code is the capability. A wrong code, a link switched off and a link a new one replaced all read the same. What
 * shows is the published copy and never a draft.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { SheetPaperRead } from '../components/documentBuilder/SheetPaper'
import { DOCUMENT_BUILDER_LINK_WORDS as WORDS } from '../lib/documentBuilder/link'
import { openBuilderLink, type BuilderLinkView } from '../lib/documentBuilder/linkIo'

type Props = {
  /** Opens the link. For a smoke. */
  open?: typeof openBuilderLink
}

const PAGE: CSSProperties = { minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-base)', fontFamily: `-apple-system, 'Segoe UI', Roboto, sans-serif`, padding: '1.25rem 1rem 3rem' }
const COLUMN: CSSProperties = { maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }
const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', fontSize: '0.9rem' }
const PRESS: CSSProperties = { border: 0, background: '#2563eb', color: 'white', borderRadius: 9, padding: '10px 16px', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700, minHeight: 44, cursor: 'pointer', justifySelf: 'start' }
const QUIET_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 9, padding: '8px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, minHeight: 40, cursor: 'pointer', justifySelf: 'start' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }

type View = BuilderLinkView | { kind: 'reading' }

export default function BuilderLink({ open = openBuilderLink }: Props) {
  const { code = '' } = useParams()
  const [view, setView] = useState<View>({ kind: 'reading' })
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let cancelled = false
    setView({ kind: 'reading' })
    void open(code).then((got) => {
      if (!cancelled) setView(got)
    })
    return () => {
      cancelled = true
    }
  }, [open, code, tries])

  return (
    <div data-theme="light" data-builder-link={view.kind} style={PAGE}>
      {/* The page is the sheet and little else, so printing it is hiding what is not the sheet. */}
      <style>{`@page { size: letter; margin: 0.5in; } @media print { .builder-link-chrome { display: none !important; } [data-builder-link] { background: none !important; padding: 0 !important; min-height: 0 !important; } [data-sheet-paper] { border: 0 !important; padding: 0 !important; } }`}</style>
      <div style={COLUMN}>
        {view.kind === 'reading' ? <p style={FINE}>Opening the link…</p> : null}
        {view.kind === 'gone' ? (
          <div style={CARD} role="status">
            {view.words}
          </div>
        ) : null}
        {view.kind === 'signal' ? (
          <div style={{ ...CARD, display: 'grid', gap: 10 }} role="alert">
            <span>Could not reach the page. Check your signal, then try again.</span>
            <button type="button" style={QUIET_PRESS} onClick={() => setTries((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : null}
        {view.kind === 'failed' ? (
          <div style={{ ...CARD, display: 'grid', gap: 10 }} role="alert">
            <span>{view.words}</span>
            <button type="button" style={QUIET_PRESS} onClick={() => setTries((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : null}
        {view.kind === 'sheet' ? (
          <>
            <SheetPaperRead sheet={view.sheet} stamp={`Revision ${view.revision}${view.job ? ` · ${view.job}` : ''}`} />
            <button type="button" className="builder-link-chrome" style={PRESS} onClick={() => window.print()}>
              Print this sheet
            </button>
            <p className="builder-link-chrome" style={FINE}>
              This page shows what the certificate of insurance must show on this job. It is the published sheet.
            </p>
          </>
        ) : null}
        {view.kind === 'builder' ? (
          <div style={CARD} role="status">
            {WORDS.nothing}
          </div>
        ) : null}
      </div>
    </div>
  )
}
