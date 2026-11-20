import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

/** The class every line above the header draws in. `index.css` holds its rules. */
export const APP_TOP_BANNER_CLASS = 'appTopBanner'

/** A banner's own look. Its padding is `padY` and `padX`, never a style: an inline padding would beat the class and lose the status bar's room. */
export type AppTopBannerStyle = Omit<
  CSSProperties,
  'padding' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft' | 'paddingBlock' | 'paddingBlockStart' | 'paddingInline'
>

type AppTopBannerProps = Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'className'> & {
  /** The room above and below the words. The class adds the status bar to the top of the first line showing. */
  padY?: string
  /** The room left and right of the words. */
  padX?: string
  style?: AppTopBannerStyle
  children: ReactNode
}

/**
 * One line above the header (v2.8053): the digital twin line, training mode, Customer Waiting, the
 * Add Task offer. `Layout` mounts them before `.appNavChrome`, so on a Home Screen iPhone the first
 * one showing starts at the top of the glass, under the status bar and the camera.
 *
 * The first line showing pays the top inset on top of its own padding, and its colour runs up under
 * the status bar. Every line after it, the View-as strip and the header under them pay none. The
 * rules are `.appTopBanner` in `index.css`; they read the siblings, so every line must be a direct
 * child of the Layout's root, before the header. The inset is 0px in a browser tab and on Android.
 */
export function AppTopBanner({ padY = '0.4rem', padX = '1rem', style, children, ...rest }: AppTopBannerProps) {
  return (
    <div
      {...rest}
      className={APP_TOP_BANNER_CLASS}
      style={{ ...style, ['--app-top-banner-pad-y' as string]: padY, ['--app-top-banner-pad-x' as string]: padX }}
    >
      {children}
    </div>
  )
}
