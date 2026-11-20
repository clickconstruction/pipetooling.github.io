/**
 * Punch list #389, step 2: the sample of a paper built from settings, as it prints. It is the real paper for a mix of
 * picks, from the same assembly as a signer's copy, with a made-up party and the word SAMPLE across every page. The
 * window is portalled to <body> and prints alone (`lib/printRoot.ts`). Paper is light: `data-theme="light"`.
 */
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { printRootCss } from '../../lib/printRoot'
import { ClausePaper, type ClausePaperView } from './ClausePaper'
import { clauseButtonStyle, clausePrimaryStyle } from './clauseStyles'

const ROOT = 'clause-sample-print'
const MARK: CSSProperties = { position: 'absolute', top: '36%', left: 0, right: 0, textAlign: 'center', transform: 'rotate(-28deg)', fontSize: 132, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(15, 23, 42, 0.08)', pointerEvents: 'none', userSelect: 'none' }
const FACT: CSSProperties = { display: 'grid', gridTemplateColumns: '9rem 1fr', gap: '0.15rem 0.6rem', fontSize: '0.85rem', margin: 0 }

export function ClauseSamplePrint({ paper, mark, stamp, facts, onClose }: { paper: ClausePaperView; /** SAMPLE, in the paper's language. */ mark: string; stamp: string; /** The made-up party, a label and a value a line. */ facts: ReadonlyArray<readonly [string, string]>; onClose: () => void }) {
  return createPortal(
    <div className={ROOT} data-theme="light" style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 'calc(24px + var(--app-top-chrome, 0px)) 12px 24px' }}>
      <style>{`${printRootCss(ROOT)} @media print { .clause-sample-chrome { display: none !important; } .clause-sample-sheet { box-shadow: none !important; width: auto !important; max-width: none !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; } .clause-sample-mark { position: fixed !important; top: 40% !important; } }`}</style>
      <div role="dialog" aria-modal="true" aria-label="The sample, as it prints" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <div className="clause-sample-chrome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, padding: '8px 12px', width: 816, maxWidth: '100%', boxSizing: 'border-box' }}>
          <b>The sample, as it prints</b>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={clauseButtonStyle}>
              Close
            </button>
            <button type="button" onClick={() => window.print()} style={clausePrimaryStyle}>
              Print
            </button>
          </div>
        </div>
        <div className="clause-sample-sheet" data-clause-sample style={{ position: 'relative', overflow: 'hidden', background: 'var(--surface)', color: 'var(--text-strong)', width: 816, maxWidth: '100%', boxSizing: 'border-box', padding: 48, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)', display: 'grid', gap: '0.9rem' }}>
          <div className="clause-sample-mark" data-clause-sample-mark aria-hidden style={MARK}>
            {mark}
          </div>
          <dl style={FACT}>
            {facts.map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
                <dd style={{ margin: 0 }}>{value}</dd>
              </div>
            ))}
          </dl>
          <ClausePaper paper={paper} />
          <p data-clause-sample-stamp style={{ margin: 0, borderTop: '1px solid var(--border)', paddingTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {stamp}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
