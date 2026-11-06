/** Spike #270: the label on the machine, the box label's twin — the unit number, a QR to `/m/<code>`, the words. */
import { QRCodeSVG } from 'qrcode.react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import { type Machine } from '../../lib/machines/machines'

function machineLabelUrl(m: Machine): string {
  return `${window.location.origin}/m/${m.code}`
}

export function MachineLabelModal({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const url = machineLabelUrl(machine)
  return (
    <ResponsiveModalShell title={`Label · ${machine.unitLabel}`} onRequestClose={onClose} maxWidthDesktop={420} footer={<div style={S.footerRow}><button type="button" style={S.secondaryBtn} onClick={onClose}>Close</button><button type="button" style={S.primaryBtn} onClick={() => window.print()}>Print</button></div>}>
      <div data-theme="light" style={{ margin: '0.5rem auto', width: 260, border: '3px solid var(--text-strong)', borderRadius: 10, padding: 12, background: 'var(--surface)', color: 'var(--text-strong)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 34, fontWeight: 800, letterSpacing: '.04em' }}>{machine.unitLabel}</div>
        <div style={{ margin: '6px auto' }}>
          <QRCodeSVG value={url} size={140} level="M" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{machine.make} {machine.model} · check it before you run it</div>
        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'var(--text-700)', marginTop: 4, wordBreak: 'break-all' }}>{url.replace(/^https?:\/\//, '')}</div>
      </div>
      <p style={S.muted}>Scanning it with the phone’s camera opens this machine’s check. For real it points at prts.co like a box label; the spike points at this app.</p>
    </ResponsiveModalShell>
  )
}

export default MachineLabelModal
