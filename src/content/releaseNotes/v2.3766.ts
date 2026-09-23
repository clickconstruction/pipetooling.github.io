import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3766',
  date: '2026-09-23',
  title: 'A job made from an estimate is named for the work too',
  kind: 'feature',
  highlights: [
    'A second job at the same house needs the work in its name, the way the office writes them by hand — “Montolongo- Pretest”, “Pool Work”. When an estimate has one line and that line names the work, the job is seeded “Kimberly Coe — Pretest” instead of the customer’s name alone.',
    'Several lines, or a generic line like “Custom Service Visit”, still give the customer’s name; a heading you typed is still kept, and the Job name box stays yours to edit. Create jobs automatically follows the same rule.',
    'Existing jobs named with only the customer’s name can be renamed the same way from their own Specific Work line — a dry run lists every job and the name it would get before anything changes.',
  ],
}

export default note
