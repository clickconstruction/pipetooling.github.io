import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5103',
  date: '2026-10-09',
  title: 'Workflow: a projection that will not delete says why',
  kind: 'fix',
  roles: ['dev', 'master_technician'],
  highlights: [
    'On a project’s Workflow page, deleting a projection that the database refuses now shows the refusal, for example “Failed to delete projection: permission denied”. Before, nothing was said and the projection simply stayed in the list.',
    'The message works like a refused save’s: it takes the place of the page until you reload.',
  ],
}

export default note
