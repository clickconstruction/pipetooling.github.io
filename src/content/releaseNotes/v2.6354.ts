import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6354',
  date: '2026-11-02',
  title: 'The Pipeline search finds every job in a development, Paid in Full ones too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Type a development’s name in the search box on Jobs → Pipeline and every job in that development comes up, including the houses already paid in full and the ones in sections you had not opened.',
    'Before, the search only found such a job when the job’s own name or address held the development’s name.',
    'The job number, name, address and customer still match as they did, and the development name lights up on each row.',
  ],
}

export default note
