/**
 * The Tooling family strip (v2.3622): the two sibling apps' marks under the sign-in
 * card, so staff landing here can step across to the plans (CountTooling) or the
 * electrical estimate (Takeoff Tooling). Frosted glass like the trade tiles above,
 * not a second white panel (the owner's pick from three mocks on the real photo). Sign-in route ONLY — the layout it sits in
 * (AuthPublicLandingLayout) also fronts the customer estimate/contract pages, and a
 * homeowner has no use for estimating tools under their contract.
 *
 * The marks are the siblings' own favicons, copied into public/tooling/ so this page
 * never fetches cross-origin. All three apps share the yellow tile.
 */
const APPS = [
  {
    key: 'count',
    name: 'CountTooling',
    blurb: 'Count and measure the plans',
    href: 'https://counttooling.com/',
    icon: '/tooling/counttooling.svg',
  },
  {
    key: 'takeoff',
    name: 'Takeoff Tooling',
    blurb: 'Price the electrical bid',
    href: 'https://takeofftooling.com/',
    icon: '/tooling/takeofftooling.svg',
  },
] as const

export default function ToolingFamilyStrip() {
  return (
    <nav className="tooling-family" aria-label="The Tooling apps">
      <p className="tooling-family__label">The Tooling apps</p>
      <ul className="tooling-family__row">
        {APPS.map((app) => (
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
    </nav>
  )
}
