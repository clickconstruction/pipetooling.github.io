import type { ReactNode } from 'react'
import './authPublicLanding.css'

const DEFAULT_TITLE_LINK_TEXT = 'PipeTooling joins Click'

const DEFAULT_TITLE_ARIA_LABEL = 'Visit Click Plumbing (opens in new tab)'

export type AuthPublicLandingLayoutProps = {
  children: ReactNode
  /** Overrides the main heading link text (e.g. public estimate accept). */
  titleLinkText?: string
  /** When the visible title differs from the default, set for a consistent accessible name. */
  titleLinkAriaLabel?: string
}

export default function AuthPublicLandingLayout({
  children,
  titleLinkText = DEFAULT_TITLE_LINK_TEXT,
  titleLinkAriaLabel = DEFAULT_TITLE_ARIA_LABEL,
}: AuthPublicLandingLayoutProps) {
  return (
    <div className="auth-public-landing">
      <div className="container">
        <div className="letter-header">
          <h1>
            <a
              href="https://clickplumbing.com"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-public-landing__title-link"
              aria-label={titleLinkAriaLabel}
            >
              {titleLinkText}
            </a>
          </h1>
        </div>
        <div className="letter-content">
          <ul className="auth-service-icons" aria-label="Service highlights">
            <li className="auth-service-icon">
              <i className="fas fa-wrench" aria-hidden />
              <span>Plumbing</span>
            </li>
            <li className="auth-service-icon auth-service-icon--electrical">
              <i className="fas fa-bolt" aria-hidden />
              <span>Electrical</span>
            </li>
            <li className="auth-service-icon auth-service-icon--hvac">
              <i className="fas fa-thermometer-half" aria-hidden />
              <span>HVAC</span>
            </li>
          </ul>
        </div>
        {children}
      </div>
    </div>
  )
}
