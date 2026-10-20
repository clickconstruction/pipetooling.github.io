import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5353',
  date: '2026-10-12',
  title: 'Messages: a Pipeline job’s calls, texts and emails can be found by the job',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen yet. The database can now find the calls, texts and emails tied to one Pipeline job quickly.',
    'It can also find the people put on a job, so their lines not tied to a job yet can show there too.',
    'Job activity on Jobs → Pipeline reads both next.',
  ],
}

export default note
