/**
 * "Email a copy…" (Signed agreement view PR B, v2.2712): send the stored
 * signed PDF to anyone. To is prefilled with the signer; chips for the
 * signer, the contract's also-send-to list, and office teammates
 * (TeammateEmailChips); a note; the attachment line. Sends through
 * share-job-contract, which logs who got the copy.
 */
import { useEffect, useMemo, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { TeammateEmailChips } from './TeammateEmailChips'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { OFFICE_CAPABLE_ROLES, type TeammateChip, type TeammateChipUser } from '../../lib/teammateEmailChips'
import type { JobContractRow } from '../../lib/jobs/jobContractLifecycle'

export type ShareTarget = { kind: 'contract'; contractId: string } | { kind: 'estimate'; estimateId: string; jobId: string | null }

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.45rem 0.6rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.85rem',
}
const label: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }
const btn: React.CSSProperties = { padding: '0.4rem 0.8rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }

function parseEmails(v: string): string[] {
  return [...new Set(v.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))].slice(0, 10)
}

export default function JobContractShareSheet({
  open,
  onClose,
  target,
  heading,
  signerName,
  signerEmail,
  contractRow,
  filenameHint,
  onShared,
}: {
  open: boolean
  onClose: () => void
  target: ShareTarget | null
  heading: string
  signerName: string
  signerEmail: string | null
  contractRow?: JobContractRow | null
  filenameHint: string
  onShared?: (to: string[]) => void
}) {
  const { showToast } = useToastContext()
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [users, setUsers] = useState<TeammateChipUser[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setTo(signerEmail ?? '')
    setNote('')
    void (async () => {
      try {
        const { data } = await supabase.from('users').select('id, name, email, role').in('role', [...OFFICE_CAPABLE_ROLES])
        setUsers(((data ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null }>).map((u) => ({ id: u.id, name: u.name ?? '', email: u.email, role: u.role ?? '' })) as TeammateChipUser[])
      } catch {
        setUsers([])
      }
    })()
  }, [open, signerEmail])

  const leading = useMemo<TeammateChip[]>(() => {
    const out: TeammateChip[] = []
    if (signerEmail) out.push({ email: signerEmail.toLowerCase(), label: signerName ? signerName.split(' ')[0] ?? 'Signer' : 'Signer', title: `${signerName || 'Signer'} · ${signerEmail}` } as TeammateChip)
    for (const cc of contractRow?.cc_emails ?? []) {
      const e = cc.trim().toLowerCase()
      if (e && !out.some((c) => c.email === e)) out.push({ email: e, label: e.split('@')[0] ?? e, title: `Also sent to · ${e}` } as TeammateChip)
    }
    return out
  }, [signerEmail, signerName, contractRow])

  const recipients = parseEmails(to)

  const send = async () => {
    if (!target || recipients.length === 0) {
      showToast('Add at least one valid email.', 'error')
      return
    }
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('share-job-contract', {
        body: {
          ...(target.kind === 'contract' ? { contract_id: target.contractId } : { estimate_id: target.estimateId, job_id: target.jobId }),
          mode: 'email',
          to: recipients,
          note: note.trim() || undefined,
          public_origin: window.location.origin,
        },
      })
      const res = (data ?? {}) as { ok?: boolean; error?: string }
      if (error || !res.ok) {
        showToast(res.error || error?.message || 'Could not send the copy.', 'error')
        return
      }
      showToast(`Signed copy sent to ${recipients.join(', ')}.`, 'success')
      onShared?.(recipients)
      onClose()
    } finally {
      setSending(false)
    }
  }

  if (!open || !target) return null
  return (
    <ResponsiveModalShell
      title="Email a copy of the signed agreement"
      onRequestClose={onClose}
      maxWidthDesktop={560}
      zIndex={1300}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" style={btn} disabled={sending} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={{ ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }} disabled={sending || recipients.length === 0} onClick={() => void send()}>
            {sending ? 'Sending…' : `Send copy${recipients.length > 1 ? ` to ${recipients.length}` : ''}`}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.85rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{heading}</div>
        <div>
          <div style={label}>To</div>
          <TeammateEmailChips users={users} value={to} onPick={(e) => setTo(e)} leading={leading} />
          <input style={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, another@example.com" aria-label="Recipients" />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>Tap a chip to fill, or type any addresses — comma separated, up to ten. The first is To, the rest are CC.</div>
        </div>
        <div>
          <div style={label}>Note</div>
          <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — a line above the attachment" />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.7rem', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 7, fontSize: '0.8rem' }}>
          <span aria-hidden>📎</span>
          <b>{filenameHint}</b>
          <span style={{ color: 'var(--text-muted)' }}>· the copy the customer received{signerName ? `, signed by ${signerName}` : ''}</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Replies come to you. Sending a copy never changes the agreement or the customer&apos;s link, and the job&apos;s activity records who got it.</div>
      </div>
    </ResponsiveModalShell>
  )
}
