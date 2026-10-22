import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5736',
  date: '2026-10-22',
  title: 'Bids: a Plans button on every bid tab, and the plans answer first',
  kind: 'feature',
  highlights: [
    'Every bid tab has a Plans button beside the bid’s name. Press it and type a word or a question. The plans answer at once: which sheets hold the words, what the schedule row says, what the note says. Open sheet shows the page.',
    'The words come from the plan set itself. The robot writes them when it reads the set on a round, within minutes of the plans being filed. A set no robot has read is read once in your browser and saved for everyone.',
    'Under the box: the sheet index, every schedule as a table, and the general notes with the robot’s flag on each. The panel says what the plans say and where. It never gives a count of the robot’s own before you send.',
  ],
}

export default note
