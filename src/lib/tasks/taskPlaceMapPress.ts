/**
 * The words of the presses on a person's task map (v2.8032), for the screen alone.
 *
 * Kept out of `taskPlace.ts` on purpose: that kernel is copied to the edge (`npm run gen:edge-kernels`),
 * and a word a screen needs would change every function that reads the copy.
 */

/** The three states of the map's Show where I am press. */
export type TaskPlaceWhereIAmState = 'idle' | 'asking' | 'found'

/**
 * The map's Show where I am press. It is an icon, so its words are its name: what a screen reader
 * says and what a held press or a pointer shows. Asking wins over found, since a second press is
 * asking again.
 */
export function taskPlaceWhereIAmPress(input: { asking: boolean; found: boolean }): { state: TaskPlaceWhereIAmState; label: string } {
  if (input.asking) return { state: 'asking', label: 'Finding you…' }
  if (input.found) return { state: 'found', label: 'Find me again' }
  return { state: 'idle', label: 'Show where I am' }
}
