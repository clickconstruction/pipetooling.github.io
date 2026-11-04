/**
 * The ClickTooling tagline on the sign-in page (v2.6503, the owner's pick of five placements):
 * two beats under the pipe title, a truth set light and the promise set bold.
 */
const TAGLINE_BEAT_ONE = 'Changes are constant.'
const TAGLINE_BEAT_TWO = 'ClickTooling keeps you paid.'

export function LandingTagline() {
  return (
    <p className="auth-public-landing__tagline">
      <span className="auth-public-landing__tagline-one">{TAGLINE_BEAT_ONE}</span>{' '}
      <span className="auth-public-landing__tagline-two">{TAGLINE_BEAT_TWO}</span>
    </p>
  )
}
