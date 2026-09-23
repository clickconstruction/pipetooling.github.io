import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3781',
  date: '2026-09-23',
  title: 'The lien timeline’s tail: the year to sue is watched, the Lien window shows the path, the Legal desk says when a lien dies',
  kind: 'feature',
  highlights: [
    'A fourth lien watch on the Dashboard: a filed, unreleased, unpaid lien whose year to sue ends inside 90 days gets a Needs You card — amber, red inside 30 days, and red with new words once the year has run — with the dollars behind it and a door to the Lien desk’s Timeline. Several jobs fold into one card.',
    'The Lien window (demand letter · notice · affidavit · release) opens with the job’s timeline under its name instead of two dates — the same strip the Lien desk draws, read from the job’s own hours and filings. A job with no clock hours is dated from the month it was created here too; it used to show no dates at all.',
    'The Legal desk’s lien clock — and the firm’s matter view and its print — gain a Suit by column, and a filed lien’s status now reads filed · served · suit in N days, with counsel named inside 90 days and “year to sue ran out” after.',
    'Nothing is typed and nothing new is stored. The 90-day lead is one number shared by the strip, the card and the Legal desk.',
  ],
}

export default note
