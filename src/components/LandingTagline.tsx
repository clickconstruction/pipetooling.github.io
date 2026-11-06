/**
 * The ClickTooling tagline on the sign-in page (v2.6503, the owner's pick of five placements; v2.6575, Grace's
 * pick of three treatments): one lockup with the pipe title on a glass plate. A short rule in the handwheels'
 * red, the truth as a small spaced caption, the promise as the one serif line, bold.
 */
const TAGLINE_BEAT_ONE = 'Changes are constant.'
const TAGLINE_BEAT_TWO = 'ClickTooling keeps you moving.'

export function LandingTagline() {
  return (
    <p className="auth-public-landing__tagline">
      <span className="auth-public-landing__tagline-rule" aria-hidden="true" />
      <span className="auth-public-landing__tagline-one">{TAGLINE_BEAT_ONE}</span>{' '}
      <span className="auth-public-landing__tagline-two">{TAGLINE_BEAT_TWO}</span>
    </p>
  )
}
