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
 * this page never fetches cross-origin. The ten under "More apps" carry the house marks
 * the owner picked on 2026-09-19 (v2.3626) — the same files each app's own repo takes in
 * the rollout; the closed disclosure previews them as a row of small tiles, so the family
 * shows before anyone opens it. The list itself lives in lib/toolingFamily.ts.
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
                <img
                  className="tooling-family__mark tooling-family__mark--small"
                  src={app.icon}
                  alt=""
                  width={26}
                  height={26}
                />
                <span className="tooling-family__text">
                  <span className="tooling-family__name">{app.name}</span>
                  <span className="tooling-family__blurb">{app.blurb}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </details>
      {/* Outside <details> so it shows while the list is closed; CSS hides it once open. */}
      <div className="tooling-family__more-preview" aria-hidden>
        {MORE_APPS.map((app) => (
          <img key={app.key} src={app.icon} alt="" width={20} height={20} />
        ))}
      </div>
    </nav>
  )
}
