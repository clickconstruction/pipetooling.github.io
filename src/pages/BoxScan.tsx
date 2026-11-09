/**
 * Scan a label (punch list #294, v2.6799): the page bare `prts.co` lands on, outside the sign-in. Point the camera at a
 * label and its own page opens; or type the code under the QR; or, on a phone that scanned a box in the last day, find a
 * part on that site without a second scan. A signed-in person goes to the On site tab, which has the app's own search.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { boxPageCode, boxPageFindPath, boxPageNoun, boxPagePath } from '../lib/materials/boxPage'
import { readLastBox, typedCodeWords } from '../lib/materials/boxPageMemory'
import { boxPageKind } from '../lib/materials/boxPage'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../lib/portal/portalTheme'

export default function BoxScan() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [slip, setSlip] = useState<string | null>(null)
  const last = useMemo(() => readLastBox(), [])
  if (loading) return null
  if (user) return <Navigate to="/tally?tab=on-site" replace />

  const open = (e: FormEvent) => {
    e.preventDefault()
    const code = boxPageCode(typed)
    if (!code) {
      setSlip('Type all eight characters under the QR code.')
      return
    }
    navigate(boxPagePath(code))
  }

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '1.25rem 1rem 3rem', display: 'grid', justifyItems: 'center', alignContent: 'start' }}>
      <main style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '0.9rem' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER }}>Click Plumbing &amp; Electrical</div>
        <header>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, fontWeight: 800 }}>Scan a label</h1>
          <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 15, lineHeight: 1.5 }}>Point your camera at the label on a cage or box. It opens here. Your camera app reads the code, with nothing to install.</p>
        </header>
        <form onSubmit={open} style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="box-scan-code" style={{ color: MUTED, fontSize: 14 }}>Or type the code under the QR code</label>
          <input
            id="box-scan-code"
            value={typed}
            onChange={(e) => {
              setTyped(typedCodeWords(e.target.value))
              setSlip(null)
            }}
            placeholder="4F2A-9C18"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            style={{ minHeight: 48, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '0 14px', font: 'inherit', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 20, letterSpacing: '0.12em', background: '#fff', color: INK }}
            data-testid="box-scan-input"
          />
          {slip ? <div style={{ color: '#b42318', fontSize: 14 }} data-testid="box-scan-slip">{slip}</div> : null}
          <button type="submit" style={press} data-testid="box-scan-open">Open the box</button>
        </form>
        {last ? (
          <section style={{ display: 'grid', gap: 8, marginTop: 6 }} data-testid="box-scan-last">
            <div style={{ textAlign: 'center', color: FAINT, fontSize: 13 }}>You scanned {boxPageNoun(boxPageKind(last.kind))} {last.stencil} today</div>
            <Link to={boxPageFindPath(last.code)} style={{ ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff', textDecoration: 'none' }} data-testid="box-scan-find">
              Find a part on that site
            </Link>
          </section>
        ) : null}
        <p style={{ margin: '10px 0 0', color: FAINT, fontSize: 12.5, lineHeight: 1.45 }}>
          Work here? <Link to="/sign-in" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link> to see every job's boxes.
        </p>
      </main>
    </div>
  )
}

const press: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 16, padding: '0 14px', cursor: 'pointer' }
