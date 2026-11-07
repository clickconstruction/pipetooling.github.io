import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6603',
  date: '2026-11-06',
  title: 'Your people’s week: one Monday email about the people you pick',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Checklist → Review has ✉ Email me their week, and the Dashboard’s Your people card has ✉ Get this every Monday. Pick the people, the days and the time, press Start it, and one email comes each week about the week just finished.',
    'For each person: the cards that finished or moved with the percent from and to, the Done when… lines ticked, the photos taken, their last What is left? words, their roadmap tasks with the stage, the jobs they clocked on with the job’s percent and their reports, and any card stuck past a month.',
    'See the email as it would go now and Email me a test, as the other Monday emails have. Settings → My email schedule and Email streams show it beside them, and What the team sees draws a sample.',
  ],
}

export default note
