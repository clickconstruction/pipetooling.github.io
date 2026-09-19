/**
 * The Tooling family strip (v2.3622, "More apps" v2.3624): the two sibling apps'
 * marks under the sign-in card, so staff landing here can step across to the plans
 * (CountTooling) or the electrical estimate (Takeoff Tooling), plus a disclosure
 * listing the rest of the family. Frosted glass like the trade tiles above, not a
 * second white panel (the owner's pick from three mocks on the real photo).
 *
 * Sign-in route ONLY — the layout it sits in (AuthPublicLandingLayout) also fronts the
 * customer estimate/contract pages, and a homeowner has no use for estimating tools
 * under their contract.
 *
 * The featured marks are the siblings' own favicons, copied into public/tooling/ so
 * this page never fetches cross-origin. The list itself lives in lib/toolingFamily.ts.
 * The disclosure is a native <details> — no state, keyboard and screen-reader
 * behaviour for free, and it expands in place rather than floating over the photo.
 */
import { FEATURED_APPS, MORE_APPS } from '../lib/toolingFamily'

export default function ToolingFamilyStrip() {
  return (
    <nav className="tooling-family" aria-label="The Tooling apps">
      <p className="tooling-family__label">The Tooling apps</p>
      <ul className="tooling-family__row">
        {FEATURED_APPS.map((app) => (
          <li key={app.key}>
            <a
              className="tooling-family__app"
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${app.name} — ${app.blurb} (opens in new tab)`}
            >
              <img
                className="tooling-family__mark"
                src={app.icon}
                alt=""
                width={28}
                height={28}
              />
              <span className="tooling-family__text">
                <span className="tooling-family__name">{app.name}</span>
                <span className="tooling-family__blurb">{app.blurb}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <details className="tooling-family__more">
        <summary className="tooling-family__more-summary">
          More apps
          <span className="tooling-family__more-count" aria-hidden>
            {MORE_APPS.length}
          </span>
        </summary>
        <ul className="tooling-family__more-list">
          {MORE_APPS.map((app) => (
            <li key={app.key}>
              <a
                className="tooling-family__more-app"
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${app.name} — ${app.blurb} (opens in new tab)`}
              >
                <span className="tooling-family__name">{app.name}</span>
                <span className="tooling-family__blurb">{app.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  )
}
