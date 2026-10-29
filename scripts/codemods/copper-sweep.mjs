#!/usr/bin/env node
/**
 * Copper sweep (punch list #199): the portal's copper moved from `#b0662f` to `#9a5b2b`, a step
 * darker along the same hue, so it reads 4.5:1 as words on every paper ground and with white words
 * on a button (`COPPER` in src/lib/portal/portalTheme.ts). Many files copy the value as a literal —
 * app surfaces, the two legal print packets, the Test report PDF's RGB triple, `src/index.css`, the
 * shared email builders — and this script moves every copy. Mechanical and re-runnable (rebase rule:
 * re-run this, never hand-resolve its diff).
 *
 * Two sets, because the email builders deploy by hand and ship in their own PR:
 *   default    the client set — every .ts/.tsx/.css/.mjs under src/ and scripts/ except EMAIL_ONLY below
 *   --emails   the email set — supabase/functions/_shared/ and EMAIL_ONLY (the pinned signing email
 *              and the two tests that read the email builders), which move with the builders
 *   --all      both
 *   --check    list what still carries the old copper in the chosen set, write nothing, exit 1 if any
 * Paths given on the command line replace the set.
 *
 * Left alone on purpose: scripts/cloudflare/portal-link-shell.worker.js, a Worker whose copy lives
 * in the Cloudflare dashboard (CLAUDE.md → Deploy model), so a change there is made in both by hand.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const OLD_HEX = /#b0662f\b/gi
const NEW_HEX = '#9a5b2b'
const OLD_RGB = /\b176, 102, 47\b/g
const NEW_RGB = '154, 91, 43'

/** Files that copy the copper from the email builders, so they move with them (the --emails set). */
const EMAIL_ONLY = ['src/lib/contractSigningSend.pin.json', 'src/lib/contractSigningEmail.test.ts', 'src/lib/jobsDocuments/gcStatementEmailParity.test.ts']
const LEFT_ALONE = ['scripts/cloudflare/portal-link-shell.worker.js']

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const EMAILS = args.includes('--emails')
const ALL = args.includes('--all')
const given = args.filter((a) => !a.startsWith('--'))

/** Every tracked file under the given folders with one of the extensions (a git pathspec's `**` misses a top-level file like src/index.css, so the filter is here). */
function tracked(folders, extensions) {
  return execSync(`git ls-files -- ${folders.join(' ')}`, { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && extensions.some((ext) => f.endsWith(ext)))
}

function clientSet() {
  return tracked(['src', 'scripts'], ['.ts', '.tsx', '.css', '.mjs']).filter(
    (f) => !EMAIL_ONLY.includes(f) && !LEFT_ALONE.includes(f) && f !== 'scripts/codemods/copper-sweep.mjs',
  )
}

function emailSet() {
  return [...tracked(['supabase/functions/_shared'], ['.ts']), ...EMAIL_ONLY]
}

const files = given.length ? given : ALL ? [...clientSet(), ...emailSet()] : EMAILS ? emailSet() : clientSet()

let touched = 0
const left = []
for (const file of files) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const hexHits = (src.match(OLD_HEX) ?? []).length
  const rgbHits = (src.match(OLD_RGB) ?? []).length
  if (hexHits + rgbHits === 0) continue
  left.push(`${file}: ${hexHits} hex, ${rgbHits} rgb`)
  if (CHECK) continue
  writeFileSync(file, src.replace(OLD_HEX, NEW_HEX).replace(OLD_RGB, NEW_RGB))
  touched++
}

if (CHECK) {
  if (left.length) {
    console.log(`copper sweep: ${left.length} file(s) still carry #b0662f / 176, 102, 47:\n  ${left.join('\n  ')}`)
    process.exit(1)
  }
  console.log('copper sweep: nothing left on the old copper.')
} else {
  console.log(touched ? `copper sweep: moved ${touched} file(s) to ${NEW_HEX}:\n  ${left.join('\n  ')}` : 'copper sweep: nothing to move.')
}
