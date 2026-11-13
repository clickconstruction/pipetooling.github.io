import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7154',
  date: '2026-11-13',
  title: 'An agent on the dev seat can file a bid’s sent paper from Drive and link it',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now put the paper that was sent for a bid into the bid’s project folder in Drive, under Team only, Sent by us, and set the bid’s Submission link to it. The Bid Board opens it from the bid as it opens a pasted link.',
    'When the bid has no project folder yet, the agent makes it first, the way Make the project folder does on the bid’s Files window.',
    'A bid that already has a Submission link keeps it unless the agent says it is replacing it. Before anything changes the agent reads a plan in words: the file, where it lands, the link now and the link after.',
    'The agent can also list a Drive folder and read one file’s facts: its size, when it changed, who owns it and who it is shared with. It reads only, and changes nothing in Drive.',
  ],
}

export default note
