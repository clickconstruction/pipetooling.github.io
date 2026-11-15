import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7273',
  date: '2026-11-14',
  title: 'The Dashboard’s closed-window lien card knows a late notice',
  kind: 'fix',
  highlights: [
    'A notice window that closed with nothing sent no longer reads as a lien gone while the job’s affidavit can still be filed. The Dashboard’s lien card says send the late notice by that day, amber and red inside a week, and keeps the gone words for a window whose affidavit day has passed too.',
    'The Pipeline’s Today’s Money lien card reads the same way: a closed window with the affidavit’s day ahead says send the late notice by that day instead of closed for good.',
    'Both lines open the Lien desk’s Missed lens, where the late notice is drafted. The desk’s own Missed pile and By date view are unchanged.',
  ],
}

export default note
