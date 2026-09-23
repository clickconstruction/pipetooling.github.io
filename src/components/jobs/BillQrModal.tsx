import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useToastContext } from '../../contexts/ToastContext'
import { payLinkDisplay, payLinkUrl } from '../../lib/billing/payLink'
import { brandMarkPath, loadBrandMarkDataUrl, payQrPngDataUrl, payQrProps, payQrSheetHtml, payQrSvgMarkup } from '../../lib/billing/payQr'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'

/**
 * The fourth Payment Link (punch list #35, v2.3757): the bill's pay code, large enough to
 * scan off a screen — a customer at the counter, a phone held up in the field, a sheet to
 * leave with a bill. The code carries `/pay/<bill id>` (v2.3754), the address that fetches
 * Stripe's current link at scan time, so a printout stays good after Stripe's link rolls.
 * Copy image puts the PNG on the clipboard for a text or an email body; Download PNG for a
 * flyer or a Google Doc; Print opens a half-sheet.
 */

export const BILL_QR_SIZE = 240
const PNG_PX = 720

export function BillQrModal({
  open,
  onClose,
  invoiceId,
  billLabel,
  jobName,
  amountLabel,
  company = 'Click Plumbing and Electrical',
  overlayZIndex = 1300,
}: {
  open: boolean
  onClose: () => void
  /** `jobs_ledger_invoices.id` — the address is built from it. */
  invoiceId: string
  /** "Invoice #1025-2609180905", or "Bill" when the number is not known. */
  billLabel: string
  jobName: string | null
  /** What is still owed, "$4,660.00"; '' hides the line. */
  amountLabel: string
  company?: string
  /** Above Bill Customer (1020), View bill stacks, etc. */
  overlayZIndex?: number
}) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState<'copy' | 'download' | 'print' | null>(null)
  const url = payLinkUrl(invoiceId)
  const address = payLinkDisplay(invoiceId)
  const fileStem = `pay-code-${billLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || invoiceId.slice(0, 8)}`

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function copyImage() {
    setBusy('copy')
    try {
      const dataUrl = await payQrPngDataUrl(invoiceId, PNG_PX)
      const blob = await (await fetch(dataUrl)).blob()
      const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      if (!Item || !navigator.clipboard?.write) throw new Error('no image clipboard')
      await navigator.clipboard.write([new Item({ 'image/png': blob })])
      showToast('Pay code copied — paste it into a text or an email', 'success')
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        showToast('This browser cannot copy an image — the pay address was copied instead', 'warning')
      } catch {
        showToast('Could not copy', 'error')
      }
    } finally {
      setBusy(null)
    }
  }

  async function downloadPng() {
    setBusy('download')
    try {
      const dataUrl = await payQrPngDataUrl(invoiceId, PNG_PX)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${fileStem}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      showToast('Could not build the image', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function print() {
    setBusy('print')
    try {
      const svg = await payQrSvgMarkup(url, 300, await loadBrandMarkDataUrl())
      const ok = openHtmlPrintWindow(payQrSheetHtml({ company, billLabel, jobName: jobName ?? '', amountLabel, invoiceId, svg }))
      if (!ok) showToast('The print window was blocked — allow pop-ups for this site', 'error')
    } finally {
      setBusy(null)
    }
  }

  const btn = (label: string, onClick: () => void, key: typeof busy, primary = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy != null}
      style={{
        padding: '0.5rem 0.9rem',
        border: primary ? 'none' : '1px solid var(--border-strong)',
        background: primary ? '#2563eb' : 'var(--surface)',
        color: primary ? 'white' : 'var(--text-link)',
        borderRadius: 6,
        cursor: busy ? 'default' : 'pointer',
        fontSize: '0.875rem',
        fontWeight: 600,
        opacity: busy && busy !== key ? 0.6 : 1,
      }}
    >
      {busy === key ? '…' : label}
    </button>
  )

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: overlayZIndex, padding: '1rem' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-qr-title"
        data-testid="bill-qr-modal"
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', padding: '0.9rem 1rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="bill-qr-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            Scan to pay
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'right' }}>{billLabel}</span>
        </div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: '0.5rem', padding: '1rem 1rem 0.5rem' }}>
          {/* The code is paper: black on white whatever the theme, so a camera reads it. */}
          <div data-theme="light" style={{ background: 'var(--surface)', padding: 8, borderRadius: 8, lineHeight: 0 }}>
            <QRCodeSVG {...payQrProps(url, BILL_QR_SIZE, brandMarkPath())} aria-label={`Pay code for ${billLabel}`} data-testid="bill-qr-code" />
          </div>
          {jobName ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobName}</div> : null}
          {amountLabel ? (
            <div style={{ fontSize: '0.95rem' }}>
              Still owed <strong style={{ fontSize: '1.05rem' }}>{amountLabel}</strong>
            </div>
          ) : null}
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all', textAlign: 'center' }} data-testid="bill-qr-address">
            {address}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.45 }}>
            Opens the bill's secure payment page. The address stays good until the bill is paid — it fetches Stripe's current link when scanned.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          {btn('Copy image', () => void copyImage(), 'copy', true)}
          {btn('Download PNG', () => void downloadPng(), 'download')}
          {btn('Print', () => void print(), 'print')}
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
