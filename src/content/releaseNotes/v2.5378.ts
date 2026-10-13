import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5378',
  date: '2026-10-12',
  title: 'The robots’ server passes its own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server the robot estimators work through is checked cleanly by the server’s own type checker.',
    'When a robot claims its next backtest, the reply lists the same facts, with “ok” second instead of first. Nothing else it does changes.',
  ],
}

export default note
