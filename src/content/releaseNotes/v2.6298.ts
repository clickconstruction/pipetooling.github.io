import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6298',
  date: '2026-11-01',
  title: 'Plans in the job window’s Documents tab: what the job builds from, older sets and our as-builts',
  kind: 'feature',
  highlights: [
    'Open a job, press Documents, and the Plans section names the set the job builds from today, with the older sets under it and the crew’s as-builts.',
    'Press + New set when an updated set comes in. Add it and build from it, or add it and keep the old one current. Open plans on the Job tab follows the switch.',
    'Press Add our as-built to keep the crew’s marked-up drawings with the job. The line says which set it marks up.',
    'A job inside a development says when another part of the site carries a set, with a door to the site’s plans.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
