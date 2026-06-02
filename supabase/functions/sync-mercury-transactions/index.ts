import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MERCURY_BASE, mapMercuryTransactionToRow } from '../_shared/mercuryTransaction.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const DEFAULT_LIMIT = 500
const MAX_PAGES = 120

interface SyncBody {
  start?: string
  end?: string
  /** YYYY-MM-DD window if start/end omitted; default 90 */
  lookback_days?: number
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function defaultStartYmd(lookbackDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - lookbackDays)
  return d.toISOString().slice(0, 10)
}

function defaultEndYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mercuryKey = Deno.env.get('MERCURY_API_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!serviceKey) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)
    }
    if (!mercuryKey?.trim()) {
      return jsonResponse({ error: 'Server misconfigured: MERCURY_API_KEY' }, 500)
    }

    // Auth: either an X-Cron-Secret match (unattended reconciliation cron) or a dev JWT.
    const isCron = !!cronSecret && req.headers.get('X-Cron-Secret') === cronSecret
    if (!isCron) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Missing authorization' }, 401)
      }
      const token = authHeader.replace(/^Bearer\s+/i, '')
      const userClient = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
        error: authErr,
      } = await userClient.auth.getUser(token)
      if (authErr || !user) {
        return jsonResponse({ error: 'Invalid session' }, 401)
      }
      const { data: userRow, error: roleErr } = await userClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (roleErr || (userRow as { role?: string } | null)?.role !== 'dev') {
        return jsonResponse({ error: 'Forbidden — dev only' }, 403)
      }
    }

    let body: SyncBody = {}
    try {
      const text = await req.text()
      if (text.trim()) body = JSON.parse(text) as SyncBody
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const lookback = Math.min(3650, Math.max(1, body.lookback_days ?? 90))
    const start = body.start?.trim() || defaultStartYmd(lookback)
    const end = body.end?.trim() || defaultEndYmd()

    const admin = createClient(supabaseUrl, serviceKey)
    const syncedAt = new Date().toISOString()

    let total = 0
    let startAfter: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${MERCURY_BASE}/transactions`)
      url.searchParams.set('limit', String(DEFAULT_LIMIT))
      url.searchParams.set('start', start)
      url.searchParams.set('end', end)
      if (startAfter) url.searchParams.set('start_after', startAfter)

      const mRes = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${mercuryKey}`,
        },
      })

      if (!mRes.ok) {
        const errText = await mRes.text()
        console.error('Mercury API error', mRes.status, errText)
        return jsonResponse(
          { error: `Mercury API ${mRes.status}`, detail: errText.slice(0, 500) },
          502,
        )
      }

      const payload = (await mRes.json()) as {
        transactions?: Record<string, unknown>[]
      }
      const batch = payload.transactions ?? []
      if (batch.length === 0) break

      const rows = batch.map((t) => mapMercuryTransactionToRow(t as Record<string, unknown>, syncedAt))
      const { error: upsertErr } = await admin.from('mercury_transactions').upsert(rows, {
        onConflict: 'mercury_id',
      })
      if (upsertErr) {
        console.error('mercury_transactions upsert', upsertErr)
        return jsonResponse({ error: upsertErr.message }, 500)
      }

      total += batch.length
      const last = batch[batch.length - 1] as { id?: string }
      startAfter = last?.id
      if (!startAfter || batch.length < DEFAULT_LIMIT) break
    }

    return jsonResponse({ success: true, upserted: total, start, end })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
})
