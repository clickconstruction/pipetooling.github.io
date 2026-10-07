import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { stepRunPreview } from '../../lib/jobs/lienDeskRun'
import { LIEN_RULE_CITES } from '../../lib/jobs/lienRuleCites'
import { lienStopPaperKind, lienStopRuleCite, lienStopWindowWords } from '../../lib/jobs/lienStopPaper'
import type { LienStopPaperPage } from '../../lib/jobs/lienStopPaperPages'
import type { LienTimelineStep } from '../../lib/jobs/lienTimeline'

// The rules window rides in the lazy chunk it shares with the /help page (see LienRulesDoor).
const LienRulesModal = lazy(() => import('./LienRulesModal'))

/**
 * A stop's paper (v2.4793, the owner's ask): the window that opens from a stop's title on the lien
 * timeline. Left, the paper that stop sends as it would print today — or, for a stop that sends
 * nothing of ours (last work, the owner's hold, counsel's suit), the words that stand in for the
 * page. Right, the stop's facts, who the envelope goes to, what must be true first, the rule, and
 * the stop's one act. ‹ › and the arrow keys walk the stops of the same job; Esc closes this alone.
 * The host builds the pages (`paperFor`), from the same builders that print them.
 */
export interface LienStopPaper {
  /** The pages, as the packet prints them; empty when the stop has none to show. */
  pages: ReadonlyArray<LienStopPaperPage>
  /** `To JBI LIBERTY HILL LLC and Burd & Assoc. by certified mail · courtesy PDF to …`; null when nothing is mailed. */
  envelope: string | null
  /** What must be true before the paper can go — the gates not yet clear. */
  before: ReadonlyArray<{ key: string; words: string }>
  /** The paper as it went out, when the stop is done: the words and the stored document, if any. */
  record: { words: string; href: string | null } | null
  /** The stop's one act. */
  act: { label: string; onPress: () => void } | null
  /** The months the stop's notice carries, when known — the title names them all. */
  noticeMonths?: ReadonlyArray<string> | null
  /** A line under the pages, when the host has one — why a page is missing, or where it lives. */
  note?: string | null
}

type Props = {
  steps: ReadonlyArray<LienTimelineStep>
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  /** `891 · Take 5- Liberty Hill` */
  jobLabel: string
  paperFor: (step: LienTimelineStep) => LienStopPaper
}

const railHead: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const navBtn = (disabled: boolean): CSSProperties => ({ padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.9rem', lineHeight: 1.2, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 })
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens (index.css), as on the desk. */
const paperStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', padding: '1.1rem 1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontFamily: "Georgia, 'Times New Roman', serif", color: 'var(--text)', fontSize: '0.85rem', lineHeight: 1.45 }
const kbd: CSSProperties = { fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', background: 'var(--surface)' }
const card: CSSProperties = { padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: '0.8rem', lineHeight: 1.45 }
const linkBtn: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }

export default function LienStopPaperWindow({ steps, index, onIndex, onClose, jobLabel, paperFor }: Props) {
  const isMobile = useIsMobile()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [ruleOpen, setRuleOpen] = useState(false)
  const total = steps.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const step = steps[safeIndex]

  // Esc closes only this window; the arrows walk the stops. Capture, so the desk underneath never sees the key. The rules window, when open, keeps the keys.
  useEffect(() => {
    if (ruleOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.stopPropagation()
      e.preventDefault()
      if (e.key === 'Escape') onClose()
      else onIndex(stepRunPreview(safeIndex, e.key === 'ArrowRight' ? 1 : -1, total))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, onIndex, safeIndex, total, ruleOpen])
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [safeIndex])

  if (!step) return null
  const paper = paperFor(step)
  const words = lienStopWindowWords({ step, noticeMonths: paper.noticeMonths ?? null })
  const kind = lienStopPaperKind(step)
  const cite = lienStopRuleCite(step)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${words.eyebrow} — what this stop sends`}
      data-testid="lien-stop-paper"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 790 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1040px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>
            <button type="button" aria-label="Previous stop" disabled={safeIndex === 0} onClick={() => onIndex(stepRunPreview(safeIndex, -1, total))} style={navBtn(safeIndex === 0)}>‹</button>
            <button type="button" aria-label="Next stop" disabled={safeIndex >= total - 1} onClick={() => onIndex(stepRunPreview(safeIndex, 1, total))} style={navBtn(safeIndex >= total - 1)}>›</button>
          </div>
          <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }} data-testid="lien-stop-paper-eyebrow">{words.eyebrow}</span>
              <h2 style={{ margin: 0, fontSize: '0.95rem', minWidth: 0 }} data-testid="lien-stop-paper-title">{words.title}</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} data-testid="lien-stop-paper-count">stop {safeIndex + 1} of {total} · {jobLabel}</span>
            </div>
            {words.line ? <div style={{ fontSize: '0.78rem', color: 'var(--text-700)' }} data-testid="lien-stop-paper-line">{words.line}</div> : null}
          </div>
          <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1, flex: 'none' }}>×</button>
        </div>
        <div ref={scrollRef} style={{ overflow: 'auto', minHeight: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 300px', gap: '0.85rem', padding: isMobile ? '0.6rem' : '0.85rem', background: 'var(--bg-muted)', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: '0.6rem', minWidth: 0 }}>
            {words.noPaper ? (
              <div data-testid="lien-stop-paper-none" style={{ ...card, display: 'grid', gap: '0.6rem', padding: '0.9rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-700)' }}>Nothing of ours goes out at this stop. This is what happens instead.</div>
                <div><strong>What happens.</strong> {words.noPaper.what}</div>
                <div><strong>Who moves.</strong> {words.noPaper.who}</div>
                <div><strong>After it.</strong> {words.noPaper.after}</div>
              </div>
            ) : paper.pages.length ? (
              paper.pages.map((p) => (
                <div key={p.key} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ ...railHead, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{p.label}</span>
                    <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>as it would print today</span>
                  </div>
                  <div data-theme="light" data-testid="lien-stop-paper-page" style={paperStyle}>
                    <div dangerouslySetInnerHTML={{ __html: p.html }} />
                  </div>
                </div>
              ))
            ) : (
              <div data-testid="lien-stop-paper-empty" style={{ ...card, padding: '0.9rem 1rem', color: 'var(--text-700)' }}>
                {paper.record ? (
                  <>
                    <div style={{ fontWeight: 700 }}>{paper.record.words}</div>
                    {paper.record.href ? (
                      <a href={paper.record.href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, color: 'var(--text-link)', fontWeight: 600 }}>
                        Open the {kind === 'affidavit' || kind === 'serve' ? 'filed affidavit' : kind === 'release' ? 'filed release' : 'mailed packet'} ↗
                      </a>
                    ) : (
                      <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>The paper as it went out is the record; the desk keeps no copy of it here.</div>
                    )}
                  </>
                ) : (
                  <div>{paper.note ?? 'No page to show yet for this stop.'}</div>
                )}
              </div>
            )}
            {paper.note && (paper.pages.length || paper.record) ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{paper.note}</div> : null}
          </div>
          <div style={{ display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={railHead}>This stop</div>
              <div style={card} data-testid="lien-stop-paper-facts">
                <div style={{ fontWeight: 700, color: step.state === 'undated' || step.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{step.dateWords || '—'}{step.daysLeft != null && step.state === 'due' ? ` · ${step.daysLeft} ${step.daysLeft === 1 ? 'day' : 'days'}` : ''}</div>
                {step.opensWords ? <div style={{ color: 'var(--text-green-800)', fontWeight: 600 }}>{step.opensWords}</div> : null}
                {step.words ? <div style={{ color: 'var(--text-700)' }}>{step.words}</div> : null}
                {paper.record ? <div style={{ color: 'var(--text-700)', marginTop: 4 }}>{paper.record.words}</div> : null}
              </div>
            </div>
            {paper.envelope ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={railHead}>In the envelope</div>
                <div style={card} data-testid="lien-stop-paper-envelope">✉ {paper.envelope}</div>
              </div>
            ) : null}
            {paper.before.length ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={railHead}>Before it can go</div>
                {paper.before.map((b) => (
                  <div key={b.key} data-testid="lien-stop-paper-before" style={{ ...card, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>{b.words}</div>
                ))}
              </div>
            ) : null}
            {cite ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={railHead}>The rule</div>
                <button type="button" data-testid="lien-stop-paper-rule" onClick={() => setRuleOpen(true)} style={linkBtn}>
                  {cite} · {LIEN_RULE_CITES[cite]} ›
                </button>
              </div>
            ) : null}
            {paper.act ? (
              <button type="button" data-testid="lien-stop-paper-act" onClick={paper.act.onPress} style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid var(--border-blue)', background: 'var(--text-link)', color: '#fff', font: 'inherit', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                {paper.act.label}
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>{words.noPaper ? 'No paper of ours at this stop.' : paper.pages.length ? 'Read-only: the paper as it would print today, from the job. Change it where it is drafted.' : 'The paper as it went out is the record.'}</span>
          {isMobile ? null : <span><span style={kbd}>←</span> <span style={kbd}>→</span> next stop · <span style={kbd}>Esc</span> back</span>}
        </div>
      </div>
      {ruleOpen && cite ? (
        <Suspense fallback={null}>
          <LienRulesModal cite={cite} onClose={() => setRuleOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}
