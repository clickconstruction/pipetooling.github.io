import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { LIEN_RULES_DOOR } from '../../lib/jobs/lienRuleCites'
import type { LienRulesJob } from '../../lib/jobs/lienRulesDates'

// The window reads one guide through `helpGuideRegistry`, whose eager glob carries every help guide
// (about 1.7 MB of text). Imported here directly it put that text in the app's main chunk, past the
// service worker's 5 MiB precache cap, and every deploy build failed from v2.4655 on. Loaded on the
// first press, it rides in the lazy chunk it shares with the /help page.
const LienRulesModal = lazy(() => import('./LienRulesModal'))

/**
 * § Rules (v2.3594; it read "§ The rules" until v2.4528): the door from the Lien desk header and the Lien window's tab row to
 * the guide *read the Texas lien rules the app follows*, opened at the row that matters for
 * what is on screen. Since v2.4655 it opens the rules as a window over the desk with a find
 * box (`LienRulesModal`), not a new page — the desk or window stays open behind it. Shows
 * wherever its surface shows; the guide's own front matter gates who reads it. Since v2.4826
 * the desk hands it the picked job (`job`), which the window names in a strip with its two
 * dates and lights in the clock rule's table.
 */
export function LienRulesDoor({
  where,
  style,
  job,
  todayYmd,
  open: openGiven,
  onOpenChange,
  button = true,
}: {
  where: keyof typeof LIEN_RULES_DOOR
  style?: CSSProperties
  job?: LienRulesJob | null
  todayYmd?: string
  /** Held by the caller when the door is pressed somewhere else: the Lien desk's More sheet on a phone (punch list #352, PR 1). Absent, the door holds it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** False draws no button, only the window when open. */
  button?: boolean
}) {
  const cite = LIEN_RULES_DOOR[where]
  const [openHere, setOpenHere] = useState(false)
  const open = openGiven ?? openHere
  const setOpen = (next: boolean) => {
    setOpenHere(next)
    onOpenChange?.(next)
  }
  return (
    <>
      {button ? <button
        type="button"
        data-testid="lien-rules-door"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`The Texas lien rules the app follows — opens the rules here at ${cite}, with a find box`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '2px 10px',
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: open ? 'var(--bg-blue-tint)' : 'var(--surface)',
          color: open ? 'var(--text-blue-800)' : 'var(--text-700)',
          font: 'inherit',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        § Rules
      </button> : null}
      {open ? (
        <Suspense fallback={null}>
          <LienRulesModal cite={cite} job={job} todayYmd={todayYmd} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
