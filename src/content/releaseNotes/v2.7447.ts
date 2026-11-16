import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7447',
  date: '2026-11-16',
  title: 'Liens: the last day of work can be set earlier than the clock hours',
  kind: 'fix',
  highlights: [
    'A last day of work set by hand can now be earlier than the clock hours. Before, the window refused it, so a day typed wrong could only be cleared or moved later.',
    'The window says the later hours stay as they are and do not move the day. It names each month with hours that leaves the lien clock.',
    'It asks for a second look, Set the day anyway, when the day is far from the hours, is before the first month with hours, drops a month a recorded notice or the affidavit names, or puts the affidavit’s last day in the past.',
    'A reason is still required. Clock hours and pay are not changed.',
  ],
}

export default note
