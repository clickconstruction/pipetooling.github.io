/**
 * Cards and footers (punch list #313) — where the kit's pictures and its type live under `public/`.
 *
 * Paths are from the app's base, with no leading slash: a caller puts `import.meta.env.BASE_URL`
 * in front. The type is Lexend, an open font (SIL Open Font License, `public/fonts/Lexend-OFL.txt`),
 * in the two weights the designs use. The two pictures wait on the designer: the mark is a
 * cut-out from the largest file on hand, and the pipe photo still has the designer's own logo
 * in it under the logo the kit draws.
 */
import type { KitAsset, KitWeight } from './layouts'

export const KIT_ASSET_PATHS: Record<KitAsset, string> = {
  mark: 'brand/click-mark-on-dark.png',
  cardFrontPhoto: 'brand/card-front-photo.jpg',
}

export const KIT_FONT_FAMILY = 'Lexend'

export const KIT_FONT_FILES: { weight: KitWeight; cssWeight: number; path: string }[] = [
  { weight: 'light', cssWeight: 300, path: 'fonts/Lexend-Light.woff2' },
  { weight: 'bold', cssWeight: 700, path: 'fonts/Lexend-Bold.woff2' },
]
