import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

/**
 * GET /api/auth/google
 * Google OAuth認証URLを生成してリダイレクト
 */
export async function GET(request: NextRequest) {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // 常に同意画面を表示してrefresh_tokenを取得
      include_granted_scopes: true,
    });

    console.log('Generated OAuth URL:', authUrl);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('OAuth URL generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate auth URL',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/google
 * 認証URLをJSONで返す（SPA用）
 */
export async function POST(request: NextRequest) {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    return NextResponse.json({
      success: true,
      authUrl,
      scopes,
    });
  } catch (error) {
    console.error('OAuth URL generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate auth URL',
      },
      { status: 500 }
    );
  }
} 