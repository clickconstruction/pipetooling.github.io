/**
 * Lien desk → In the envelope, as one card (v2.7427, Taunya's ask of 2026-11-15, to the drawing she
 * approved). Left: who the paper goes to, a labelled row each. Right: what rides with the notice, one
 * tick per row with its amount at the right and counsel's caution under the tick it is about. Foot:
 * the key to the shaded boxes and the preview door. The halves sit side by side from a card 620 px
 * wide and stack under it (`.lienEnvelope` in index.css, a container query on the card's own width).
 * It holds no state: the desk owns every tick.
 */
export interface LienEnvelopeTick {
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}

export interface LienEnvelopeCardProps {
  /** The owner of record, or the words that stand in for one. */
  ownerName: string
  /** The original contractor, or the words that stand in for one. */
  contractorName: string
  /** Where the contractor's courtesy PDF goes; null when we have no address. */
  courtesyEmail: string | null
  cover: LienEnvelopeTick & { title: string }
  /** Drawn only while the letter is on and a house is owed; `unread` draws counsel's caution under it. */
  houses: (LienEnvelopeTick & { count: number; amount: string; unread: boolean }) | null
  /** Drawn only while the letter is on and there is a claim; `unread` draws counsel's caution under it. */
  release: (LienEnvelopeTick & { amount: string; unread: boolean }) | null
  /** The sentence that stands in for the key once the wording is locked; null while it may change. */
  lockedWords: string | null
  onPreview: () => void
}

const HOUSES_TITLE = 'A paragraph at the end of counsel\'s letter: the house, what it is owed, the day its own notice goes out, that it is a separate claim our release does not cover, and that paying us is what clears it'
const RELEASE_TITLE = 'The app\'s § 53.284 conditional release, prefilled from the notice — the claim as the amount, the GC as the check\'s maker — behind the owner\'s letter and the GC\'s form, named in the letter; a draft on the job now, issued when the run is recorded'
const UNREAD = 'Counsel has not read this paragraph yet.'

export function LienEnvelopeCard({ ownerName, contractorName, courtesyEmail, cover, houses, release, lockedWords, onPreview }: LienEnvelopeCardProps) {
  return (
    <div className="lienEnvelope" data-lien-desk-send-line>
      <div className="lienEnvelopeGrid">
        <div className="lienEnvelopeZone" data-lien-envelope-zone="to">
          <div className="lienEnvelopeTitle">Goes to · certified mail</div>
          <dl className="lienEnvelopeWho">
            <dt>Owner</dt>
            <dd>
              <strong>{ownerName}</strong>
            </dd>
            <dt>Contractor</dt>
            <dd>
              <strong>{contractorName}</strong>
              {courtesyEmail ? <span>and a courtesy PDF to {courtesyEmail}</span> : null}
            </dd>
          </dl>
        </div>
        <div className="lienEnvelopeZone" data-lien-envelope-zone="with">
          <div className="lienEnvelopeTitle">With the notice</div>
          <div className="lienEnvelopeTicks">
            <div className="lienEnvelopeTick" data-lien-envelope-tick="cover" data-on={cover.checked ? 'yes' : 'no'}>
              <label title={cover.title}>
                <input type="checkbox" checked={cover.checked} disabled={cover.disabled} onChange={(ev) => cover.onChange(ev.target.checked)} />
                <span className="lienEnvelopeTickWords">Counsel's cover letter</span>
                {cover.checked ? <span className="lienEnvelopeTickPage">page 1</span> : null}
              </label>
            </div>
            {houses ? (
              <div className="lienEnvelopeTick" data-lien-envelope-tick="houses" data-on={houses.checked ? 'yes' : 'no'}>
                <label data-lien-desk-houses-tick title={HOUSES_TITLE}>
                  <input type="checkbox" checked={houses.checked} disabled={houses.disabled} onChange={(ev) => houses.onChange(ev.target.checked)} />
                  <span className="lienEnvelopeTickWords">Name the supply {houses.count === 1 ? 'house' : 'houses'} owed</span>
                  <span className="lienEnvelopeTickAmount">{houses.amount}</span>
                </label>
                {houses.unread ? (
                  <span className="lienEnvelopeTickNote" data-lien-desk-houses-counsel>
                    {UNREAD}
                  </span>
                ) : null}
              </div>
            ) : null}
            {release ? (
              <div className="lienEnvelopeTick" data-lien-envelope-tick="release" data-on={release.checked ? 'yes' : 'no'}>
                <label data-lien-desk-release-tick title={RELEASE_TITLE}>
                  <input type="checkbox" checked={release.checked} disabled={release.disabled} onChange={(ev) => release.onChange(ev.target.checked)} />
                  <span className="lienEnvelopeTickWords">A conditional release</span>
                  <span className="lienEnvelopeTickAmount">{release.amount}</span>
                </label>
                {release.unread ? (
                  <span className="lienEnvelopeTickNote" data-lien-desk-release-counsel>
                    {UNREAD}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {/* The paper is the editor (v2.3694): the values the office may change sit in shaded boxes on the notice itself; this line keeps the key and the preview door. */}
      <div className="lienEnvelopeFoot" data-lien-desk-paper-legend>
        {lockedWords ? (
          <span>{lockedWords}</span>
        ) : (
          <span>
            <span aria-hidden="true" className="lienEnvelopeSwatch" />A shaded box on the paper is yours to change. Hover says where the rest came from.
          </span>
        )}
        <button type="button" onClick={onPreview} className="lienEnvelopePreview" title="The notice as the packet prints it, in its own tab, with the values you can change marked">
          Preview in a new window ↗
        </button>
      </div>
    </div>
  )
}
