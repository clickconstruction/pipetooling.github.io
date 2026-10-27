import type { CSSProperties } from 'react'
import { pt, type PortalLang } from '../../lib/gc/portalI18n'
import type { PortalFailure } from '../../lib/portal/portalFailure'
import { telHrefFor } from '../../lib/phoneContact'
import { CARD, HAIR, INK, PAPER_RED } from '../../lib/portal/portalTheme'

type Props = {
  failure: PortalFailure | null
  lang?: PortalLang
  /** Re-runs what failed, the send or the load. Drawn only when the failure says Try again can help. */
  onTryAgain?: () => void
  /** The action is running again: the press hides until it settles. */
  busy?: boolean
  /** The page draws the failure's own heading and sentence, so only the presses draw here. */
  doorsOnly?: boolean
  style?: CSSProperties
  messageStyle?: CSSProperties
}

/**
 * A public page's failure line (punch list #184, v2.5965): the sentence `portalFailure` words in the page's
 * language, the class's or the function's own known one, never other server text. Try again shows where it can
 * help; Call the office shows from the failure's own number (`portalFailure(…, { phone })`), so the button and the
 * sentence that says *Please call the office.* always agree. Single-theme light, painted with the portal's own
 * colors like every page it sits on.
 */
export function PortalFailureNote({ failure, lang = 'en', onTryAgain, busy = false, doorsOnly = false, style, messageStyle }: Props) {
  if (!failure) return null
  const showTry = failure.tryAgain && onTryAgain != null && !busy
  const showCall = failure.phone != null
  if (doorsOnly && !showTry && !showCall) return null
  return (
    <div role="alert" data-portal-failure={failure.kind} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', ...style }}>
      {doorsOnly ? null : <span style={{ color: PAPER_RED, fontSize: 12.5, lineHeight: 1.5, ...messageStyle }}>{failure.message}</span>}
      {showTry ? (
        <button
          type="button"
          onClick={onTryAgain}
          style={{ background: CARD, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.4rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}
        >
          {pt(lang, 'failTryAgain')}
        </button>
      ) : null}
      {failure.phone != null ? (
        <a href={telHrefFor(failure.phone)} style={{ color: INK, fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>
          {pt(lang, 'failCallOffice')}
        </a>
      ) : null}
    </div>
  )
}
