/**
 * Thrown when the lens's world meets a request it cannot read yet (punch list #194). The engine
 * answers it as an error, so the page draws its own error words, and lists it as a gap: the
 * request is named, so the fix is to teach the reader, never to special-case the page.
 */
export class LensUnsupported extends Error {
  constructor(detail: string) {
    super(`The lens cannot read this request yet: ${detail}`)
    this.name = 'LensUnsupported'
  }
}
