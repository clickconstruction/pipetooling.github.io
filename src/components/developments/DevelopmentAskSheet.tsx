/**
 * Ask a question from the Development page (punch list #208 PR 4): a window with the lane (the
 * estimators or Dispatch), what it is about (the site, or one job or bid on it), and the question;
 * the send writes the lane's own request with one reference, the push goes as from the header's
 * modals, and the answer comes back under Questions. The words and the row come from
 * `lib/developments/ask.ts`. From a bid's or a job's own window (PR 4b) the same sheet opens with
 * that record as its one About and `landsWith` naming it. It is drawn through a portal on the body,
 * never inside the window's own scroll box (a focus in the sheet scrolled the Job window's panel
 * sideways), at the caller's `zIndex` above that window; its backdrop stops the click and its
 * Escape is taken before the window's listener sees it.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { ASK_LANES, ASK_TITLE_MAX, askFootWords, askIsSendable, type AskAbout, type AskDraft, type AskLane } from '../../lib/developments/ask'
import { capStyle, SmallButton } from './developmentPageBits'

export type AskAboutOption = { key: string; label: string; about: AskAbout; group: 'site' | 'jobs' | 'bids' }

const GROUP_LABEL: Record<AskAboutOption['group'], string> = { site: 'The site', jobs: 'Jobs', bids: 'Bids' }

export type AskPreset = { lane?: AskLane; aboutKey?: string; title?: string }

export function DevelopmentAskSheet({
  open,
  preset,
  options,
  siteName,
  landsWith = 'the site',
  zIndex = 760,
  busy,
  onSend,
  onClose,
}: {
  open: boolean
  preset: AskPreset | null
  options: AskAboutOption[]
  /** What the title names: the site, or the record (*JP1085 Lot 14 rough-in*). */
  siteName: string
  /** What the foot says the question lands with: *the site*, *this bid*, *this job*. */
  landsWith?: string
  /** The layer's z-index: the page's own by default; a record's window passes one above itself (`RECORD_ASK_Z`). */
  zIndex?: number
  busy: boolean
  onSend: (draft: AskDraft) => Promise<boolean>
  onClose: () => void
}) {
  const [lane, setLane] = useState<AskLane>('estimators')
  const [aboutKey, setAboutKey] = useState('site')
  const [title, setTitle] = useState('')
  // While open the sheet is the topmost window, so a window under it that asks the stack (the Bid window) leaves Escape to it.
  useModalStackEntry(open)
  useEffect(() => {
    if (!open) return
    setLane(preset?.lane ?? 'estimators')
    setAboutKey(preset?.aboutKey ?? 'site')
    setTitle(preset?.title ?? '')
  }, [open, preset])
  useEffect(() => {
    if (!open) return
    // Taken in the capture phase and marked handled, so a window this sheet sits in (the Job window checks `defaultPrevented`) keeps its own Escape for the next press.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  if (!open) return null
  const option = options.find((o) => o.key === aboutKey) ?? options[0]
  const laneWords = ASK_LANES.find((l) => l.key === lane) ?? ASK_LANES[0]!
  const sendable = !!option && askIsSendable({ title }) && !busy
  const send = async () => {
    if (!option || !sendable) return
    const ok = await onSend({ lane, about: option.about, title })
    if (ok) onClose()
  }
  const groups = (['site', 'jobs', 'bids'] as const).map((g) => ({ g, items: options.filter((o) => o.group === g) })).filter((x) => x.items.length > 0)
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Ask a question" data-testid="ask-sheet" style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px' }} onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="developmentHistoryBox" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 560, maxWidth: '100%', maxHeight: 'calc(100vh - 32px - env(safe-area-inset-top, 0px))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1rem' }}>Ask a question about {siteName}</strong>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1.2rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span style={capStyle}>To</span>
            <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }} role="radiogroup" aria-label="To">
              {ASK_LANES.map((l) => (
                <button key={l.key} type="button" role="radio" aria-checked={lane === l.key} className="developmentHistoryChip" data-on={lane === l.key ? '1' : undefined} title={l.who} onClick={() => setLane(l.key)} data-testid={`ask-lane-${l.key}`}>
                  {l.label}
                </button>
              ))}
            </span>
            <span style={{ color: 'var(--text-faint)', fontSize: '0.74rem' }}>{laneWords.who}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span style={capStyle}>About</span>
            <select value={aboutKey} onChange={(e) => setAboutKey(e.target.value)} aria-label="About" data-testid="ask-about">
              {groups.map(({ g, items }) => (
                <optgroup key={g} label={GROUP_LABEL[g]}>
                  {items.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, ASK_TITLE_MAX))}
            rows={3}
            placeholder="The question, in a sentence or two."
            aria-label="The question"
            data-testid="ask-title"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void send()
              }
            }}
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{askFootWords(landsWith)}</div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <SmallButton onClick={() => void send()} primary disabled={!sendable} title={sendable ? 'Send the question' : 'Write the question first'}>
            {busy ? 'Sending…' : laneWords.verb}
          </SmallButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
