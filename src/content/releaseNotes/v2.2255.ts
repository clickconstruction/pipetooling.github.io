import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2255',
  date: '2026-08-24',
  title: 'HCP reconcile lives in Settings',
  kind: 'feature',
  highlights: [
    'Settings → Jobs & billing → HCP reconcile imports billing history straight from HouseCall Pro exports — bill dates, payment links, and true payment dates.',
    'Everything previews before anything writes, every skipped row says why, and re-running the same files finds nothing left to do.',
    'Bank- and Stripe-dated payments are never touched, open HCP invoices are never imported, and money is never added automatically.',
  ],
}

export default note
