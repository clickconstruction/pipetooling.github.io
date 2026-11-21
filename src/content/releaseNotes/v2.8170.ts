import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8170',
  date: '2026-11-21',
  title: 'Lien desk: a missed notice that can still go late no longer says the lien right is gone',
  kind: 'fix',
  highlights: [
    'A notice window can close with nothing sent while the affidavit can still be filed. Months on this job then says a late notice can still go.',
    'The footer under it said the lien right on that work is gone, and offered no send. Both could not be true.',
    'The footer is now the draft footer there, with the send. Once the affidavit day has passed too, it says the lien right is gone, as before.',
    'A closed month on the timeline says the same when its stop is pressed, on the Lien desk and in the Lien window.',
  ],
}

export default note
