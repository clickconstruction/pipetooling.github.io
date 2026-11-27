import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  type ProofLine,
  type ProofOwnPeople,
  type SiteProof as Proof,
  SITE_PROOF_WORDS as W,
  asOfWords,
  ownPeopleWords,
  proofCountSentence,
  proofDraws,
  proofHeading,
} from '../../lib/addresses/siteProof'
import type { SecrecySite } from '../../lib/addresses/siteSecrecy'
import { type SiteSecrecyIo, supabaseSiteSecrecyIo } from '../../lib/addresses/siteSecrecyIo'
import { printRootCss } from '../../lib/printRoot'
import { plainSentence } from '../../lib/valuesInPlace'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * **The proof** for a site's client (punch list #439, piece 5, part 5a), under **Papers for this site** on a
 * development's page. It counts the companies that signed and the ones asked, and **Make the packet** opens the
 * packet as it prints: the client, the site, each company that signed with who signed and the day, each company
 * asked and not yet signed, and our own people as a count. **Print** prints the packet alone.
 *
 * The companies come from the rows the section above already read. Our own people's count is the site's secrecy,
 * read when the packet opens: a help, so a count that cannot be read is said and never guessed, and a site whose
 * secrecy is off says nothing of them.
 *
 * It reads and writes nothing. The signed copies, **Download** and **Send to the client** are part 5b.
 */

const ROOT = 'site-proof-print'
const heading: CSSProperties = { margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
// A word that is a press takes a finger: 44 px tall.
const linkPress: CSSProperties = { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, border: 'none', background: 'transparent', padding: '0 0.5rem 0 0', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem' }
const plainPress: CSSProperties = { minHeight: 44, padding: '0.5rem 0.9rem', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const bluePress: CSSProperties = { ...plainPress, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
const sheetHead: CSSProperties = { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)' }
const part: CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.1rem 0.75rem', padding: '0.4rem 0', borderTop: '1px solid var(--border)', breakInside: 'avoid' }
const sub: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', overflowWrap: 'anywhere' }

export interface SiteProofProps {
  proof: Proof
  /** The client the proof is for, when the page knows one. */
  clientName?: string | null
  /** The site's name as the page shows it. */
  siteName?: string | null
  /** The site, for the count of our own people. */
  site: SecrecySite
  /** The company's day, `YYYY-MM-DD`. */
  todayYmd: string
  /** The reads of the site's secrecy. A smoke hands a fake. */
  io?: SiteSecrecyIo
}

/** The count of our own people for the packet: secrecy off says nothing, a count that fails is said. */
async function readOwnPeople(io: SiteSecrecyIo, site: SecrecySite): Promise<ProofOwnPeople> {
  const live = await io.readLive(site).catch(() => 'unread' as const)
  if (live === 'unread') return { kind: 'unread' }
  if (live === 'not-there' || live == null) return { kind: 'not-asked' }
  try {
    const [counts, reach] = await Promise.all([io.readCounts(live.id), io.preview(site)])
    return counts.signed == null ? { kind: 'unread' } : { kind: 'counted', signed: counts.signed, asked: Math.max(reach.people, counts.signed) }
  } catch {
    return { kind: 'unread' }
  }
}

function Lines({ lines, signerLabel, dayLabel }: { lines: ReadonlyArray<ProofLine>; signerLabel: string; dayLabel: string }) {
  return (
    <div>
      {lines.map((l) => (
        <div key={l.id} style={row} data-testid="site-proof-row">
          <div style={{ minWidth: 0, flex: '1 1 14rem' }}>
            <b style={{ color: 'var(--text-strong)', fontSize: '0.875rem' }}>{l.company}</b>
            <span style={sub}>{l.signer ? `${signerLabel} ${l.signer}` : l.paper}</span>
            {l.signer ? <span style={sub}>{l.paper}</span> : null}
          </div>
          <span style={{ color: 'var(--text-strong)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{l.day ? `${dayLabel} ${l.day}` : ''}</span>
        </div>
      ))}
    </div>
  )
}

export function SiteProof({ proof, clientName, siteName, site, todayYmd, io = supabaseSiteSecrecyIo }: SiteProofProps) {
  const [open, setOpen] = useState(false)
  const [own, setOwn] = useState<ProofOwnPeople | null>(null)
  const siteKey = 'developmentId' in site ? `d:${site.developmentId}` : `a:${site.address}`

  // The count of our own people, once the packet is open.
  useEffect(() => {
    if (!open) return
    let mine = true
    setOwn(null)
    void readOwnPeople(io, site).then((o) => mine && setOwn(o))
    return () => {
      mine = false
    }
    // The site is read by its key: the object is new on every draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, io, siteKey])

  // Escape closes the packet.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!proofDraws(proof)) return null
  const title = proofHeading(clientName)
  const ownWords = own ? ownPeopleWords(own) : null
  const site_ = (siteName ?? '').trim()

  return (
    <div data-testid="site-proof" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
      <h4 style={heading}>{title}</h4>
      <p style={muted} data-testid="site-proof-count">
        <ValueSentence text={proofCountSentence(proof)} />
      </p>
      <p style={muted}>{W.lead}</p>
      <button type="button" style={linkPress} onClick={() => setOpen(true)}>
        {W.make}
      </button>
      {open
        ? createPortal(
            <div className={ROOT} data-theme="light" style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', justifyContent: 'center', overflow: 'auto', padding: '16px 12px 40px' }}>
              <style>{`${printRootCss(ROOT)} @media print { .site-proof-chrome { display: none !important; } .site-proof-sheet { box-shadow: none !important; width: auto !important; max-width: none !important; border-radius: 0 !important; padding: 0 !important; } }`}</style>
              <div role="dialog" aria-modal="true" aria-label={W.windowLabel} style={{ display: 'grid', gap: 10, alignContent: 'start', width: 816, maxWidth: '100%' }}>
                <div className="site-proof-chrome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '8px 12px' }}>
                  <b>{W.windowLabel}</b>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setOpen(false)} style={plainPress}>
                      {W.close}
                    </button>
                    <button type="button" onClick={() => window.print()} style={bluePress}>
                      {W.print}
                    </button>
                  </div>
                </div>
                <div className="site-proof-sheet" data-testid="site-proof-sheet" style={{ background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box', width: '100%', borderRadius: 8, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)', padding: 'clamp(16px, 5vw, 48px)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h2 style={sheetHead}>{title}</h2>
                  {site_ ? <p style={muted}>{site_}</p> : null}
                  <p style={muted} data-testid="site-proof-sheet-count">
                    {plainSentence(proofCountSentence(proof))}
                  </p>

                  <h3 style={part}>{W.signed}</h3>
                  {proof.signed.length > 0 ? <Lines lines={proof.signed} signerLabel={W.columns.signer} dayLabel={W.columns.signedDay} /> : <p style={muted}>{W.nobodySigned}</p>}

                  {proof.asked.length > 0 ? (
                    <>
                      <h3 style={part}>{W.asked}</h3>
                      <Lines lines={proof.asked} signerLabel={W.columns.askedOf} dayLabel={W.columns.sentDay} />
                    </>
                  ) : null}

                  {ownWords ? (
                    <>
                      <h3 style={part}>{W.ownPeople}</h3>
                      <p style={{ ...muted, color: 'var(--text-strong)' }} data-testid="site-proof-own-people">
                        {ownWords}
                      </p>
                    </>
                  ) : null}

                  <p style={{ ...muted, borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.4rem' }} data-testid="site-proof-foot">
                    {asOfWords(todayYmd)} {W.listAlone}
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export default SiteProof
