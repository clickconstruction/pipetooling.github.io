/**
 * Build every form Click authors itself (PDF + matching schema) into
 * docs/forms/authored/. Deterministic from source; commit the outputs so the
 * exact PDF a person signed can always be re-created from the repo.
 *
 *   npm run forms:author
 */
import { mkdirSync } from 'node:fs'
import { OUT_DIR } from './company'
import { buildDirectDeposit } from './directDeposit'
import { buildLienWaivers } from './lienWaivers'

mkdirSync(OUT_DIR, { recursive: true })
await buildDirectDeposit()
await buildLienWaivers()
