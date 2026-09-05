import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2858',
  date: '2026-09-05',
  title: 'Hours approvals: assistants approve, the clock-strip pill asks first, one pay week everywhere',
  kind: 'fix',
  highlights: [
    'Quickfill → People Hours no longer says assistants "do not approve" — they do, and every approve button on the page has always worked for them. The line now says what happens: every approve adds to payroll.',
    'The tiny approve pill on the clock strip (Dashboard, People → Hours, Quickfill) now asks "Approve this session?" before writing — it was the only one-click payroll write in the app. Long-press for Session actions is unchanged.',
    'Moneyfill\'s "Sessions pending approval" now reviews the same Sunday–Saturday pay week Draft Payroll opens to (it used Monday–Sunday, so it could read all clear with pending sessions left). The Hours banner adds "+N sessions in earlier weeks" as a link to the all-weeks queue when the week on screen isn\'t the whole backlog.',
    'Review & approve and the approvals queue mark salaried people ("salary — counts as flat hours") and sessions the system closed at 11:59 PM ("still clocked in at midnight") so a runaway day gets a look before it\'s approved.',
  ],
}

export default note
