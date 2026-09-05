import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2824',
  date: '2026-09-05',
  title: 'Team feedback on the three bars',
  kind: 'feature',
  highlights: [
    'The clock-out feedback prompt is now a short deck: one card per teammate you shared jobs with this cycle, then your lead. Each card is the same Ability, Drive, and Integrity sliders the office uses, with an optional note under each.',
    'A last card takes anything you want to say in your own words. The ten agree-or-disagree questions are retired; the dev Feedback tab keeps their wording under Retired questions.',
    'Crew ratings are anonymous to everyone but dev. The office sees only averages, and only once two people have rated someone.',
    'People → Feedback now shows each person\'s crew ratings beside the office\'s, flags where the two disagree, lists the open words, and holds the settings. Try the deck yourself from there before turning it on.',
  ],
}

export default note
