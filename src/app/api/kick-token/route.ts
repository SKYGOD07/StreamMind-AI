import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code, code_verifier } = await request.json();

    if (!code || !code_verifier) {
      return NextResponse.json(
        { error: 'Missing code or code_verifier parameter.' },
        { status: 400 }
      );
    }

    const clientId = process.env.KICK_CLIENT_ID;
    const clientSecret = process.env.KICK_CLIENT_SECRET;
    const redirectUri = process.env.KICK_REDIRECT_URI || 'http://localhost:3000/';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Kick credentials are not configured on the server.' },
        { status: 500 }
      );
    }

    // Build the request body for id.kick.com token exchange
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', code_verifier);
    params.append('code', code);

    console.log('Sending token exchange request to Kick...', {
      clientId,
      redirectUri,
      code_verifier
    });

    const response = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Kick OAuth token exchange failed:', data);
      return NextResponse.json(
        { error: data.message || 'Token exchange failed', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in kick-token API route:', error);
    return NextResponse.json(
      { error: 'Internal server error during Kick token exchange.', details: error.message },
      { status: 500 }
    );
  }
}
