import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2429',
  date: '2026-08-28',
  title: 'Twin seats for outside agents',
  kind: 'infra',
  highlights: [
    'Each digital twin can now carry its own login token — a partner\'s agent (any provider) gets one twin\'s seat, revocable on its own, without ever holding the fleet-wide secret.',
    'Twin sign-ins are rate-limited (6/minute per twin), and every mint records which credential it came from.',
    'New docs/twins/TWIN_HARNESS.md: the hand-to-a-partner onboarding kit — auth, rules of engagement, safety rungs, and the operator runbook.',
  ],
}

export default note
