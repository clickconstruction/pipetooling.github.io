// A twin's seat (v2.7879): the next free fleet number, the address it wears in each of the three apps and its name.
// One kernel for the two doors that make a twin: Settings → Digital twins (through src/lib/twinConsoleDisplay.ts, the
// client's door to this file) and dev-mcp's plan_twin → apply_twin (_shared/devMcpTwin.ts). Pure: no env, no network.

export type TwinSeatKind = 'estimator' | 'pricer'

export const PT_TWIN_DOMAIN = '@twins.pipetooling.local'
export const CT_TWIN_DOMAIN = '@twins.counttooling.local'
export const TT_TWIN_DOMAIN = '@twins.takeofftooling.local'

/**
 * Next free fleet seat from the emails already minted (gaps are not reused).
 * Each kind numbers its own seats: `twin-estimator-<n>` for the bid robots,
 * `twin-pricer-<n>` (Price Matrix PR 3) for the pricing robot that never bids.
 */
export function nextTwinSeat(emails: string[], kind: TwinSeatKind = 'estimator'): { n: number; email: string } {
  const re = new RegExp(`^twin-${kind}-(\\d+)@`)
  const ns = emails.map((e) => Number(re.exec(e)?.[1] ?? 0))
  const n = Math.max(0, ...ns) + 1
  return { n, email: `twin-${kind}-${n}${PT_TWIN_DOMAIN}` }
}

/** The name the fleet lists a seat by: Twin Estimator 4, Twin Pricer 2. */
export function twinSeatName(kind: TwinSeatKind, n: number): string {
  return kind === 'pricer' ? `Twin Pricer ${n}` : `Twin Estimator ${n}`
}

/** The seat's address in CountTooling: the same seat at CountTooling's fleet domain. */
export const ctTwinSeatEmail = (ptEmail: string): string => ptEmail.replace(PT_TWIN_DOMAIN, CT_TWIN_DOMAIN)

/** The seat's address in TakeoffTooling: the same seat at TakeoffTooling's fleet domain. */
export const ttTwinSeatEmail = (ptEmail: string): string => ptEmail.replace(PT_TWIN_DOMAIN, TT_TWIN_DOMAIN)
