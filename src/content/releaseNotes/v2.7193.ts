import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7193',
  date: '2026-11-13',
  title: 'Liens: a last day of work set by hand is the day every lien date counts from',
  kind: 'fix',
  highlights: [
    'When a job’s last day of work is set by hand and hours are approved after that day, the day set by hand counts. The Lien window and the Lien desk used to count from the later hours, while the billed row counted from the day set by hand, so one job read Lien gone on its row and File the affidavit in its window.',
    'The Lien window now says so where it shows the last day: last day set by hand, later hours do not move it. Press change under Last work to set a later day or go back to the clock hours.',
    'This changes the period and the months a lien affidavit names on such a job: they now end with the day set by hand. The affidavit’s wording is the same. No paper already drafted or approved was redrawn. Worth counsel’s eye.',
    'The Lien desk’s lists follow after one database step the owner approves. Until then they keep the later month for such a job.',
  ],
}

export default note
