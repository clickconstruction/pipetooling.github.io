import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3542',
  date: '2026-09-16',
  title: 'People → Day book: what the office got done, any day you look back at',
  kind: 'feature',
  highlights: [
    'A new People view lists each office person’s day from the records the app already keeps: bills marked, deposits applied, contracts sent and filed, clock sessions approved, jobs moved, dispatch requests answered. Nothing to type.',
    'Step the range a week at a time, narrow to a kind of outcome, and (for payroll viewers) pick a person. The link carries the range and person, so a week can be shared.',
    'A day with clock time and nothing on the record says so plainly — calls, texts and outside email leave no record here — and shows the clock-out note when one was left.',
    'Amounts follow the payroll gate. Everyone else sees their own days with counts and job numbers only.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
