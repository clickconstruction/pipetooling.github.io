import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6343',
  date: '2026-11-02',
  title: 'Search every file deeply: the one-time backfill of our own file index, run by an agent',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A runner an agent session starts from a terminal walks every job’s and bid’s Drive folders through the same door the job window’s Index this job’s files presses, round after round per job until nothing remains, one job at a time, with a pause between calls. It signs in as the dev, so the same rules apply as in the app.',
    'It walks the ZZ test jobs first as the dry run, then the live jobs oldest number first, then the bids newest first, then the Paid in Full jobs. A run that stops loses nothing: every file’s row is written as it goes, a resume file marks the jobs done, and a second run skips them and every file already current.',
    'The terminal and the punch list card get counts alone: files indexed, files with text, files with none and why (a scan, a kind the index does not read, too big, slow, failed), and the folders the app could not open. File names stay in a log on the computer that ran it, never in the repo.',
    'After the backfill the ten-minute sweep keeps the index current; how new files are indexed from then on is the owner’s choice, written up in the card.',
  ],
}

export default note
