import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8244',
  date: '2026-11-21',
  title: 'Agreements: a line says which company its paper names',
  kind: 'fix',
  highlights: [
    'When someone is added to a list under a second company, their paper still names the first one.',
    'The line now says so: it reads signing for and the company the paper names.',
    'This shows on the Agreements tab and on a customer’s or a supply house’s own list of papers.',
  ],
}

export default note
