import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3722',
  date: '2026-09-22',
  title: 'Dev MCP: a coding agent can move job cost and file an HR entry — plan first, then apply',
  kind: 'feature',
  highlights: [
    'A dev\'s coding agent, connected through a Dev MCP key, can now do the two things a database agent already could, through the same audited doors: move job cost as one revertible batch, and file an entry on a person\'s HR file with the dev named as the author.',
    'Every write starts as a dry run the agent has to read back: "plan" performs the change and undoes it, returning what would happen and a fingerprint. "Apply" runs the dry run again and writes only when it still says the same thing — if the rows changed in between, nothing is written and the agent is told to plan again. A cost batch can be reverted with a reason in words.',
    'Nothing else on the door writes: reads stay read-only, "view as" never writes, and training mode blocks the writes too. The guide "connect my coding agent to PipeTooling" says what the agent can and cannot change.',
  ],
}

export default note
