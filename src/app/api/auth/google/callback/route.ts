import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

/**
 * GET /api/auth/google/callback
 * Google OAuth認証のコールバック処理
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=oauth_error', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?error=missing_code', request.url));
    }

    // 認証コードからトークンを取得
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('OAuth tokens received:', {
      access_token: tokens.access_token ? '***' : 'missing',
      refresh_token: tokens.refresh_token ? '***' : 'missing',
      scope: tokens.scope,
      expires_in: tokens.expiry_date,
    });

    // 実際のアプリケーションでは、これらのトークンを安全に保存する必要があります
    // 今回はデモなので、リダイレクトURLにパラメータとして含めます（本番環境では非推奨）
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('access_token', tokens.access_token || '');
    redirectUrl.searchParams.set('refresh_token', tokens.refresh_token || '');

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=callback_error', request.url));
  }
}

/**
 * POST /api/auth/google/callback
 * トークンを使用してユーザー情報を取得
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token) {
      return NextResponse.json(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      );
    }

    // トークンを設定
    oauth2Client.setCredentials({
      access_token,
      refresh_token,
    });

    // ユーザー情報を取得
    const { data: userInfo } = await oauth2Client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });

    return NextResponse.json({
      success: true,
      user: userInfo,
      tokens: {
        access_token: access_token.substring(0, 10) + '***',
        refresh_token: refresh_token ? refresh_token.substring(0, 10) + '***' : null,
      },
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      },
      { status: 500 }
    );
  }
} 