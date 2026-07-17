// app/api/og-image/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const title = searchParams.get('title') || 'Code Analysis';
    const username = searchParams.get('username') || 'Developer';

    if (!slug) {
      return new Response('Missing slug parameter', { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';

    // ===== ساخت تصویر با استفاده از @vercel/og =====
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f0f1a',
            backgroundImage: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
            padding: 60,
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.05,
              backgroundImage: 'radial-gradient(circle at 25px 25px, white 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          
          <div
            style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'rgba(74, 134, 247, 0.1)',
              filter: 'blur(60px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -100,
              left: -100,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(168, 85, 247, 0.1)',
              filter: 'blur(60px)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, zIndex: 1 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #4a86f7, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                color: 'white',
                marginRight: 16,
                fontFamily: 'monospace',
              }}
            >
              {'</>'}
            </div>
            <div>
              <span style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>Zbloue</span>
              <p style={{ fontSize: 16, color: '#6c7086', margin: 0 }}>AI Code Analysis</p>
            </div>
          </div>

          <h1
            style={{
              fontSize: 52,
              fontWeight: 'extrabold',
              color: 'white',
              textAlign: 'center',
              marginBottom: 12,
              zIndex: 1,
              maxWidth: '80%',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 20px',
              borderRadius: 50,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 1,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#4a86f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 14,
                fontWeight: 'bold',
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: 'white', fontSize: 18 }}>{username}</span>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 30,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 20,
              zIndex: 1,
            }}
          >
            <span style={{ color: '#6c7086', fontSize: 14 }}>
              🔗 {`${appUrl}/snippet/${slug}`}
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 24,
              fontSize: 12,
              color: 'rgba(255,255,255,0.1)',
              zIndex: 1,
            }}
          >
            Zbloue
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // ============================================================
        // 🔥 افزودن Cache-Control برای کش شدن
        // ============================================================
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        },
      }
    );

    return imageResponse;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('OG Image generation error:', error);
    }
    return new Response(
      JSON.stringify({
        error: 'Failed to generate image',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}