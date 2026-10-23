import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5752',
  date: '2026-10-22',
  title: 'Robots: the rounds run on their own, with no Claude session open and no question asked',
  kind: 'feature',
  highlights: [
    'Set up on this Mac with This Mac makes the rounds ticked now installs the rounds on that Mac itself. One Terminal paste, and a round runs every five minutes from your Library folder, whether Claude is open or not. Nothing asks you to allow anything.',
    'The command gets Claude Code ready first. If it is not signed in on that Mac, a browser window opens once. It also says when the Mac is set to sleep, since rounds stop while it sleeps.',
    'The Rounds card on the Console reads Alive within a minute of the paste. Stop the rounds works as before. Copy the round on the Run the robots card makes one round by hand in a Code session.',
    'A Mac set up before this change still holds a routine named Robot rounds in Claude Code. Delete it there, or two rounds run at once.',
  ],
}

export default note
