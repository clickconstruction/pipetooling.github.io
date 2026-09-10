import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { phoneContact } from '../lib/phoneContact'

/**
 * The app's one call button (Customer Waiting, v2.3247). On a phone (coarse
 * pointer) it is a real `tel:` / `sms:` link; on a desktop, where a tel: link
 * does nothing, the same button copies the number and says so — a green
 * button that silently no-ops is worse than none. `onUsed` fires either way,
 * so the caller can log the call (📞 note + last_called stamp).
 *
 * Renders nothing when the number is not dialable — the caller decides what
 * to show instead ("No number on file").
 */
export function CallPhoneButton({
  phone,
  mode = 'call',
  size = 'small',
  onUsed,
  style,
  ariaLabel,
}: {
  phone: string | null | undefined
  mode?: 'call' | 'text'
  size?: 'small' | 'big'
  onUsed?: () => void
  style?: CSSProperties
  ariaLabel?: string
}) {
  const { showToast } = useToastContext()
  const [copied, setCopied] = useState(false)
  const contact = phoneContact(phone)
  if (!contact) return null

  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const href = mode === 'text' ? contact.smsHref : contact.telHref
  const icon = mode === 'text' ? '💬' : '📞'
  const verb = mode === 'text' ? 'Text' : 'Call'
  const label = size === 'big' ? `${verb} ${contact.display}` : mode === 'text' ? 'Text' : coarse ? 'Call' : contact.display
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: size === 'big' ? '0.65rem 1rem' : '0.35rem 0.75rem',
    borderRadius: size === 'big' ? 8 : 6,
    fontSize: size === 'big' ? '1rem' : '0.875rem',
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...(mode === 'call'
      ? { background: '#15803d', color: '#fff', border: '1px solid #15803d' }
      : { background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)' }),
    ...(size === 'big' ? { width: '100%' } : null),
    ...style,
  }
  const a11y = ariaLabel ?? `${verb} ${contact.display}`

  if (coarse) {
    return (
      <a href={href} aria-label={a11y} title={a11y} style={base} onClick={() => onUsed?.()}>
        <span aria-hidden>{icon}</span>
        {label}
      </a>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contact.e164)
      setCopied(true)
      showToast(`Copied ${contact.display}`, 'success')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast(contact.display, 'info')
    }
    onUsed?.()
  }
  return (
    <button type="button" onClick={() => void copy()} aria-label={`${a11y} — copies the number`} title={`${contact.display} · click to copy`} style={base}>
      <span aria-hidden>{icon}</span>
      {copied ? 'Copied' : label}
    </button>
  )
}
