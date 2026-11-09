import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6773',
  date: '2026-11-09',
  title: 'Settings → Flows: the Billed step’s sample reads the bill text with its pay link',
  kind: 'fix',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Under the Billed step’s Asks switch, the sample text now reads the new bill line, filled for the sample homeowner with a sample amount and pay link, so what the Pipeline move offers is what the switch shows.',
    'The Done line still says the bill follows by email. Whether it should say by text and email is the owner’s call.',
  ],
}

export default note
