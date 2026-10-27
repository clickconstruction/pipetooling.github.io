import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5988',
  date: '2026-10-27',
  title: 'A sent estimate shows every option it offered',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'estimator', 'superintendent', 'dev'],
  highlights: [
    'A sent estimate with two or more options now draws What was offered: every option in the order you offered it, with its pitch, its lines and its total. Before, the page showed only the recommended option’s lines under Line items, so a second option could not be read after the send.',
    'The blocks stay on an expired, declined or replaced estimate, so what the second option said is never lost with the link.',
    'On an accepted estimate the document still shows what they took; under it, Every option as sent opens what they passed on, in full.',
  ],
}

export default note
