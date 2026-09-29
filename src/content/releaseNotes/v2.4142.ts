import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4142',
  date: '2026-09-29',
  title: 'Settings → What the team sees: every email a user could get, as one person\'s week',
  kind: 'feature',
  highlights: [
    'A new dev tab beside What customers see lists all 25 emails the app sends someone on the team — the morning digests, the notices when money moves or a stage changes, the weekly reports, sign-in and invitations — in the order they land in an inbox, each with when it arrives, who gets it, the From line and the subject with sample values filled in.',
    'Pick a role, or a real person: with a person the tab reads the recipient lists on Emails & reports and shows what they actually get.',
    'Eleven rows open to the email itself, built on the sample company — the signed-agreement notice, the account man\'s ask, the bid-room and portal notices, the contract for signature, and the four template emails, which read the live wording on Email templates.',
    'Four digests (Crew day, Money waiting, Payment forecast, Billed awaiting) can show the real one as it would go out now, and email it to you. The other ten are marked next release and say which function builds them; a test now fails the build if a team email is added without a row here.',
  ],
}

export default note
