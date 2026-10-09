/**
 * One edge function calling another as a trusted internal caller (v2.5042). A portal visitor has no session, so
 * the caller presents the service-role key as its bearer; `notify-dispatch-request` treats exactly that token as
 * an internal caller allowed to announce a new request (v2.3246). Without the header the callee answers 401 and
 * nothing is sent. Dependency-free, so the app's tests import it.
 */
export function internalFunctionCall(
  supabaseUrl: string,
  serviceRoleKey: string,
  fn: string,
  body: unknown,
): { url: string; init: RequestInit } {
  return {
    url: `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${fn}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify(body),
    },
  }
}
