import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/x-icon'

export async function GET() {
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
          borderRadius: '6px',
        }}
      >
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
          {/* Magnifying glass circle */}
          <div
            style={{
              position: 'absolute',
              left: '6px',
              top: '6px',
              width: '12px',
              height: '12px',
              border: '2px solid white',
              borderRadius: '50%',
            }}
          />
          {/* Magnifying glass handle */}
          <div
            style={{
              position: 'absolute',
              left: '16px',
              top: '16px',
              width: '10px',
              height: '2px',
              background: 'white',
              transform: 'rotate(45deg)',
              transformOrigin: 'left center',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
