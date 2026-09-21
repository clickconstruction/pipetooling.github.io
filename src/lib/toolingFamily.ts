/**
 * The Tooling family (v2.3622 / v2.3624): every sibling app the sign-in strip links to.
 *
 * `featured` are the two big tiles (the apps an estimator moves between mid-bid); `more`
 * sit under the "More apps" disclosure. Every app carries a house mark in public/tooling/
 * (v2.3626: the ten under More apps took the marks picked on 2026-09-19; v2.3674: PayTooling
 * redrawn after the studio pass — the record is docs/recent-features/v2.3626.md and v2.3674.md;
 * the candidates, audit and measure adapter are in git history under to-dos/tooling-icons/,
 * deleted 2026-09-21). Only apps with a LIVE public URL belong
 * here — a dead link on the sign-in page is worse than a missing one. Left out on
 * purpose: LoanTooling (empty repo), testing-pipetooling (a test copy), and
 * ChecklistTooling + SVGTooling (no GitHub Pages site published as of 2026-09-19).
 * Re-check with `curl -sI <url>` before adding one back.
 */
export type ToolingApp = {
  key: string
  name: string
  blurb: string
  href: string
  /** The app's mark — a path under public/, never cross-origin. */
  icon: string
}

export const FEATURED_APPS: readonly ToolingApp[] = [
  {
    key: 'count',
    name: 'CountTooling',
    blurb: 'Plans count and measure',
    href: 'https://counttooling.com/',
    icon: '/tooling/counttooling.svg',
  },
  {
    key: 'takeoff',
    name: 'Takeoff Tooling',
    blurb: 'Electrical bid pricing',
    href: 'https://takeofftooling.com/',
    icon: '/tooling/takeofftooling.svg',
  },
]

export const MORE_APPS: readonly ToolingApp[] = [
  {
    key: 'bid',
    name: 'BidTooling',
    blurb: 'Plumbing bid worksheet',
    href: 'https://bidtooling.com/',
    icon: '/tooling/bidtooling.svg',
  },
  {
    key: 'plumbing',
    name: 'Plumbing Tooling',
    blurb: 'Liquid and gas test reports',
    href: 'https://plumbingtooling.com/',
    icon: '/tooling/plumbingtooling.svg',
  },
  {
    key: 'lien',
    name: 'LienTooling',
    blurb: 'Liens and releases',
    href: 'https://lientooling.com/',
    icon: '/tooling/lientooling.svg',
  },
  {
    key: 'paper',
    name: 'PaperTooling',
    blurb: 'PDF stripper',
    href: 'https://papertooling.com/',
    icon: '/tooling/papertooling.svg',
  },
  {
    key: 'pay',
    name: 'PayTooling',
    blurb: 'Contractor pay stubs',
    href: 'https://paytooling.com/',
    icon: '/tooling/paytooling.svg',
  },
  {
    key: 'sub',
    name: 'SubTooling',
    blurb: 'Job value calculator for subs',
    href: 'https://subtooling.com/',
    icon: '/tooling/subtooling.svg',
  },
  {
    key: 'sign',
    name: 'SignTooling',
    blurb: 'Contract signing portal',
    href: 'https://signtooling.com/',
    icon: '/tooling/signtooling.svg',
  },
  {
    key: 'sync',
    name: 'SyncTooling',
    blurb: 'Project management',
    href: 'https://synctooling.com/',
    icon: '/tooling/synctooling.svg',
  },
  {
    key: 'connect',
    name: 'ConnectTooling',
    blurb: 'Team communication',
    href: 'https://connecttooling.com/',
    icon: '/tooling/connecttooling.svg',
  },
  {
    key: 'gov',
    name: 'GovTooling',
    blurb: 'Certified payroll',
    href: 'https://govtooling.com/',
    icon: '/tooling/govtooling.svg',
  },
]
