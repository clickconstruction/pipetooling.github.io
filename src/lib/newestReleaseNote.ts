/**
 * The newest release note among file names like "v2.7720.ts", by number (punch list #380).
 *
 * The build reads it into `virtual:app-version` (vite.config.ts), so a tab knows its own version
 * without loading the notes. No imports: the build config runs it in Node.
 */
const NOTE_FILE_RE = /^(v2\.(\d+))\.ts$/

export function newestReleaseNoteVersion(fileNames: readonly string[]): string | null {
  let newest: { number: number; version: string } | null = null
  for (const name of fileNames) {
    const match = NOTE_FILE_RE.exec(name)
    if (!match) continue
    const number = Number(match[2])
    if (!newest || number > newest.number) newest = { number, version: match[1]! }
  }
  return newest?.version ?? null
}
