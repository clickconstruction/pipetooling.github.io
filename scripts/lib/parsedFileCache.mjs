/**
 * Parsed source files, held up to a bound.
 *
 * A check that parses src with the TypeScript compiler and keeps every file's tree holds about
 * 25 bytes of heap for each character of source, and src is 80 MB of it: `check:font-shorthand`
 * ended at 2 GB of heap and `check:window-z` at 1.1 GB (v2.8671), each past or near Node's default.
 * This holds the trees read last, up to `keepChars` of source, and a file let go is parsed again
 * when a later read needs it.
 *
 *   read(key, load)  the held value, or `load()`'s — which returns `{ value, chars }`
 *   letGo()          drops the oldest past the bound
 *
 * Call `letGo()` only where no tree is in hand, between two files of the check's own loop: a walk
 * that compares nodes, or holds one while it reads another file, needs its files whole until it ends.
 */
export function parsedFileCache(keepChars = 4_000_000) {
  const held = new Map()
  let chars = 0
  return {
    read(key, load) {
      let entry = held.get(key)
      if (entry) held.delete(key)
      else {
        entry = load()
        chars += entry.chars
      }
      held.set(key, entry)
      return entry.value
    },
    letGo() {
      for (const [key, entry] of held) {
        if (chars <= keepChars) break
        held.delete(key)
        chars -= entry.chars
      }
    },
    /** Characters of source held now. */
    get chars() {
      return chars
    },
  }
}
