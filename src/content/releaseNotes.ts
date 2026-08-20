import { releaseNoteVersionNumber, type ReleaseNote } from '../lib/releaseNotes'
import { RELEASE_NOTES_ARCHIVE } from './releaseNotesArchive'

/**
 * In-app release notes (Settings → Release notes), newest first.
 *
 * One entry per PR, but each entry lives in its OWN file so parallel PRs never
 * conflict here: add src/content/releaseNotes/v2.NNNN.ts default-exporting a
 * ReleaseNote with the SAME v2.NNNN you claimed via `npm run claim` (and the
 * same version as your docs/recent-features/v2.NNNN.md entry —
 * src/lib/releaseNotes.test.ts fails CI when they diverge). Never edit this
 * file or releaseNotesArchive.ts to add an entry.
 */
const fragmentModules = import.meta.glob('./releaseNotes/*.ts', {
  import: 'default',
  eager: true,
}) as Record<string, ReleaseNote>

/** Fragment filename (e.g. "v2.1898.ts") → its note; exported for the drift test. */
export const RELEASE_NOTE_FRAGMENTS: Array<{ file: string; note: ReleaseNote }> = Object.entries(fragmentModules)
  .map(([path, note]) => ({ file: path.replace(/^.*\//, ''), note }))
  .sort((a, b) => (releaseNoteVersionNumber(b.note.version) ?? 0) - (releaseNoteVersionNumber(a.note.version) ?? 0))

export const RELEASE_NOTES: ReleaseNote[] = [
  ...RELEASE_NOTE_FRAGMENTS.map((f) => f.note),
  ...RELEASE_NOTES_ARCHIVE,
]
