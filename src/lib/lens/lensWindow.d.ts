/**
 * The sealed lens frame's state on `window` (punch list #194; `seal.ts` sets it, `hardReload.ts` and
 * What everyone sees read it).
 *
 * It is declared here, in a declaration file, and not inside `seal.ts`: the type check runs `src` as three
 * programs (scripts/lib/typecheckParts.mjs), and a `declare global` inside a module reaches only the programs
 * that happen to import that module. Every declaration file under `src` is a root file of every part, so a
 * name declared here is known wherever it is read.
 */
import type { LensFrameState } from './seal'

declare global {
  interface Window {
    __lens?: LensFrameState
  }
}
