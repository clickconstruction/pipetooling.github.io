import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4285',
  date: '2026-10-01',
  title: 'Lien waivers: one signature block, signed by the leader of record',
  kind: 'fix',
  highlights: [
    'The foot of every lien waiver is one signature block now: the signature above a rule, then “Malachi Whites, Click Plumbing and Electrical”, his title, and the day he signed. The Date / Contractor / By / Title lines are gone.',
    'By always names the leader who signs, never the person at the keyboard. His name and title come from one new line under Settings → Jobs & billing → Physical invoice, “Signs for the company”, and he is the leader the Release of Lien window opens on.',
    'The grey line under the signature reads as a sentence — “Drawn by Malachi Whites in ClickTooling on Sep 30, 2026 at 9:19 PM CT, on Robert’s screen, consent recorded.” — with the two statutes on their own line beneath.',
    'When the signer of record is not the person signed in, the pad only draws, whichever door opened it. A typed name is refused with the reason on screen.',
  ],
}

export default note
