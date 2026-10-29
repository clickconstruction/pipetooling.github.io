import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6073',
  date: '2026-10-29',
  title: 'Where files go: Check a job’s folder finds a paid job, and Drive’s refusal reads with one period',
  kind: 'fix',
  highlights: [
    'On Documents → Where files go, Check a job’s folder now looks a job up among every job when the live list holds no match, so a paid job can have its folder checked by its number.',
    'Drive’s own reason in a refusal ended with a period and the sentence added one. It reads with one now.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
