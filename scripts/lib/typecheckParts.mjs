/**
 * The parts `npm run typecheck` checks `src` in, one tsc after the other, and the words it says about them.
 * Plain JS with no dependencies: scripts/typecheck-queued.mjs and scripts/tsc-build.mjs run it on bare Node,
 * and src/lib/typecheckParts.test.ts pins it.
 *
 * Why parts (punch list #434). One tsc over all of `src` needed 12.3 GB of heap on 2026-11-24 and grew about
 * 190 MB a day, and a GitHub runner can give about 13.3 GB. A program is its `include` list and everything
 * that list imports, so the same files checked as three programs by plain `include` lists, with no project
 * references, need 8.1, 6.5 and 8.6 GB. App code that tests import is checked again in the test programs:
 * that costs time and not correctness. `tsconfig.json` stays the whole program, for editors.
 *
 * Every `.ts` and `.tsx` file under `src` is a root file of at least one part; the test holds that against
 * `tsconfig.json`'s own list, so a new folder cannot fall outside the check.
 */

/** In the order they run. `name` is the handle in the words, `config` the tsconfig at the repo root. */
export const PARTS = [
  { name: 'app', config: 'tsconfig.app.json', what: 'src without its tests' },
  { name: 'tests-lib', config: 'tsconfig.tests-lib.json', what: 'the tests under src/lib and what they import' },
  { name: 'tests-rest', config: 'tsconfig.tests-rest.json', what: 'the tests outside src/lib and what they import' },
]

/** The part the build's `tsc -b` checks: the tests do not ship, and the merge queue has checked them. */
export const BUILD_PART = PARTS[0]

/** The line before a part runs. */
export function partWords({ index, part, total = PARTS.length }) {
  return `typecheck: part ${index + 1} of ${total}, ${part.what} (${part.config}).`
}

/** The wrapper's exit code: the worst part's. 0 only when every part answered clean. */
export function worstExit(codes) {
  if (!codes.length) return 1
  return codes.reduce((worst, code) => Math.max(worst, Number.isFinite(code) ? code : 1), 0)
}

/** True when a part's exit says a person or the machine stopped the run (SIGINT, SIGTERM), so no later part starts. */
export function stoppedByHand(code) {
  return code === 130 || code === 143
}

/** A tsc exit of 0, 1 or 2 is an answer; anything else (a signal's 128 + n) is no verdict. */
function answered(code) {
  return code === 0 || code === 1 || code === 2
}

/**
 * The last line of a run. `results` is `[{ part, code }]` for the parts that ran, in order.
 * It names each part that had errors and each that gave no verdict, and says so when a part never ran.
 */
export function outcomeWords(results, total = PARTS.length) {
  const clean = results.filter((r) => r.code === 0)
  const errors = results.filter((r) => r.code !== 0 && answered(r.code))
  const dead = results.filter((r) => !answered(r.code))
  const notRun = total - results.length
  if (clean.length === total) return `typecheck: all ${total} parts are clean.`
  const pieces = [`typecheck: ${clean.length} of ${total} parts clean`]
  if (errors.length) pieces.push(`with errors: ${errors.map((r) => r.part.name).join(', ')}`)
  if (dead.length) pieces.push(`NO VERDICT: ${dead.map((r) => `${r.part.name} (exit ${r.code})`).join(', ')}`)
  if (notRun) pieces.push(`not run: ${notRun}`)
  return `${pieces.join('; ')}.`
}
