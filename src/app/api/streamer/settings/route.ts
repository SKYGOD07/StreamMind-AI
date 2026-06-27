import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// POST: Update manual streamer settings (Stream Key, Stream URL, Username)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('streammind_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized. Please login first.' }, { status: 401 });
    }

    const { streamUrl, streamKey, kickUsername } = await request.json();

    // Find the associated StreamerProfile for this logged-in User
    const profile = await db.streamerProfile.findUnique({
      where: { userId: sessionToken }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Streamer profile not found.' }, { status: 404 });
    }

    // Update fields in Supabase
    const updatedProfile = await db.streamerProfile.update({
      where: { id: profile.id },
      data: {
        streamUrl: streamUrl !== undefined ? streamUrl : profile.streamUrl,
        streamKey: streamKey !== undefined ? streamKey : profile.streamKey,
        kickUsername: kickUsername !== undefined ? kickUsername : profile.kickUsername
      }
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings', details: error.message }, { status: 500 });
  }
}
