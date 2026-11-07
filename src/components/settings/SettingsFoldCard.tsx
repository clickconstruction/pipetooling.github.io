/**
 * One folding card on Settings (punch list #261): the header row with the ▶, the card's name
 * and one line of what it sets, and the body under it when open. Every card on Jobs & billing
 * is one, and so are the three cards that moved to other tabs in PR 2. The section carries the
 * card's anchor, so a link lands on it, and the header is a counted press (`<tab> · #<slug>` in
 * Settings → Usage), so the next look at a tab can rank its cards by use. A card with a live
 * value (the Billing and money cards since PR 3) draws it on the folded row in place of the
 * static line, and the static line again while the card is open or until the value is read.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useSettingsCardOpen } from '../../hooks/useSettingsCardOpen'
import { recordViewerNavClick } from '../../lib/navClickViewer'
import type { SettingsFoldCardSpec } from '../../lib/settings/settingsFoldCards'

const SECTION: CSSProperties = { marginBottom: '0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', scrollMarginTop: 'var(--settings-jobs-jump-offset, 0.75rem)' }
const HEAD: CSSProperties = { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.25rem 0.5rem', margin: 0, padding: '0.7rem 0.9rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }
const TRI: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', flex: 'none' }
const TITLE: CSSProperties = { fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-strong)' }
const LINE: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const VALUE: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-base)' }
const BODY: CSSProperties = { borderTop: '1px solid var(--border)' }

export function SettingsFoldCard({ card, track, forceOpen = false, valueLine, onFold, children }: {
  card: SettingsFoldCardSpec
  /** The tab the press is counted under (`data-navtrack`): `settings-jobs`, `settings-data`, … */
  track: string
  forceOpen?: boolean
  /** The card's live value in one line, drawn on the folded row; null or undefined keeps the static line. */
  valueLine?: string | null
  /** Called when the header press folds the card, so the page reads the value again. */
  onFold?: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useSettingsCardOpen(card, forceOpen)
  const titleId = `${card.anchor}-title`
  const bodyId = `${card.anchor}-body`
  const live = !open && valueLine != null && valueLine !== ''
  const press = () => {
    if (open) onFold?.()
    setOpen((v) => !v)
  }
  return (
    <section id={card.anchor} data-settings-card={card.slug} data-open={open ? 'yes' : 'no'} aria-labelledby={titleId} style={SECTION}>
      <div data-navtrack={track} data-navbuttons onClickCapture={recordViewerNavClick}>
        <button type="button" data-nav={card.slug} aria-expanded={open} aria-controls={bodyId} onClick={press} style={HEAD}>
          <span aria-hidden style={TRI}>{open ? '▼' : '▶'}</span>
          <span id={titleId} style={TITLE}>{card.title}</span>
          <span data-fold-line={live ? 'value' : 'static'} style={live ? VALUE : LINE}>
            {live ? valueLine : card.line}
          </span>
        </button>
      </div>
      {open ? (
        <div id={bodyId} className="settingsFoldBody" style={BODY}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
