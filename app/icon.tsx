import { ImageResponse } from 'next/og'

export const size = {
  width: 64,
  height: 64,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#B2071D',
          borderRadius: '12px',
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="27" cy="27" r="12" stroke="white" strokeWidth="4" fill="none" />
          <line x1="35" y1="35" x2="48" y2="48" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
