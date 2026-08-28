/**
 * Digital twins Phase T2 (docs/DIGITAL_TWINS_PLAN.md): dev-login's twin alias.
 * `?as=twin:<role>[:<n>]` signs in as that twin instance; every other `as` value keeps
 * dev-login's fixed account. Fleet email convention: twin-<role>-<n>@twins.pipetooling.local
 * (accounts are minted per instance — twins are a fleet, not singletons).
 */
export function twinAliasEmail(asParam: string | null): string | null {
  const m = asParam ? /^twin:([a-z_]+)(?::(\d+))?$/.exec(asParam.trim()) : null
  if (!m) return null
  return `twin-${m[1]}-${m[2] ?? '1'}@twins.pipetooling.local`
}
