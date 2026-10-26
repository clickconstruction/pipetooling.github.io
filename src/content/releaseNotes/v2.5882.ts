import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5882',
  date: '2026-10-26',
  title: 'Settings: Dev doors, every door only a dev or the controller can open, as one list of links',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Settings → System → Dev doors holds one card, Only devs and the controller see these: every page, window and switch that opens only to a dev, to a dev and the controller, or to the owner or a dev today.',
    'Each row is a link that lands on the door, with a chip beside it saying who may open it and one line of what it is. The card opens doors and changes no gate.',
    'The list is a kernel with a test: every link must be a route the app serves and every row must name a gate still in the code, so a row cannot go stale without the build saying so.',
    'The audit behind it, with a keep, widen or confirm recommendation per door for the owner, is punch list #188.',
  ],
}

export default note
