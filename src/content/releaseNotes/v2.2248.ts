import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2248',
  date: '2026-08-24',
  title: 'Pay speeds stop counting unverified same-day imports',
  kind: 'fix',
  highlights: [
    'Imported payments that claim to have arrived the day the bill went out — with no bank, Stripe, or HCP-report date backing them up — no longer count toward pay speeds or receipts.',
    'Genuinely instant payments still count: bank-dated, Stripe, and app-recorded same-day payments are untouched.',
    'Medians read a touch slower and a lot truer; per-customer speeds are where the follow-up decisions live.',
  ],
}

export default note
