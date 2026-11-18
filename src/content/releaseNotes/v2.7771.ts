import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7771',
  date: '2026-11-18',
  title: 'Documents tab: a list that reads again after a window closes no longer finishes behind your back',
  kind: 'fix',
  highlights: [
    'Close an hours statement or a statement of charges, then close the job before the list has read again, and the late answer is now dropped.',
    'The same holds for the pay applications, the contract, the lien paper and the test reports on the Documents tab, for a review line after you save a call, for the permit names card after Try again and for the ticket press.',
    'Nothing on screen changes. Every list reads again and draws as before.',
    'This closes another way for the checks that run before each update to fail, the way painted maps once did.',
  ],
}

export default note
