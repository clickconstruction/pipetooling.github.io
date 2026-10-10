import { useState } from 'react'
import type { Partner } from '../../lib/gc/types'
import { shortDate } from '../../lib/gc/words'
import { Btn, input } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-b-ii: the office files a trade's insurance certificate that came by email, as
 * SubDocumentAddForm files a sub's (`gc_record_company_coi`, B6-b-i): the day it runs out and the link to it. Filing it
 * keeps their insurance promise in the same press (`gc_company_paper_kept`).
 */
export function GcRecordInsurance({
  partner,
  onRecord,
  onDone,
  onCancel,
}: {
  partner: Partner
  onRecord: (expiresOn: string, url: string) => Promise<void>
  onDone: (words: string) => void
  onCancel: () => void
}) {
  const [expires, setExpires] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const field = { display: 'grid', gridTemplateColumns: 'minmax(7.5rem, auto) minmax(0, 1fr)', gap: '0.5rem', alignItems: 'center', fontSize: '0.88rem' } as const

  const file = async () => {
    // The press's own refusals, said before it is pressed.
    if (!expires) return setProblem('Say the day their insurance runs out.')
    if (!/^https:\/\//.test(url.trim())) return setProblem('Paste the link to their certificate. It starts with https.')
    setBusy(true)
    setProblem(null)
    try {
      await onRecord(expires, url)
      onDone(`Filed. ${partner.company}’s insurance is good to ${shortDate(expires)}.`)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That did not file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-gc-record-insurance={partner.id} style={{ border: '1px solid var(--text-blue-500)', borderRadius: 8, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'grid', gap: '0.65rem', boxShadow: '0 0 0 3px var(--bg-blue-tint)' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Record their insurance</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>For a certificate that came by email. Put it in Drive first, then paste its link here.</div>
      </div>
      <label style={field}>
        <span style={{ color: 'var(--text-muted)' }}>Runs out</span>
        <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} aria-label="The day their insurance runs out" style={{ ...input, width: 'auto' }} />
      </label>
      <label style={field}>
        <span style={{ color: 'var(--text-muted)' }}>Link to it</span>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" aria-label="Link to the certificate" style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
      </label>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn kind="primary" onClick={() => void file()} disabled={busy}>
          {busy ? 'Filing…' : 'File the certificate'}
        </Btn>
      </div>
    </div>
  )
}
