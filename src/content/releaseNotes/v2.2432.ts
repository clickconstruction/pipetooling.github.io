import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2432',
  date: '2026-08-28',
  title: 'Settings → Digital twins: the fleet console',
  kind: 'feature',
  highlights: [
    'A new dev Settings tab holds everything the twin program needs: mint an estimator twin in one click, flip its safety rung, issue and revoke per-twin tokens (shown once), and copy the sign-in and MCP endpoints to hand a partner.',
    'The recent-runs ledger shows every twin sign-in and mission report right in the panel.',
    'The master secret\'s value deliberately stays out of the app — rotation remains the command-line kill switch.',
  ],
}

export default note
