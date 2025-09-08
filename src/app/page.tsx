'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  Calendar, 
  CreditCard, 
  AlertTriangle,
  RefreshCw,
  Settings,
  Activity
} from 'lucide-react';

interface ProcessingResult {
  messageId: string;
  type: 'invoice' | 'schedule' | 'other';
  success: boolean;
  action: string;
  details?: {
    calendarEventId?: string;
    calendarEventUrl?: string;
    policyEvaluation?: any;
    transactionHash?: string;
    paymentAmount?: number;
    error?: string;
    warnings?: string[];
  };
}

interface HealthStatus {
  gmail: boolean;
  openai: boolean;
  calendar: boolean;
  blockchain: boolean;
  overall: boolean;
}

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [lastProcessed, setLastProcessed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // URLパラメータから認証状態をチェック
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');

    if (authStatus === 'success' && accessToken) {
      setIsAuthenticated(true);
      // URLから認証情報をクリア
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // トークンをローカルストレージに保存（デモ用、本番では安全な方法を使用）
      localStorage.setItem('google_access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('google_refresh_token', refreshToken);
      }
    } else {
      // ローカルストレージから認証情報をチェック
      const storedAccessToken = localStorage.getItem('google_access_token');
      if (storedAccessToken) {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // ヘルスチェック
  const checkHealth = async () => {
    try {
      const response = await fetch('/api/process-emails', { method: 'GET' });
      const data = await response.json();
      setHealthStatus(data.health);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        gmail: false,
        openai: false,
        calendar: false,
        blockchain: false,
        overall: false,
      });
    }
  };

  // 初回ヘルスチェック
  useEffect(() => {
    if (isAuthenticated) {
      checkHealth();
    }
  }, [isAuthenticated]);

  // Google認証開始
  const startGoogleAuth = () => {
    window.location.href = '/api/auth/google';
  };

  // メール処理実行
  const processEmails = async () => {
    if (!isAuthenticated) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/process-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          since: lastProcessed,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProcessingResults(data.results || []);
        setLastProcessed(new Date().toISOString());
      } else {
        setError(data.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Email processing failed:', error);
      setError('Network error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  // アクションのアイコンとラベルを取得
  const getActionInfo = (action: string) => {
    switch (action) {
      case 'calendar_created':
        return { icon: <Calendar className="h-4 w-4" />, label: 'カレンダー作成', color: 'bg-green-500' };
      case 'payment_completed':
        return { icon: <CheckCircle className="h-4 w-4" />, label: '支払い完了', color: 'bg-green-500' };
      case 'payment_rejected':
        return { icon: <XCircle className="h-4 w-4" />, label: '支払い拒否', color: 'bg-red-500' };
      case 'manual_approval_required':
        return { icon: <Clock className="h-4 w-4" />, label: '手動承認必要', color: 'bg-yellow-500' };
      case 'blocked_suspicious':
        return { icon: <AlertTriangle className="h-4 w-4" />, label: '疑わしいメール', color: 'bg-red-500' };
      case 'skipped':
        return { icon: <RefreshCw className="h-4 w-4" />, label: 'スキップ', color: 'bg-gray-500' };
      default:
        return { icon: <Mail className="h-4 w-4" />, label: action, color: 'bg-blue-500' };
    }
  };

  // タイプのアイコンを取得
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <CreditCard className="h-4 w-4" />;
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              AI Gmail Automation
            </CardTitle>
            <CardDescription>
              Gmail、Calendar、支払い処理を自動化します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 space-y-2">
              <p>📧 Gmail: メール分類・処理</p>
              <p>📅 Calendar: 予定自動登録</p>
              <p>💳 Payments: 請求書自動支払い</p>
              <p>🔒 Security: DKIM/SPF検証</p>
            </div>
            <Button 
              onClick={startGoogleAuth}
              className="w-full"
              size="lg"
            >
              Googleアカウントで認証
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Gmail Automation</h1>
            <p className="text-gray-600">Gmail新着処理・予定登録・自動支払いシステム</p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={checkHealth}
              variant="outline"
              size="sm"
            >
              <Activity className="h-4 w-4 mr-2" />
              ヘルスチェック
            </Button>
            <Button
              onClick={processEmails}
              disabled={isProcessing}
              size="sm"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              メール処理実行
            </Button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* システム状態 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Gmail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {healthStatus?.gmail ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm">
                  {healthStatus?.gmail ? '接続中' : '未接続'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {healthStatus?.calendar ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm">
                  {healthStatus?.calendar ? '接続中' : '未接続'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Blockchain</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {healthStatus?.blockchain ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm">
                  {healthStatus?.blockchain ? '接続中' : '未接続'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">AI (OpenAI)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {healthStatus?.openai ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm">
                  {healthStatus?.openai ? '接続中' : '未接続'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 処理結果 */}
        <Card>
          <CardHeader>
            <CardTitle>処理結果</CardTitle>
            <CardDescription>
              最新のメール処理結果を表示します
              {lastProcessed && (
                <span className="block text-xs text-gray-500 mt-1">
                  最終処理: {new Date(lastProcessed).toLocaleString('ja-JP')}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processingResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>まだメールが処理されていません</p>
                <p className="text-sm">「メール処理実行」ボタンをクリックして開始してください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processingResults.map((result, index) => {
                  const actionInfo = getActionInfo(result.action);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(result.type)}
                          <span className="text-sm font-medium capitalize">
                            {result.type}
                          </span>
                        </div>
                        
                        <Badge 
                          variant={result.success ? "default" : "destructive"}
                          className="flex items-center space-x-1"
                        >
                          <div className={`w-2 h-2 rounded-full ${actionInfo.color}`} />
                          <span>{actionInfo.label}</span>
                        </Badge>

                        <span className="text-xs text-gray-500 font-mono">
                          {result.messageId.substring(0, 8)}...
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {result.details?.transactionHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${result.details.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Tx: {result.details.transactionHash.substring(0, 8)}...
                          </a>
                        )}
                        
                        {result.details?.calendarEventUrl && (
                          <a
                            href={result.details.calendarEventUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-800"
                          >
                            Calendar
                          </a>
                        )}

                        {result.details?.paymentAmount && (
                          <span className="text-xs text-gray-600">
                            ¥{result.details.paymentAmount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 統計情報 */}
        {processingResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">処理済み</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {processingResults.filter(r => r.success).length}
                </div>
                <p className="text-xs text-gray-500">
                  / {processingResults.length} 件
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">予定作成</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {processingResults.filter(r => r.action === 'calendar_created').length}
                </div>
                <p className="text-xs text-gray-500">件</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">支払い完了</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {processingResults.filter(r => r.action === 'payment_completed').length}
                </div>
                <p className="text-xs text-gray-500">件</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
