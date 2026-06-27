import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// GET: Retrieve current user session from cookies
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('streammind_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Retrieve user and their profile from Supabase
    const user = await db.user.findUnique({
      where: { id: sessionToken },
      include: {
        profile: true
      }
    });

    if (!user) {
      // Clear invalid cookie
      cookieStore.delete('streammind_session_token');
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        provider: user.provider
      },
      profile: user.profile
    });
  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
  }
}

// POST: Create or login a user (Demo mode, Google OAuth simulator, or KICK callback)
export async function POST(request: Request) {
  try {
    const { action, name, email, image, provider, kickUsername, kickUserId, streamKey, streamUrl } = await request.json();
    const cookieStore = await cookies();

    let user;

    if (action === 'login_demo') {
      // 1. Create or retrieve a persistent Demo User
      const demoEmail = 'demo@streammind.ai';
      user = await db.user.findUnique({
        where: { email: demoEmail },
        include: { profile: true }
      });

      if (!user) {
        user = await db.user.create({
          data: {
            email: demoEmail,
            name: name || 'Demo Streamer',
            image: image || 'https://kick.com/img/default-profile-pictures/default-avatar-2.webp',
            provider: 'demo',
            profile: {
              create: {
                kickUsername: 'DemoStreamer',
                streamUrl: 'rtmps://stream.kick.com/live',
                streamKey: 'live_demo_key_123456'
              }
            }
          },
          include: { profile: true }
        });
      }
    } else if (action === 'login_google_simulated') {
      // 2. Create or retrieve Simulated Google User
      const googleEmail = email || 'google.tester@gmail.com';
      user = await db.user.findUnique({
        where: { email: googleEmail },
        include: { profile: true }
      });

      if (!user) {
        user = await db.user.create({
          data: {
            email: googleEmail,
            name: name || 'Google Tester',
            image: image || 'https://lh3.googleusercontent.com/a/default-user',
            provider: 'google',
            profile: {
              create: {
                kickUsername: 'GoogleGamer',
                streamUrl: 'rtmps://stream.kick.com/live',
                streamKey: 'live_google_key_789012'
              }
            }
          },
          include: { profile: true }
        });
      }
    } else if (action === 'login_kick') {
      // 3. Authenticate Kick User
      const kickIdStr = String(kickUserId);
      user = await db.user.findUnique({
        where: { kickId: kickIdStr },
        include: { profile: true }
      });

      if (!user) {
        user = await db.user.create({
          data: {
            name: name || kickUsername || 'Kick Streamer',
            image: image || 'https://kick.com/img/default-profile-pictures/default-avatar-2.webp',
            provider: 'kick',
            kickId: kickIdStr,
            profile: {
              create: {
                kickUsername: kickUsername || 'KickStreamer',
                kickUserId: kickIdStr,
                streamUrl: streamUrl || 'rtmps://stream.kick.com/live',
                streamKey: streamKey || ''
              }
            }
          },
          include: { profile: true }
        });
      } else {
        // Update user name + profile username if it changed
        user = await db.user.update({
          where: { id: user.id },
          data: {
            name: name || kickUsername || user.name,
            image: image || user.image,
          },
          include: { profile: true }
        });
        await db.streamerProfile.update({
          where: { userId: user.id },
          data: {
            kickUsername: kickUsername || user.profile?.kickUsername || 'KickStreamer'
          }
        });
      }
    } else {
      return NextResponse.json({ error: 'Invalid auth action' }, { status: 400 });
    }

    // Set secure HTTP-only cookie with User ID as Session Token
    cookieStore.set({
      name: 'streammind_session_token',
      value: user.id,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        provider: user.provider
      },
      profile: user.profile
    });
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Failed to create session', details: error.message }, { status: 500 });
  }
}

// DELETE: Clear session tokens (logout)
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('streammind_session_token');
    return NextResponse.json({ authenticated: false, message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500 });
  }
}
