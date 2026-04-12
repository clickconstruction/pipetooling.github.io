import { estimateTermsPageHref } from '../../lib/estimateTermsPageHref'

export default function EstimateTermsHeaderNotice() {
  const href = estimateTermsPageHref()
  return (
    <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', textAlign: 'center' }}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Terms and Conditions
      </a>
      .
    </p>
  )
}
