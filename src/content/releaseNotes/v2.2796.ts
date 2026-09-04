import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2796',
  date: '2026-09-04',
  title: 'Audits: "Robot still working" instead of draft $0',
  kind: 'fix',
  highlights: [
    'A robot audit whose counts never reached the bid\'s Counts tab now shows as "Robot still working · no counts in PipeTooling yet" instead of "draft $0 · −100% vs ours". Seven cards read that way on 4 Sep and one drew a note aimed at a bid that was never $0.',
    'Those audits no longer count in the Audits tab badge or the Dashboard\'s "robot bids waiting on your audit" item, and the tab opens the first real one instead.',
    'Shadow bids opened before the pairing stamp existed now seal correctly — the tab finds their reference on the shadow run, so a live, unsent bid can\'t be audited in the open again.',
    'The tab pages its count-row load, so a growing audit queue can\'t silently truncate at 1,000 rows and price the newest audits wrong.',
  ],
}

export default note
