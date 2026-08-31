import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2522',
  date: '2026-08-30',
  title: 'pipetooling.com works again for returning visitors',
  kind: 'fix',
  highlights: [
    'Old bookmarks and home-screen installs pointing at pipetooling.com were showing a browser "site can\'t be reached" error instead of following the move to clicktooling.com — caused by the old offline cache stuck on the retired address.',
    'The old address now cleans up that stuck cache automatically on your next visit and forwards you to clicktooling.com. If you still see the error, reload the page once.',
  ],
}

export default note
