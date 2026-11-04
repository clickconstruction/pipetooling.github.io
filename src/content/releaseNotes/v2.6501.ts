import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6501',
  date: '2026-11-04',
  title: 'A person with no login holds their own days and Charged as, so a job prices every day its crew was out',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A person who worked a job without a login can now hold days from the pay records and a Charged as on their People record. Until now a day belonged to a login, so such a person could hold no day and no standing, and the job priced short.',
    'Who counts as what lists them in a group of their own, People with no login, with the same four choices; the person’s desk shows the same row under Access. A record linked to a login reads the login’s Charged as.',
    'A dev puts the days in from the pay records, and the people who approve hours approve them. The Charges window, the Statement of charges, the charged hours paper and the Job Summary price those days beside the clock’s, each marked from the pay records. Pay never reads them.',
    'When such a person counts as nobody yet, the office’s screens name them with the door to their People record instead of asking for a login.',
  ],
}

export default note
