const DEFAULT_THANK_YOU_BODY =
  'Your response has been recorded. The contractor will follow up with you. We are excited to see you soon.'

export type EstimateCustomerThankYouProps = {
  /** Shown in staff preview only */
  previewBanner?: string
  title?: string
  body?: string
}

export default function EstimateCustomerThankYou({
  previewBanner,
  title = 'Thank you',
  body = DEFAULT_THANK_YOU_BODY,
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#166534', margin: '0 0 0.75rem' }}>{title}</h1>
        <p style={{ margin: '0 0 1.25rem', lineHeight: 1.5 }}>{body}</p>
        <img
          src={`${import.meta.env.BASE_URL}chick.png`}
          alt=""
          style={{ maxWidth: 320, width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
