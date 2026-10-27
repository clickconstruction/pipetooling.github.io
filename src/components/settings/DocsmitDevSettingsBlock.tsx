import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { DOCSMIT_SETTING_KEY_LIST, docsmitSettingRows, docsmitSettingsFrom, type DocsmitSettings } from '../../lib/mail/docsmitSettings'
import { DOCSMIT_BASE_URLS, docsmitSecretStatusWords, sha512Hex, type DocsmitSecretStatus } from '../../lib/mail/docsmitSecrets'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Settings → Developer → Docsmit (the Docsmit train, PR 9 — docs/DOCSMIT_LIEN_RUN_PLAN.md, "Managed from
 * Developer settings"): the certified-mail connection, dev only. Two homes: the secrets in Vault through
 * the `mail-config` function (the password is hashed here, so the cleartext never leaves the browser;
 * nothing secret ever comes back), and the switches in `app_settings` `docsmit_*` rows
 * (`src/lib/mail/docsmitSettings.ts`), written straight from here under the dev policies of
 * migration 20261013150000. Test the connection asks Docsmit for the account's name and balance;
 * Poll now runs the hourly read-back at once.
 */

type Invoke = (name: string, body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

const invoke: Invoke = async (name, body) => {
  const { data, error } = await supabase.functions.invoke(name, { body })
  return { data, error }
}

function errorWords(data: unknown, error: unknown, fallback: string): string {
  const d = data as { error?: unknown } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') return (error as { message: string }).message
  return fallback
}

const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '0.45rem 0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }
const labelStyle = { display: 'block', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }
const rowStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }
const buttonStyle = { padding: '0.45rem 0.8rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

export default function DocsmitDevSettingsBlock() {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<DocsmitSecretStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [softwareId, setSoftwareId] = useState('')
  const [baseUrl, setBaseUrl] = useState(DOCSMIT_BASE_URLS[0]!.value)
  const [savingSecrets, setSavingSecrets] = useState(false)
  const [settings, setSettings] = useState<DocsmitSettings | null>(null)
  const [savingSwitches, setSavingSwitches] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testWords, setTestWords] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [pollWords, setPollWords] = useState<string | null>(null)

  const readStatus = useCallback(async () => {
    const { data, error } = await invoke('mail-config', { action: 'status' })
    const d = data as (DocsmitSecretStatus & { ok?: boolean }) | null
    if (error || !d?.ok) {
      setStatusError(errorWords(data, error, 'Could not read the connection.'))
      return
    }
    setStatusError(null)
    setStatus(d)
    if (d.email) setEmail(d.email)
    if (d.base_url) setBaseUrl(d.base_url)
  }, [])

  const readSwitches = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value_text, value_num').in('key', DOCSMIT_SETTING_KEY_LIST)
    setSettings(docsmitSettingsFrom((data ?? []) as Array<{ key: string; value_text?: string | null; value_num?: number | null }>))
  }, [])

  useEffect(() => {
    if (!open) return
    void readStatus()
    void readSwitches()
  }, [open, readStatus, readSwitches])

  if (role !== 'dev') return null

  const saveSecrets = async () => {
    setSavingSecrets(true)
    try {
      const body: Record<string, unknown> = { action: 'set', email: email.trim(), software_id: softwareId.trim(), base_url: baseUrl }
      if (password) body.password_sha512 = await sha512Hex(password)
      if (!softwareId.trim()) delete body.software_id
      const { data, error } = await invoke('mail-config', body)
      const d = data as (DocsmitSecretStatus & { ok?: boolean }) | null
      if (error || !d?.ok) throw new Error(errorWords(data, error, 'Could not save the connection.'))
      setStatus(d)
      setPassword('')
      setSoftwareId('')
      showToast('Docsmit connection saved. The password went in as its hash only.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the connection.'), 'error')
    } finally {
      setSavingSecrets(false)
    }
  }

  const saveSwitches = async () => {
    if (!settings) return
    setSavingSwitches(true)
    try {
      const { error } = await supabase.from('app_settings').upsert(docsmitSettingRows(settings), { onConflict: 'key' })
      if (error) throw new Error(error.message)
      showToast(settings.paused ? 'Docsmit switches saved. Runs open on paper while paused.' : 'Docsmit switches saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the switches.'), 'error')
    } finally {
      setSavingSwitches(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestWords(null)
    try {
      const { data, error } = await invoke('mail-config', { action: 'ping' })
      const d = data as { ok?: boolean; env?: string; account?: { name: string | null; credit_balance: number | null } } | null
      if (error || !d?.ok) throw new Error(errorWords(data, error, 'Docsmit did not answer.'))
      const bal = d.account?.credit_balance
      setTestWords(`Docsmit answered${d.account?.name ? ` for ${d.account.name}` : ''}: balance ${bal == null ? 'unknown' : `$${bal.toFixed(2)}`} · ${d.env === 'prod' ? 'the live site' : 'Tracksmit'}.`)
    } catch (e) {
      setTestWords(formatErrorMessage(e, 'Docsmit did not answer.'))
    } finally {
      setTesting(false)
    }
  }

  const pollNow = async () => {
    setPolling(true)
    setPollWords(null)
    try {
      const { data, error } = await invoke('mail-send-docsmit', { action: 'refresh' })
      const d = data as { ok?: boolean; read?: number; updated?: string[]; errors?: unknown[] } | null
      if (error || !d || typeof d.read !== 'number') throw new Error(errorWords(data, error, 'The poll did not run.'))
      setPollWords(`Read ${d.read} open piece${d.read === 1 ? '' : 's'}: ${d.updated?.length ?? 0} changed${d.errors?.length ? `, ${d.errors.length} with an error` : ''}.`)
    } catch (e) {
      setPollWords(formatErrorMessage(e, 'The poll did not run.'))
    } finally {
      setPolling(false)
    }
  }

  const set = <K extends keyof DocsmitSettings>(k: K, v: DocsmitSettings[K]) => setSettings((s) => (s ? { ...s, [k]: v } : s))

  return (
    <div data-testid="docsmit-dev-block" style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button type="button" onClick={() => setOpen((p) => !p)} data-testid="docsmit-dev-toggle" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textAlign: 'left', color: 'var(--text)' }}>
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Docsmit · certified mail from the app
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-page)' }}>
          <p style={{ margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            The Lien desk mails notices certified through Docsmit. The secrets live in Vault and never come back here; the password goes in as its hash only. Start on Tracksmit, the sandbox, and read the first run on paper.
          </p>
          <p data-testid="docsmit-status" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>{statusError ?? docsmitSecretStatusWords(status)}</p>

          <div style={rowStyle}>
            <div>
              <label htmlFor="docsmit-email" style={labelStyle}>Account email</label>
              <input id="docsmit-email" data-testid="docsmit-email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="docsmit-password" style={labelStyle}>Password (hashed here, kept nowhere)</label>
              <input id="docsmit-password" data-testid="docsmit-password" type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={status?.set.DOCSMIT_PASSWORD_SHA512 ? 'set · type to replace' : ''} />
            </div>
            <div>
              <label htmlFor="docsmit-software-id" style={labelStyle}>Software id</label>
              <input id="docsmit-software-id" data-testid="docsmit-software-id" style={inputStyle} value={softwareId} onChange={(e) => setSoftwareId(e.target.value)} autoComplete="off" placeholder={status?.set.DOCSMIT_SOFTWARE_ID ? 'set · type to replace' : ''} />
            </div>
            <div>
              <label htmlFor="docsmit-base-url" style={labelStyle}>Which Docsmit</label>
              <select id="docsmit-base-url" data-testid="docsmit-base-url" style={inputStyle} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}>
                {DOCSMIT_BASE_URLS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button type="button" style={buttonStyle} data-testid="docsmit-save-secrets" disabled={savingSecrets || !email.trim()} onClick={() => void saveSecrets()}>{savingSecrets ? 'Saving…' : 'Save the connection'}</button>
            <button type="button" style={buttonStyle} data-testid="docsmit-test" disabled={testing} onClick={() => void test()}>{testing ? 'Asking Docsmit…' : 'Test the connection'}</button>
            {testWords ? <span data-testid="docsmit-test-words" style={{ fontSize: '0.875rem', alignSelf: 'center' }}>{testWords}</span> : null}
          </div>

          {settings ? (
            <>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Switches</p>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" data-testid="docsmit-paused" checked={settings.paused} onChange={(e) => set('paused', e.target.checked)} /> Paused (runs open on paper)
                </label>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" data-testid="docsmit-plus-default" checked={settings.plusDefault} onChange={(e) => set('plusDefault', e.target.checked)} /> Plain First Class copy too, by default
                </label>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" data-testid="docsmit-match-site" checked={settings.matchSite} onChange={(e) => set('matchSite', e.target.checked)} /> The poll also records what was sent by hand on Docsmit’s site
                </label>
              </div>
              <div style={rowStyle}>
                <div>
                  <label htmlFor="docsmit-run-default" style={labelStyle}>A run opens on</label>
                  <select id="docsmit-run-default" data-testid="docsmit-run-default" style={inputStyle} value={settings.runDefault} onChange={(e) => set('runDefault', e.target.value as DocsmitSettings['runDefault'])}>
                    <option value="docsmit">Docsmit</option>
                    <option value="paper">Paper</option>
                    <option value="last">Whatever the last run used</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="docsmit-return-receipt" style={labelStyle}>Return receipt</label>
                  <select id="docsmit-return-receipt" data-testid="docsmit-return-receipt" style={inputStyle} value={settings.returnReceipt} onChange={(e) => set('returnReceipt', e.target.value as DocsmitSettings['returnReceipt'])}>
                    <option value="electronic">Electronic (the default)</option>
                    <option value="card">Green card</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="docsmit-cutoff" style={labelStyle}>Docsmit’s cutoff (Central, HH:MM)</label>
                  <input id="docsmit-cutoff" data-testid="docsmit-cutoff" style={inputStyle} value={settings.cutoffLocal} onChange={(e) => set('cutoffLocal', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="docsmit-buffer" style={labelStyle}>Send-by buffer (business days)</label>
                  <input id="docsmit-buffer" data-testid="docsmit-buffer" type="number" min={0} max={10} style={inputStyle} value={settings.sendByBufferDays} onChange={(e) => set('sendByBufferDays', Number(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="docsmit-credit-warn" style={labelStyle}>Warn when the balance is under ($)</label>
                  <input id="docsmit-credit-warn" data-testid="docsmit-credit-warn" type="number" min={0} style={inputStyle} value={settings.creditWarn} onChange={(e) => set('creditWarn', Number(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="docsmit-poll-minutes" style={labelStyle}>Poll every (minutes)</label>
                  <input id="docsmit-poll-minutes" data-testid="docsmit-poll-minutes" type="number" min={5} style={inputStyle} value={settings.pollMinutes} onChange={(e) => set('pollMinutes', Number(e.target.value))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" style={buttonStyle} data-testid="docsmit-save-switches" disabled={savingSwitches} onClick={() => void saveSwitches()}>{savingSwitches ? 'Saving…' : 'Save the switches'}</button>
                <button type="button" style={buttonStyle} data-testid="docsmit-poll-now" disabled={polling} onClick={() => void pollNow()}>{polling ? 'Polling…' : 'Poll now'}</button>
                {pollWords ? <span data-testid="docsmit-poll-words" style={{ fontSize: '0.875rem', alignSelf: 'center' }}>{pollWords}</span> : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
