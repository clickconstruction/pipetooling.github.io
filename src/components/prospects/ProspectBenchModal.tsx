import { useState } from 'react'
import { PROSPECT_LANGS, parseTradesText, tradesText, type BenchDraft } from '../../lib/prospects/prospectKinds'
import { BENCH_SAVE, BENCH_SAVE_AND_ASK, benchAskWords, type BenchAsk } from '../../lib/prospects/benchAsk'

/**
 * Add to the bench ✓ (v2.5559, punch list #110): the bench's own Add a company, filled from the
 * sub's card. Save sends `gc_add_company`'s draft; the page marks the prospect and moves on. The
 * company is new to us unless the caller ticks that we have worked with them, as on Trade partners.
 * Since v2.5810 a run that names a job offers one tick: ask them to quote it now, the ask Trade
 * partners makes, so the sub is asked four presses from the plans landing.
 */
export function ProspectBenchModal({
  draft,
  saving,
  error,
  onSave,
  onCancel,
  ask = null,
}: {
  draft: BenchDraft
  saving: boolean
  error: string | null
  onSave: (draft: BenchDraft, askNow: boolean) => void
  onCancel: () => void
  /** The job to ask them on, when the landing comes from a run that names one. Null: no tick. */
  ask?: BenchAsk | null
}) {
  const [name, setName] = useState(draft.name)
  const [contact, setContact] = useState(draft.contactName)
  const [phone, setPhone] = useState(draft.phone)
  const [email, setEmail] = useState(draft.email)
  const [address, setAddress] = useState(draft.address)
  const [trades, setTrades] = useState(tradesText(draft.trades))
  const [maxMiles, setMaxMiles] = useState(draft.maxMiles == null ? '' : String(draft.maxMiles))
  const [lang, setLang] = useState<'en' | 'es'>(draft.lang ?? 'en')
  const [known, setKnown] = useState(draft.known)
  const [license, setLicense] = useState(draft.license ?? '')
  const [mapsUrl, setMapsUrl] = useState(draft.mapsUrl ?? '')
  const [askNow, setAskNow] = useState(!!ask)
  const [problem, setProblem] = useState<string | null>(null)

  const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
  const labelStyle = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' } as const

  const save = () => {
    const tradeList = parseTradesText(trades)
    if (!name.trim()) {
      setProblem('Give the company a name.')
      return
    }
    if (tradeList.length === 0) {
      setProblem('Name the trade they do.')
      return
    }
    const miles = Number(maxMiles)
    setProblem(null)
    onSave(
      {
        name: name.trim(),
        trades: tradeList,
        contactName: contact.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        maxMiles: Number.isFinite(miles) && miles > 0 ? Math.round(miles) : null,
        known,
        lang,
        ...(license.trim() ? { license: license.trim() } : {}),
        ...(mapsUrl.trim() ? { mapsUrl: mapsUrl.trim() } : {}),
      },
      !!ask && askNow,
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 750,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={() => !saving && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-bench-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 440,
          width: '90%',
          maxHeight: 'min(90vh, 100%)',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="prospect-bench-title" style={{ margin: '0 0 0.25rem 0' }}>Add a company</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          From the prospect. They can quote at once; an award waits for vetting on Trade partners.
        </p>
        {(problem || error) && (
          <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{problem || error}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            <span style={labelStyle}>Company</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Contact</span>
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Phone</span>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Address</span>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>License</span>
            <input type="text" value={license} onChange={(e) => setLicense(e.target.value)} style={inputStyle} placeholder="TX SCR-1884" />
          </label>
          <label>
            <span style={labelStyle}>Google Maps</span>
            <input type="text" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} style={inputStyle} placeholder="https://maps.app.goo.gl/…" />
          </label>
          <label>
            <span style={labelStyle}>
              Trades <span style={{ color: 'var(--text-muted)' }}>— the bench's names, a comma between two</span>
            </span>
            <input type="text" value={trades} onChange={(e) => setTrades(e.target.value)} style={inputStyle} placeholder="Concrete, Fire sprinkler" />
          </label>
          <label>
            <span style={labelStyle}>Goes up to (miles)</span>
            <input type="number" min={1} value={maxMiles} onChange={(e) => setMaxMiles(e.target.value)} style={inputStyle} placeholder="no limit" />
          </label>
          <div>
            <span style={labelStyle}>Language</span>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
              {PROSPECT_LANGS.map((l) => (
                <label key={l.lang} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input type="radio" name="prospect-bench-lang" checked={lang === l.lang} onChange={() => setLang(l.lang)} />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
          <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
            <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} />
            We have worked with them before
          </label>
          {ask && (
            <label data-bench-ask style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.875rem', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-blue-tint)', border: '1px solid var(--border)' }}>
              <input type="checkbox" checked={askNow} onChange={(e) => setAskNow(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <b>{benchAskWords(ask)}</b>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>The ask Trade partners makes. The invitation goes out as asks do today.</span>
              </span>
            </label>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : ask && askNow ? BENCH_SAVE_AND_ASK : BENCH_SAVE}
          </button>
          <button
            type="button"
            onClick={() => !saving && onCancel()}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
