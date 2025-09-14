'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WalletAuth, useWalletAuth } from '@/components/WalletAuth';
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
  Activity,
  Brain,
  Shield,
  Zap
} from 'lucide-react';

interface ProcessingResult {
  messageId: string;
  type: 'invoice' | 'schedule' | 'other';
  success: boolean;
  action: string;
  aiModel?: string;
  isActualAI?: boolean;
  zkVMProofGenerated?: boolean;
  paymentExecuted?: boolean;
  transactionHash?: string;
  processingTime?: number;
  error?: string;
}

interface SystemHealth {
  localAI: boolean;
  zkVM: boolean;
  payment: boolean;
  gmail: boolean;
}

interface SystemConfig {
  localAI: {
    enabled: boolean;
    model: string;
    fallback: boolean;
  };
  zkVM: {
    enabled: boolean;
    timeout: number;
  };
  payment: {
    enabled: boolean;
    network: string;
    whitelistedAddresses: string[];
    maxAmount: number;
  };
  userPolicy: {
    maxPerPayment: number;
    maxPerDay: number;
    categoryRules: string[];
    conditionalRules: number;
  };
}

export default function Dashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [lastProcessed, setLastProcessed] = useState<string | null>(null);
  const { isAuthenticated, address, handleAuthChange } = useWalletAuth();

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/process-emails', { method: 'GET' });
      const data = await response.json();
      
      if (data.success) {
        setSystemHealth(data.systemHealth);
        setSystemConfig(data.configuration);
      }
    } catch (error) {
      console.error('System status check failed:', error);
    }
  };

  const processEmails = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/process-emails', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProcessingResults(data.results);
        setLastProcessed(new Date().toLocaleString());
        
        // Update system health
        if (data.systemHealth) {
          setSystemHealth(data.systemHealth);
        }
      } else {
        console.error('Email processing failed:', data.error);
      }
    } catch (error) {
      console.error('Email processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getActionBadge = (action: string) => {
    const actionMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      'payment_executed': { variant: 'default', label: '支払い実行' },
      'payment_rejected': { variant: 'destructive', label: '支払い拒否' },
      'calendar_event_created': { variant: 'secondary', label: 'カレンダー登録' },
      'classified_other': { variant: 'outline', label: 'その他' },
      'processing_error': { variant: 'destructive', label: 'エラー' },
      'blocked_security': { variant: 'destructive', label: 'セキュリティブロック' },
    };

    const config = actionMap[action] || { variant: 'outline' as const, label: action };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            🤖 AI Gmail Automation
          </h1>
          <p className="text-gray-600">
            Private Local AI + zkVM + Blockchain Payment Automation
          </p>
        </div>

        {/* Wallet Authentication */}
        <WalletAuth onAuthChange={handleAuthChange} />

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Integrated AI + zkVM + Payment System Health
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemHealth ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm">Local AI</span>
                  {getStatusIcon(systemHealth.localAI)}
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">zkVM</span>
                  {getStatusIcon(systemHealth.zkVM)}
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">Payment</span>
                  {getStatusIcon(systemHealth.payment)}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Gmail</span>
                  {getStatusIcon(systemHealth.gmail)}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <RefreshCw className="h-8 w-8 mx-auto animate-spin text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">Checking system status...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Configuration */}
        {systemConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">🤖 Local AI</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>Model: {systemConfig.localAI.model}</li>
                    <li>Enabled: {systemConfig.localAI.enabled ? '✅' : '❌'}</li>
                    <li>Fallback: {systemConfig.localAI.fallback ? '✅' : '❌'}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">🔐 zkVM</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>Enabled: {systemConfig.zkVM.enabled ? '✅' : '❌'}</li>
                    <li>Timeout: {systemConfig.zkVM.timeout / 1000}s</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">💸 Payment</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>Network: {systemConfig.payment.network}</li>
                    <li>Max Amount: {systemConfig.payment.maxAmount.toLocaleString()}円</li>
                    <li>Whitelisted: {systemConfig.payment.whitelistedAddresses.length} addresses</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">⚙️ User Policy</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>Max Payment: {systemConfig.userPolicy.maxPerPayment.toLocaleString()}円</li>
                    <li>Category Rules: {systemConfig.userPolicy.categoryRules.length}</li>
                    <li>Conditional Rules: {systemConfig.userPolicy.conditionalRules}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Controls */}
        <Card>
          <CardHeader>
            <CardTitle>📧 Email Processing</CardTitle>
            <CardDescription>
              Process new emails with integrated AI analysis, zkVM policy evaluation, and automated payments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={processEmails} 
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {isProcessing ? 'Processing...' : 'Process New Emails'}
              </Button>
              
              <Button 
                onClick={checkSystemStatus} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </Button>
            </div>

            {lastProcessed && (
              <p className="text-sm text-gray-500">
                Last processed: {lastProcessed}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Processing Results */}
        {processingResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>📊 Processing Results</CardTitle>
              <CardDescription>
                Results from integrated AI + zkVM + Payment processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {processingResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.type === 'invoice' && <CreditCard className="h-4 w-4" />}
                        {result.type === 'schedule' && <Calendar className="h-4 w-4" />}
                        {result.type === 'other' && <Mail className="h-4 w-4" />}
                        <span className="font-medium">Message {result.messageId.substring(0, 8)}...</span>
                      </div>
                      {getActionBadge(result.action)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        <span>AI: {result.isActualAI ? 'Llama3.1' : 'Fallback'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>zkVM: {result.zkVMProofGenerated ? '✅' : '❌'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        <span>Payment: {result.paymentExecuted ? '✅' : '❌'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{result.processingTime}ms</span>
                      </div>
                    </div>

                    {result.transactionHash && (
                      <div className="text-xs">
                        <span className="font-medium">Transaction: </span>
                        <code className="bg-gray-100 px-1 rounded">
                          {result.transactionHash.substring(0, 20)}...
                        </code>
                      </div>
                    )}

                    {result.error && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {result.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Local AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={systemHealth?.localAI ? 'text-green-600' : 'text-red-600'}>
                    {systemHealth?.localAI ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Model:</span>
                  <span>{systemConfig?.localAI.model || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Privacy:</span>
                  <span className="text-green-600">100% Local</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                zkVM Proofs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={systemHealth?.zkVM ? 'text-green-600' : 'text-red-600'}>
                    {systemHealth?.zkVM ? 'Ready' : 'Error'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span>RISC Zero</span>
                </div>
                <div className="flex justify-between">
                  <span>Verifiable:</span>
                  <span className="text-green-600">✅ Yes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={systemHealth?.payment ? 'text-green-600' : 'text-red-600'}>
                    {systemHealth?.payment ? 'Ready' : 'Error'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span>{systemConfig?.payment.network || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Whitelisted:</span>
                  <span>{systemConfig?.payment.whitelistedAddresses.length || 0} addresses</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actually Intelligent Features */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 Actually Intelligent Features</CardTitle>
            <CardDescription>
              Meeting all requirements for privacy, verifiability, and user autonomy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">✅ Autonomy Delta</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Complete local execution</li>
                  <li>• No external API dependencies</li>
                  <li>• User-owned infrastructure</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">✅ Verifiability</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• ZKP cryptographic proofs</li>
                  <li>• Deterministic rule-based inference</li>
                  <li>• Fully reproducible results</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">✅ Forkability</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Consumer-grade hardware</li>
                  <li>• One-command startup</li>
                  <li>• Docker support</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">✅ Composability</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• zkp library integration</li>
                  <li>• Key-based authentication</li>
                  <li>• Blockchain interoperability</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
