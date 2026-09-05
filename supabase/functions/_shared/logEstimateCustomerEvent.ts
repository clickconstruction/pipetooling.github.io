import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type EstimateCustomerEventType = 'public_link_view' | 'public_accept_submitted' | 'option_viewed' | 'declined'

export type EstimateCustomerEventSource =
  | 'get-estimate-for-customer'
  | 'accept-estimate'
  | 'log-estimate-option-view'
  /** The staff writer is the RPC `record_estimate_decline` (v2.2873), not an edge function. */
  | 'record_estimate_decline'

export function clientIpFromRequest(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() ?? null
  return null
}

/** Best-effort audit row; logs and never throws (customer responses must not depend on this). */
export async function insertEstimateCustomerEvent(
  admin: SupabaseClient,
  opts: {
    estimateId: string
    eventType: EstimateCustomerEventType
    source: EstimateCustomerEventSource
    req: Request
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    // v2.2476: was bare `req` (a ReferenceError at runtime) — the outer catch swallowed it, so
    // every caller's best-effort audit silently no-opped. Found by the live E2E when
    // option_viewed rows never appeared.
    const ipRaw = clientIpFromRequest(opts.req)
    const ua = opts.req.headers.get('user-agent')
    const row = {
      estimate_id: opts.estimateId,
      event_type: opts.eventType,
      source: opts.source,
      client_ip: ipRaw?.trim() ? ipRaw.trim() : null,
      user_agent: ua?.trim() ? ua.trim() : null,
      metadata: opts.metadata ?? {},
    }
    // Prefer RPC: INSERT runs inside SECURITY DEFINER (no PostgREST INSERT...RETURNING + SELECT RLS edge cases).
    const rpc = await admin.rpc('log_estimate_customer_event', {
      p_estimate_id: opts.estimateId,
      p_event_type: opts.eventType,
      p_source: opts.source,
      p_client_ip: ipRaw?.trim() ?? '',
      p_user_agent: ua?.trim() ?? '',
      p_metadata: opts.metadata ?? {},
    })
    if (!rpc.error) {
      console.info(
        JSON.stringify({
          tag: 'estimate_customer_event_ok',
          via: 'rpc',
          eventType: opts.eventType,
          source: opts.source,
        }),
      )
      return
    }
    console.error('insertEstimateCustomerEvent.rpc', JSON.stringify(rpc.error))
    // Fallback: plain insert without .select() so PostgREST does not apply RETURNING + SELECT policy to the new row.
    const ins = await admin.from('estimate_customer_events').insert(row)
    if (ins.error) {
      console.error('insertEstimateCustomerEvent.insert', JSON.stringify(ins.error))
      return
    }
    console.info(
      JSON.stringify({
        tag: 'estimate_customer_event_ok',
        via: 'insert',
        eventType: opts.eventType,
        source: opts.source,
      }),
    )
  } catch (e) {
    console.error('insertEstimateCustomerEvent', e)
  }
}
