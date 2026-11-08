import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6701',
  date: '2026-11-08',
  title: 'The trade portal’s job page has a Directions link beside the address',
  kind: 'feature',
  highlights: [
    'On a trade partner’s portal, a project’s page now shows a Directions link beside the job’s address. It opens the address in the phone’s maps app, so a sub no longer types the address in.',
    'Nothing else of a map was added: no map canvas and no weather, as the owner decided on punch list #205.',
  ],
}

export default note
