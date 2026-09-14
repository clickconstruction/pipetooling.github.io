import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3405',
  date: '2026-09-14',
  title: 'The Lien desk: notices due per unpaid work month, drafted by the office, approved by the leader',
  kind: 'feature',
  highlights: [
    'Texas counts lien deadlines from the month the work was done. The new Lien desk lists every unpaid work month on a job with a GC whose § 53.056 notice closes within 30 days — one line per job, the months it would name, the dollars open, and the deadline in red inside a week.',
    'Open it from the Dashboard’s Needs you card, the ⏱ Lien desk button beside Legal on the Collections header, the Pipeline’s tools menus, or a forecast row’s Send notice…. Jobs with no owner of record on file sit in their own pile with a Find the owner door, so an unmailable notice never reaches the leader.',
    'The office drafts and sends for approval; the master approves or holds (they promised, or I’ll call first), and can set a standing rule per GC so routine notices stop asking. The office can also record the leader’s spoken word — who, when, by phone or in person — and the leader sees those sends in his own list with a pull-back.',
    'Approved notices go out from the Lien window’s notice tab, which now records every month the desk named — not just the last month worked — so the forecast’s per-month state and the Dashboard agree.',
  ],
}

export default note
