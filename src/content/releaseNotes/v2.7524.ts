import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7524',
  date: '2026-11-16',
  title: 'Liens: add several stamped scans at once, one file a lien (punch list #366)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A new window, Add the stamped scans, takes every scanned affidavit in one sitting. Pick all the files at once and each one is matched to its filed lien.',
    'A file named with its recording number or its job number finds its lien. Any other file takes the next lien in the list, and a line under it says to check it against the stamp.',
    'One press saves them. Each scan goes to its own job’s Drive folder, under Sent by us, and becomes that filing’s saved copy. A file with no lien, or a second file for one lien, stays in the window with its reason.',
    'Open it from the line under Upload the scanned PDF on Record filing, or from Filed liens: copies to mail.',
  ],
}

export default note
