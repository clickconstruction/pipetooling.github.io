/**
 * The walk kit's row, read once per run by the two readers (punch list #142 PR 1): `gmail-sync` and `quo-webhook` take
 * an address or number of our own as a person only when the kit's contact carries it (`gcKernels/lib/walk/kit.ts`).
 * With no row, or one that does not read, there is no kit and the rule is dormant. Deno-free: the caller hands in its
 * client.
 */
import { WALK_KIT_KEY, parseWalkKit, type WalkKit } from './gcKernels/lib/walk/kit.ts'

// deno-lint-ignore no-explicit-any
export async function loadWalkKit(admin: any): Promise<WalkKit | null> {
  const { data, error } = await admin.from('app_settings').select('value_text').eq('key', WALK_KIT_KEY).maybeSingle()
  if (error) throw new Error(`app_settings ${WALK_KIT_KEY}: ${error.message}`)
  return parseWalkKit((data as { value_text: string | null } | null)?.value_text)
}
