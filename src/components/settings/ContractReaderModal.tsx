/**
 * Read it as the customer sees it (v2.4098): a Contracts & terms card's wording on the customer's
 * own page — the sample-mode page, email or paper What customers see renders — in a modal, with the
 * wording found and lit on it. Chips switch between the surfaces the card is seen on; the footer
 * opens the page in a tab, prints it, and carries the card's edit door so a read can turn into a fix.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useSampleFrameSources } from '../../hooks/useSampleFrameSources'
import { stepFrameProps, stepOpenUrl } from '../../lib/journeys/stepFrame'
import type { PaperId } from '../../lib/journeys/paperSamples'
import type { SampleEmailId } from '../../lib/customerJourneys'
import { findWordingInDocument, readerSampleLine, revealHit, wordingNeedles, type ReaderSurface } from '../../lib/contracts/contractReader'
import type { ContractCatalogEntry, ResolvedContractText } from '../../lib/contracts/customerContractCatalog'

export type ContractReaderEditDoor = { label: string; onClick?: () => void; to?: string }

const PILL = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' } as const
const PILL_ON = { ...PILL, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' } as const

/** How long the reader keeps looking for the wording on a page that fills in after it loads: 500 ms between looks, 16 looks once the page has text, 40 at most. */
const HIT_TRIES = 16
const HIT_TRIES_MAX = 40
const HIT_EVERY_MS = 500

export default function ContractReaderModal({ entry, text, surfaces, editDoor, onClose }: { entry: Pick<ContractCatalogEntry, 'pins'>; text: ResolvedContractText; surfaces: ReaderSurface[]; editDoor: ContractReaderEditDoor | null; onClose: () => void }) {
  const [picked, setPicked] = useState(0)
  const surface = surfaces[Math.min(picked, surfaces.length - 1)] ?? null
  const emailIds = useMemo(() => surfaces.flatMap((s) => (s.step.render.kind === 'email' ? [s.step.render.email as SampleEmailId] : [])), [surfaces])
  const paperIds = useMemo(() => surfaces.flatMap((s) => (s.step.render.kind === 'paper' ? [s.step.render.paper as PaperId] : [])), [surfaces])
  const { emails, papers, origin, loading } = useSampleFrameSources(emailIds, paperIds)
  const frame = surface ? stepFrameProps(surface.step, emails, papers, origin, 0) : null
  const openUrl = surface ? stepOpenUrl(surface.step, origin) : null
  // The sentences pinned to page source (the consent, the signing sentences) are searched for too — word for word, as the page prints them.
  const needles = useMemo(() => Array.from(new Set([...wordingNeedles(text), ...(entry.pins ?? []).map((p) => p.text)])), [text, entry.pins])
  const needle = needles[0] ?? null
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  // null: still looking; false: not on this page; true: lit.
  const [hit, setHit] = useState<boolean | null>(null)
  const triesRef = useRef(0)

  const frameDoc = (): Document | null => {
    try {
      return iframeRef.current?.contentDocument ?? null
    } catch {
      return null
    }
  }
  const look = useCallback((): boolean => {
    const doc = frameDoc()
    if (!doc || !needle) return false
    const hit = findWordingInDocument(doc, needles)
    if (!hit) return false
    revealHit(hit)
    return true
  }, [needle, needles])

  // A page fills in after it loads (the sample is read from a function), so the look retries for a while.
  useEffect(() => {
    setHit(null)
    triesRef.current = 0
    if (!frame || !needle) {
      setHit(false)
      return
    }
    let timer = 0
    let all = 0
    const tick = () => {
      if (look()) {
        setHit(true)
        return
      }
      // A look at a page with no text yet (still loading) does not count against the wording.
      const hasText = ((frameDoc()?.body?.textContent ?? '').trim().length > 0)
      if (hasText) triesRef.current += 1
      all += 1
      if (triesRef.current >= HIT_TRIES || all >= HIT_TRIES_MAX) {
        setHit(false)
        return
      }
      timer = window.setTimeout(tick, HIT_EVERY_MS)
    }
    timer = window.setTimeout(tick, HIT_EVERY_MS)
    return () => window.clearTimeout(timer)
  }, [frame?.key, needle, look])

  const print = () => {
    try {
      const w = iframeRef.current?.contentWindow
      if (w && iframeRef.current?.contentDocument) {
        w.focus()
        w.print()
        return
      }
    } catch {
      /* another origin: fall through */
    }
    if (openUrl) window.open(openUrl, '_blank', 'noopener')
  }

  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', padding: '0.6rem 0 0.7rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The real page, with sample information — nothing here is a customer.</span>
      <span style={{ flex: 1 }} />
      {openUrl ? (
        <a href={openUrl} target="_blank" rel="noopener noreferrer" style={PILL}>
          Open in new tab ↗
        </a>
      ) : null}
      {frame ? (
        <button type="button" style={PILL} onClick={print}>
          Print
        </button>
      ) : null}
      {editDoor?.to ? (
        <Link to={editDoor.to} style={PILL} onClick={onClose}>
          {editDoor.label} →
        </Link>
      ) : editDoor?.onClick ? (
        <button type="button" style={PILL} onClick={editDoor.onClick} data-testid="contract-reader-edit">
          {editDoor.label} →
        </button>
      ) : null}
      <button type="button" style={{ ...PILL, padding: '0.35rem 0.9rem' }} onClick={onClose} data-testid="contract-reader-close">
        Close
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={`${text.title} · as the customer sees it`} onRequestClose={onClose} maxWidthDesktop={1100} fullScreenKey="contract-reader" footer={footer} zIndex={1150}>
      {({ fullScreen }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', ...(fullScreen ? { flex: '1 1 auto', minHeight: 0, marginBottom: '0.25rem' } : {}) }} data-testid="contract-reader">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            {surfaces.length > 1 ? <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.2rem' }}>Where the customer meets it</span> : null}
            {surfaces.length > 1
              ? surfaces.map((s, i) => (
                  <button key={`${s.journeyId}/${s.stepId}`} type="button" style={i === picked ? PILL_ON : PILL} aria-pressed={i === picked} onClick={() => setPicked(i)}>
                    {s.label}
                  </button>
                ))
              : null}
            {surface ? (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600 }} data-testid="contract-reader-sample">
                Sample · {readerSampleLine(surface)}
              </span>
            ) : null}
            {hit === true ? (
              <button type="button" style={{ ...PILL, borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)' }} onClick={() => look()} title="Scroll the page back to your wording">
                Your wording ↓
              </button>
            ) : hit === false && needle ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title="The page fills in from the sample; the words on the card were not found on it">
                Your wording was not found on this page{surfaces.length > 1 ? ' — try another page above' : ''}
              </span>
            ) : null}
          </div>
          {frame ? (
            <iframe
              key={frame.key}
              ref={iframeRef}
              {...frame.attrs}
              sandbox={frame.attrs.srcDoc != null ? 'allow-same-origin' : undefined}
              title={frame.attrs.title}
              onLoad={() => {
                if (look()) setHit(true)
              }}
              style={{ width: '100%', height: fullScreen ? 'auto' : '64vh', ...(fullScreen ? { flex: '1 1 auto', minHeight: 0 } : {}), border: '1px solid var(--border)', borderRadius: 8, background: '#f3f5f7', display: 'block' }}
            />
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{loading ? 'Building the sample…' : surface ? 'This sample could not be built.' : 'Nothing to show for this card.'}</p>
          )}
        </div>
      )}
    </ResponsiveModalShell>
  )
}
