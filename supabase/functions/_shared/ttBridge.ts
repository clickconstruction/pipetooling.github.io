// TT↔PT bridge, PT-side plumbing (v2.3082) — the TakeoffTooling twin of _shared/ctBridge.ts.
// One export: callTtManageUser — the ONE place PT speaks to TakeoffTooling's manage-user
// function (X-Bridge-Secret from TT_MANAGE_USER_SECRET, URL from TT_MANAGE_USER_URL).
// TakeoffTooling is the electrical estimator's explode-and-cost app (STG-4 of the
// electrical pipeline); its bridge verbs mirror CountTooling's: create / lookup /
// set_twin_flag / set_twin_credential / revoke_twin_credential / twin_projects /
// twin_manifest / set_twin_project_review. No join-key column on PT: a twin's
// TakeoffTooling seat is its fleet email at the TT fleet domain.

export const TT_FLEET_DOMAIN = '@twins.takeofftooling.local'
export const PT_FLEET_DOMAIN = '@twins.pipetooling.local'
export const ttTwinEmail = (ptEmail: string) => ptEmail.replace(PT_FLEET_DOMAIN, TT_FLEET_DOMAIN)

export function ttBridgeConfigured(): boolean {
  return !!(Deno.env.get('TT_MANAGE_USER_URL') && Deno.env.get('TT_MANAGE_USER_SECRET'))
}

export async function callTtManageUser(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const url = Deno.env.get('TT_MANAGE_USER_URL')
  const secret = Deno.env.get('TT_MANAGE_USER_SECRET')
  if (!url || !secret) throw new Error('TT bridge not configured (TT_MANAGE_USER_URL / TT_MANAGE_USER_SECRET)')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': secret },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}
