import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MERCURY_BASE = 'https://api.mercury.com/api/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Roles that can view Banking (and therefore reconciliation).
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant'])

const MISSING_SAMPLE_CAP = 50
// Ids go in the RPC POST body (not a GET URL), so we can batch generously.
const ID_CHUNK = 2000

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type MercuryAccount = {
  id: string
  name: string
  status?: string
  currentBalance?: number
  availableBalance?: number
}

type MercuryStatementTx = {
  id?: string
  amount?: number
  postedAt?: string | null
  counterpartyName?: string | null
}

type MercuryStatement = {
  id?: string
  startDate?: string
  endDate?: string
  endingBalance?: number
  transactions?: MercuryStatementTx[]
}

async function mercuryGet(path: string, mercuryKey: string): Promise<Response> {
  return fetch(`${MERCURY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${mercuryKey}`, Accept: 'application/json' },
  })
}

// Mercury's single-resource routes are singular (e.g. /account/{id}/...). Fall
// back to the plural form if the singular 404s, so a path-shape change doesn't
// silently break reconciliation.
async function fetchStatements(accountId: string, mercuryKey: string, limit: number): Promise<MercuryStatement[]> {
  const qs = `?limit=${limit}&order=desc`
  let res = await mercuryGet(`/account/${encodeURIComponent(accountId)}/statements${qs}`, mercuryKey)
  if (res.status === 404) {
    res = await mercuryGet(`/accounts/${encodeURIComponent(accountId)}/statements${qs}`, mercuryKey)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mercury statements fetch failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { statements?: MercuryStatement[] }
  return data.statements ?? []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mercuryKey = Deno.env.get('MERCURY_API_KEY')
    if (!mercuryKey?.trim()) return jsonResponse({ error: 'Server misconfigured: MERCURY_API_KEY' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse({ error: 'Invalid session' }, 401)
    const { data: userRow, error: roleErr } = await userClient.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (userRow as { role?: string } | null)?.role
    if (roleErr || !role || !ALLOWED_ROLES.has(role)) {
      return jsonResponse({ error: 'Forbidden — Banking access required' }, 403)
    }

    const body = (await req.json().catch(() => ({}))) as { monthsBack?: number; accountId?: string }
    const monthsBack = Math.min(Math.max(Math.floor(Number(body.monthsBack ?? 12)), 1), 24)
    const accountFilter = typeof body.accountId === 'string' && body.accountId ? body.accountId : null

    // Service-role client: mercury_transactions RLS is dev-only select; we need
    // the existence check to run regardless of the caller's row visibility.
    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Live balances + account list.
    const accRes = await mercuryGet('/accounts', mercuryKey)
    if (!accRes.ok) {
      const text = await accRes.text().catch(() => '')
      return jsonResponse({ error: `Mercury accounts fetch failed (${accRes.status})`, detail: text.slice(0, 300) }, 502)
    }
    const accData = (await accRes.json()) as { accounts?: MercuryAccount[] }
    let accounts = (accData.accounts ?? []).filter((a) => a.status !== 'archived')
    if (accountFilter) accounts = accounts.filter((a) => a.id === accountFilter)

    // 2. Fetch statements per account.
    const perAccount = await Promise.all(
      accounts.map(async (a) => {
        const statements = await fetchStatements(a.id, mercuryKey, monthsBack)
        // Newest first.
        statements.sort((s1, s2) => (s2.startDate ?? '').localeCompare(s1.startDate ?? ''))
        return { account: a, statements: statements.slice(0, monthsBack) }
      }),
    )

    // 3. Gather every statement tx id and look up which exist in the books.
    const allIds = new Set<string>()
    for (const pa of perAccount) {
      for (const st of pa.statements) {
        for (const t of st.transactions ?? []) {
          if (t.id) allIds.add(t.id)
        }
      }
    }
    const present = new Set<string>()
    const idList = [...allIds]
    for (let i = 0; i < idList.length; i += ID_CHUNK) {
      const chunk = idList.slice(i, i + ID_CHUNK)
      // Pass ids in the POST body via RPC — a large `in.(...)` GET filter blows
      // past PostgREST's URL length limit.
      const { data, error } = await admin.rpc('list_present_mercury_ids', { p_ids: chunk })
      if (error) return jsonResponse({ error: `Books lookup failed: ${error.message}` }, 500)
      for (const id of (data ?? []) as string[]) {
        if (id) present.add(id)
      }
    }

    // 4 + 5. Build per-account / per-month summaries + current-period check.
    const result = []
    for (const pa of perAccount) {
      const a = pa.account
      // Statements are newest-first; prevEndingBalance is the next-older month.
      const months = pa.statements.map((st, idx) => {
        const older = pa.statements[idx + 1]
        const txs = st.transactions ?? []
        let presentCount = 0
        let statementTxSum = 0
        let missingValue = 0
        const missingSample: MercuryStatementTx[] = []
        for (const t of txs) {
          const amt = Number(t.amount ?? 0)
          statementTxSum += Number.isFinite(amt) ? amt : 0
          if (t.id && present.has(t.id)) {
            presentCount += 1
          } else {
            missingValue += Number.isFinite(amt) ? amt : 0
            if (missingSample.length < MISSING_SAMPLE_CAP) {
              missingSample.push({ id: t.id, amount: amt, postedAt: t.postedAt ?? null, counterpartyName: t.counterpartyName ?? null })
            }
          }
        }
        const endingBalance = Number(st.endingBalance ?? 0)
        const prevEndingBalance = older ? Number(older.endingBalance ?? 0) : null
        return {
          period: (st.startDate ?? '').slice(0, 7),
          startDate: st.startDate ?? null,
          endDate: st.endDate ?? null,
          statementCount: txs.length,
          presentCount,
          missingCount: txs.length - presentCount,
          missingValue: Math.round(missingValue * 100) / 100,
          missingSample,
          endingBalance,
          prevEndingBalance,
          statementNet: prevEndingBalance === null ? null : Math.round((endingBalance - prevEndingBalance) * 100) / 100,
          statementTxSum: Math.round(statementTxSum * 100) / 100,
        }
      })

      // Current open period: book activity since the latest statement close.
      const latest = pa.statements[0]
      let current: Record<string, unknown> = {
        mercuryCurrentBalance: Number(a.currentBalance ?? 0),
        availableBalance: Number(a.availableBalance ?? 0),
        latestStatementEnd: latest?.endDate ?? null,
        expectedCurrent: null,
        delta: null,
      }
      if (latest?.endDate) {
        const { data, error } = await admin
          .from('mercury_transactions')
          .select('amount')
          .eq('mercury_account_id', a.id)
          .gt('posted_at', latest.endDate)
          .is('duplicate_of_transaction_id', null)
        if (error) return jsonResponse({ error: `Current-period lookup failed: ${error.message}` }, 500)
        const sinceClose = ((data ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount ?? 0), 0)
        const expected = Number(latest.endingBalance ?? 0) + sinceClose
        current = {
          ...current,
          bookActivitySinceClose: Math.round(sinceClose * 100) / 100,
          expectedCurrent: Math.round(expected * 100) / 100,
          delta: Math.round((Number(a.currentBalance ?? 0) - expected) * 100) / 100,
        }
      }

      result.push({
        id: a.id,
        name: a.name,
        currentBalance: Number(a.currentBalance ?? 0),
        availableBalance: Number(a.availableBalance ?? 0),
        months,
        current,
      })
    }

    return jsonResponse({ ok: true, generatedAt: new Date().toISOString(), monthsBack, accounts: result })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
