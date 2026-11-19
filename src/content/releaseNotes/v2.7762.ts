import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7762',
  date: '2026-11-18',
  title: 'Pipeline: a job with a legal matter shows where it stands with counsel',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Pipeline, a job whose account is on the Legal desk now wears a small scales chip beside its contract chip. It says review requested, or where the matter stands with the firm.',
    'The chip was built a while ago and never showed. It shows on the table rows and on the phone cards.',
    'A job with no legal matter, or one still being looked at in house, shows no chip.',
  ],
}

export default note
