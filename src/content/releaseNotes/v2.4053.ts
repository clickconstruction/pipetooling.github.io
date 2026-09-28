import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4053',
  date: '2026-09-28',
  title: 'Customer portal: Your payments — where each check went',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Under the statement, a GC’s bookkeeper now finds every check they sent us, where it sits now — one line per job and bill — and any move since it was recorded. Look one up by its number, its amount or the day it reached us.',
    'Each bill’s payment line on the portal now carries the check number: "paid $12,000.00 by check #48211 on Sep 24".',
    'Only their own money reaches the page: a bill someone else pays on the same job, and any payment that could name it, is left out before the page is built.',
  ],
}

export default note
