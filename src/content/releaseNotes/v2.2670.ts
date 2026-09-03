import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2670',
  date: '2026-09-03',
  title: 'Salaried schedule time now approves itself',
  kind: 'feature',
  highlights: [
    'Clock sessions the system creates from a salary schedule no longer wait on a human — they approve automatically about every half hour once they close, so salaried time stops piling up in the approvals queue.',
    'Real punches are untouched: only schedule-generated sessions auto-approve, and anything you edit afterward still re-syncs the person’s hours the way it always has.',
    'Payroll, the Hours grid, and the Overhead numbers stay current even when nobody has had time to work the approvals list.',
  ],
}

export default note
