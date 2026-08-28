// CT↔PT user bridge, PT-side plumbing (v2.2435; see docs/recent-features/v2.2434.md for
// the architecture). Two exports:
//   * callCtManageUser — the ONE place PT speaks to CountTooling's manage-user function
//     (X-Bridge-Secret from CT_MANAGE_USER_SECRET, URL from CT_MANAGE_USER_URL).
//   * forwardCtSeatState — fail-soft deactivate/reactivate forwarding for the
//     archive-user / restore-user flows: reads users.counttooling_user_id and mirrors
//     the state to CT. NEVER throws — a CT-leg failure must not block the PT action;
//     the returned status string goes into the response's `ct_bridge` field and the
//     weekly drift audit catches anything that slipped.

type SupabaseAdminLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { counttooling_user_id?: string | null } | null; error: { message: string } | null }>
      }
    }
  }
}

export async function callCtManageUser(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const url = Deno.env.get('CT_MANAGE_USER_URL')
  const secret = Deno.env.get('CT_MANAGE_USER_SECRET')
  if (!url || !secret) throw new Error('CT bridge not configured (CT_MANAGE_USER_URL / CT_MANAGE_USER_SECRET)')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': secret },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

export async function forwardCtSeatState(
  adminClient: SupabaseAdminLike,
  ptUserId: string,
  verb: 'deactivate' | 'reactivate',
): Promise<string> {
  try {
    const { data, error } = await adminClient
      .from('users')
      .select('counttooling_user_id')
      .eq('id', ptUserId)
      .maybeSingle()
    if (error) return `skipped: join-key read failed (${error.message})`
    const ctId = data?.counttooling_user_id
    if (!ctId) return 'skipped: no CT seat linked'
    const { status, json } = await callCtManageUser({ verb, ct_user_id: ctId })
    if (status !== 200) return `failed: CT ${verb} → ${status} ${String(json.error ?? '')}`.trim()
    console.log(`ct-bridge forward: ${verb} pt=${ptUserId} ct=${ctId}`)
    return 'ok'
  } catch (e) {
    return `failed: ${String(e)}`
  }
}
