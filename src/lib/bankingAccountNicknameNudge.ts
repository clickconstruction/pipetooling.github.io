/**
 * Dev-only nudge on the Banking page (v2.2899, J33-F5): Mercury accounts with
 * no row in `mercury_account_nicknames` render as raw UUIDs in every account
 * filter (Ledger, User Sort, Drag Sort, Configuration). Only dev can write that
 * table (RLS), so the nudge lands on dev, not on the assistant who sees the
 * UUIDs. Pure — unit-tested in `bankingAccountNicknameNudge.test.ts`.
 */

/** Account ids present in the loaded rows that have no (non-blank) nickname, sorted. */
export function unnamedMercuryAccountIds(
  accountIds: readonly string[],
  nicknameByAccount: Readonly<Record<string, string | null | undefined>>,
): string[] {
  const out = new Set<string>()
  for (const id of accountIds) {
    const trimmed = id.trim()
    if (!trimmed) continue
    const nick = nicknameByAccount[trimmed]
    if (nick == null || nick.trim() === '') out.add(trimmed)
  }
  return [...out].sort()
}

/** One line for the amber nudge; null when nothing is unnamed. */
export function accountNicknameNudgeText(unnamedCount: number): string | null {
  if (unnamedCount <= 0) return null
  const noun = unnamedCount === 1 ? '1 account has' : `${unnamedCount} accounts have`
  return `${noun} no nickname — ${unnamedCount === 1 ? 'it shows' : 'they show'} as a raw ID in every account filter. Only a dev can name accounts.`
}
