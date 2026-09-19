/**
 * The Tooling family (v2.3622 / v2.3624): every sibling app the sign-in strip links to.
 *
 * `featured` are the two tiles with marks (the apps an estimator moves between mid-bid);
 * `more` sit under the "More apps" disclosure. Only apps with a LIVE public URL belong
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
  /** Path under public/ — only the featured tiles carry a mark. */
  icon?: string
}

export const FEATURED_APPS: readonly ToolingApp[] = [
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
]

export const MORE_APPS: readonly ToolingApp[] = [
  {
    key: 'bid',
    name: 'BidTooling',
    blurb: 'Plumbing bid worksheet',
    href: 'https://bidtooling.com/',
  },
  {
    key: 'plumbing',
    name: 'Plumbing Tooling',
    blurb: 'Hydrostatic and gas test reports',
    href: 'https://plumbingtooling.com/',
  },
  {
    key: 'lien',
    name: 'LienTooling',
    blurb: "Mechanic's liens and releases",
    href: 'https://lientooling.com/',
  },
  {
    key: 'paper',
    name: 'PaperTooling',
    blurb: 'Select, compress and download PDFs',
    href: 'https://papertooling.com/',
  },
  {
    key: 'pay',
    name: 'PayTooling',
    blurb: 'Contractor pay stubs',
    href: 'https://paytooling.com/',
  },
  {
    key: 'sub',
    name: 'SubTooling',
    blurb: 'Job value calculator for subs',
    href: 'https://subtooling.com/',
  },
  {
    key: 'sign',
    name: 'SignTooling',
    blurb: 'Contract signing portal',
    href: 'https://signtooling.com/',
  },
  {
    key: 'sync',
    name: 'SyncTooling',
    blurb: 'Project management',
    href: 'https://synctooling.com/',
  },
  {
    key: 'connect',
    name: 'ConnectTooling',
    blurb: 'Team communication',
    href: 'https://connecttooling.com/',
  },
  {
    key: 'gov',
    name: 'GovTooling',
    blurb: 'Certified payroll and government forms',
    href: 'https://govtooling.com/',
  },
]
