import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Roles allowed to import manual (non-Mercury) transactions.
const ALLOWED_ROLES = new Set(['dev', 'master_technician'])
const INSERT_BATCH = 500

interface ImportRow {
  postedDate: string // YYYY-MM-DD
  amount: number // signed; negative = money out
  payee?: string | null
  memo?: string | null
  category?: string | null
  type?: string | null
  refNo?: string | null
  reconciliationStatus?: string | null
}

interface ImportBody {
  /** Name for a new closed/external account (required when accountId is absent). */
  accountName?: string
  /** Existing synthetic account uuid to append to (optional). */
  accountId?: string
  rows?: ImportRow[]
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Stable de-dup key for a manual row within an account. */
function dedupKey(postedYmd: string, amount: number, payee: string | null, memo: string | null): string {
  return [postedYmd, amount.toFixed(2), (payee ?? '').trim().toLowerCase(), (memo ?? '').trim().toLowerCase()].join('|')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)

    // Auth: dev / master_technician JWT.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse({ error: 'Invalid session' }, 401)
    const { data: userRow, error: roleErr } = await userClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = (userRow as { role?: string } | null)?.role
    if (roleErr || !role || !ALLOWED_ROLES.has(role)) {
      return jsonResponse({ error: 'Forbidden — dev / master technician only' }, 403)
    }

    let body: ImportBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const rows = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return jsonResponse({ error: 'No rows to import' }, 400)
    if (rows.length > 5000) return jsonResponse({ error: 'Too many rows (max 5000 per upload)' }, 400)

    // Validate every row up front.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r || typeof r.postedDate !== 'string' || !YMD.test(r.postedDate)) {
        return jsonResponse({ error: `Row ${i + 1}: missing or invalid postedDate (expected YYYY-MM-DD)` }, 400)
      }
      if (typeof r.amount !== 'number' || !Number.isFinite(r.amount)) {
        return jsonResponse({ error: `Row ${i + 1}: missing or invalid amount` }, 400)
      }
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Resolve the target synthetic account.
    let accountId = (body.accountId ?? '').trim()
    let accountName = (body.accountName ?? '').trim()
    if (accountId) {
      // Guard: never write manual rows onto a real Mercury account.
      const { count: mercuryCount } = await admin
        .from('mercury_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('mercury_account_id', accountId)
        .eq('source', 'mercury')
      if ((mercuryCount ?? 0) > 0) {
        return jsonResponse({ error: 'Target account is a real Mercury account; manual import refused' }, 400)
      }
    } else {
      if (!accountName) return jsonResponse({ error: 'accountName is required for a new account' }, 400)
      accountId = crypto.randomUUID()
      const { error: nickErr } = await admin
        .from('mercury_account_nicknames')
        .insert({ mercury_account_id: accountId, nickname: accountName })
      if (nickErr) return jsonResponse({ error: `Could not create account: ${nickErr.message}` }, 500)
    }

    // De-dup against existing manual rows already on this account.
    const { data: existing } = await admin
      .from('mercury_transactions')
      .select('posted_at, amount, counterparty_name, external_memo')
      .eq('mercury_account_id', accountId)
      .eq('source', 'manual')
    const seen = new Set<string>()
    for (const e of (existing ?? []) as Array<{ posted_at: string | null; amount: number; counterparty_name: string | null; external_memo: string | null }>) {
      const ymd = (e.posted_at ?? '').slice(0, 10)
      seen.add(dedupKey(ymd, Number(e.amount), e.counterparty_name, e.external_memo))
    }

    const manualUploadId = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    const toInsert: Record<string, unknown>[] = []
    let skipped = 0
    for (const r of rows) {
      const payee = r.payee?.trim() || null
      const memo = r.memo?.trim() || null
      const key = dedupKey(r.postedDate, r.amount, payee, memo)
      if (seen.has(key)) {
        skipped++
        continue
      }
      seen.add(key)
      toInsert.push({
        mercury_id: null,
        mercury_account_id: accountId,
        source: 'manual',
        manual_upload_id: manualUploadId,
        created_by: user.id,
        amount: r.amount,
        currency: 'USD',
        // Noon UTC keeps the row on the same America/Chicago calendar day it was posted.
        posted_at: `${r.postedDate}T12:00:00Z`,
        created_at: nowIso,
        status: 'sent',
        kind: 'manual',
        counterparty_name: payee,
        external_memo: memo,
        note: r.category?.trim() || null,
        mercury_category: null,
        raw: {
          source: 'manual_csv',
          type: r.type ?? null,
          ref_no: r.refNo ?? null,
          category: r.category ?? null,
          reconciliation_status: r.reconciliationStatus ?? null,
          imported_at: nowIso,
          imported_by: user.id,
        },
      })
    }

    let inserted = 0
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const batch = toInsert.slice(i, i + INSERT_BATCH)
      const { error: insErr } = await admin.from('mercury_transactions').insert(batch)
      if (insErr) {
        return jsonResponse(
          { error: `Insert failed after ${inserted} rows: ${insErr.message}`, accountId, manualUploadId, inserted },
          500,
        )
      }
      inserted += batch.length
    }

    return jsonResponse({ ok: true, accountId, accountName, manualUploadId, inserted, skipped })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
