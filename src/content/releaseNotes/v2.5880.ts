import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5880',
  date: '2026-10-26',
  title: 'Groundwork for the Bridge’s weekly sheet: the reads take the client',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. Every read the Monday sheet needs can now run outside the browser, so the sheet can be built and mailed on a schedule in the next release.',
  ],
}

export default note
