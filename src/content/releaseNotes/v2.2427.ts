import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2427',
  date: '2026-08-28',
  title: 'Cloud twins can sign in — estimator-only',
  kind: 'infra',
  highlights: [
    'New twin-login edge function: a cloud-hosted digital twin gets a short-lived magic-link session on the deployed app — no passwords anywhere, and rotating its secret signs out the whole fleet.',
    'Hard-scoped by design: it only mints sessions for flagged twin accounts with the estimator role — a leaked secret can never sign in as a real person.',
  ],
}

export default note
