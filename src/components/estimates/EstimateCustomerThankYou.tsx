export type EstimateCustomerThankYouProps = {
  /** Shown in staff preview only */
  previewBanner?: string
  title?: string
  body?: string
}

export default function EstimateCustomerThankYou({
  previewBanner,
  title = 'Thank you',
  body = 'Your response has been recorded. The contractor will follow up with you.',
}: EstimateCustomerThankYouProps) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      {previewBanner ? (
        <p
          style={{
            margin: '0 0 1rem',
            fontSize: '0.85rem',
            color: '#6b7280',
            background: '#f9fafb',
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
          }}
        >
          {previewBanner}
        </p>
      ) : null}
      <h1 style={{ color: '#166534' }}>{title}</h1>
      <p>{body}</p>
    </div>
  )
}
