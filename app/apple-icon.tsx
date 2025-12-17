import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: '32px',
        }}
      >
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
          {/* Magnifying glass circle */}
          <div
            style={{
              position: 'absolute',
              left: '45px',
              top: '45px',
              width: '60px',
              height: '60px',
              border: '10px solid white',
              borderRadius: '50%',
            }}
          />
          {/* Magnifying glass handle */}
          <div
            style={{
              position: 'absolute',
              left: '100px',
              top: '100px',
              width: '50px',
              height: '10px',
              background: 'white',
              transform: 'rotate(45deg)',
              transformOrigin: 'left center',
              borderRadius: '5px',
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
