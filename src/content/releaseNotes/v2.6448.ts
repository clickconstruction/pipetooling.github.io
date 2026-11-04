import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6448',
  date: '2026-11-03',
  title: 'A job carries its own charging rule on its Edit tab',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'In the job window’s Edit tab the last row reads Charging the customer: how this job’s labor is charged, as the crew on each day from the rate card, one shape throughout at its rate, or a flat rate, and the job’s own markup on materials, with the company’s figures named when the job has none.',
    'The row saves as you pick. It writes the same facts the Job Summary’s Charges window writes, so a choice made in either shows in both and on every Statement of charges and charged hours paper.',
    'The app directory and the glossary now name every charges surface: the rate card, the Charges window, the charged hours paper, the Statement of charges and this row.',
  ],
}

export default note
