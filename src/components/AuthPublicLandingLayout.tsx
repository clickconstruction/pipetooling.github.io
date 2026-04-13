import type { ReactNode } from 'react'
import './authPublicLanding.css'

export default function AuthPublicLandingLayout({ children }: { children: ReactNode }) {
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
              aria-label="Visit Click Plumbing (opens in new tab)"
            >
              PipeTooling joins Click
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
