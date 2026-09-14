import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3419',
  date: '2026-09-14',
  title: 'Pipeline: the Progress & payment bar says where the job is',
  kind: 'feature',
  highlights: [
    'Every row on Jobs → Pipeline draws one bar with two channels: the top is the work (how far along), the thin bottom edge is the money — green paid, blue billed, amber done-but-not-billed — poured across the job in order. The yellow dot is gone.',
    'A job with stages (set as Order, or recognized from Rough In · Top Out · Trim Set) shows its stages as the segments, and the live stage is where the crew actually is: what the payments cover is done, and the crew’s last clock-in lands on the next stage — no percent needs typing. A job with one line shows that line; a job with several shows each.',
    'Under the bar, one line of words: the stage, who was on site and when (“Behar & Malachi on site Sat”), the percent and where it came from (“40% typed Aug 7”, “12% reported Sep 11”), and the money (“$24,359 paid, nothing billed”). A percent older than the last clock-in shows its date instead of being drawn. A job with no lines and a crew on site reads in red.',
  ],
}

export default note
