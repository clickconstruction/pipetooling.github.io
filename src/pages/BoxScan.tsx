/**
 * Scan a label (punch list #294, v2.6799): the page bare `prts.co` lands on, outside the sign-in. Point the camera at a
 * label and its own page opens, or type the code under the QR. A signed-in person goes to the On site tab, which has
 * the app's own search. Until v2.7379 a phone that had scanned a box that day could search that box's site from here;
 * what is in a box needs a sign-in now, so that press is gone with the search. The tab reads the page's own name since
 * v2.7630, where it read the app's.
 */
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTabTitle } from '../hooks/useTabTitle'
import { boxPageCode, boxPagePath } from '../lib/materials/boxPage'
import { typedCodeWords } from '../lib/materials/boxPageMemory'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../lib/portal/portalTheme'

/** The tab's title, the company after the page as a box's own page has it. */
const BOX_SCAN_TAB_TITLE = 'Scan a label · Click Plumbing & Electrical'

export default function BoxScan() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [slip, setSlip] = useState<string | null>(null)
  // Only the page with no sign-in names the tab: someone signed in leaves for the On site tab at once.
  useTabTitle(!loading && !user ? BOX_SCAN_TAB_TITLE : null)
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
            style={{ minHeight: 48, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '0 14px', font: 'inherit', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 20, letterSpacing: '0.12em', background: 'var(--surface)', color: INK }}
            data-testid="box-scan-input"
          />
          {slip ? <div style={{ color: '#b42318', fontSize: 14 }} data-testid="box-scan-slip">{slip}</div> : null}
          <button type="submit" style={press} data-testid="box-scan-open">Open the box</button>
        </form>
        <p style={{ margin: '10px 0 0', color: FAINT, fontSize: 12.5, lineHeight: 1.45 }}>
          Work here? <Link to="/sign-in" style={{ color: 'var(--text-link)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link> to see every job's boxes.
        </p>
      </main>
    </div>
  )
}

const press: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 16, padding: '0 14px', cursor: 'pointer' }
