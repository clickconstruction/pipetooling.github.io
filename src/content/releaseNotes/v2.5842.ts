import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5842',
  date: '2026-10-25',
  title: 'Legal Timeline: the lien clock’s deadlines on the line',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Timeline tab now draws the lien clock’s deadlines for every job in the account, read only, each a diamond on its statutory day: each § 53.056 month, the § 53.057 retainage notice, the affidavit and the suit. Each reads its state in plain words, and Record it… opens the job’s Lien window. The firm sees the same deadlines on its portal.',
    'Plan a step gains Serves the deadline. The step then names its deadline on the line, and reads “after the deadline” in red when its day falls past it.',
    'A weekend deadline is the following Monday, as the clock has always rolled it; there is no separate mail-by day.',
  ],
}

export default note
