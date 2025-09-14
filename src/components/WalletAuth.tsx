'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface WalletAuthProps {
  onAuthChange?: (isAuthenticated: boolean, address?: string) => void;
}

export function WalletAuth({ onAuthChange }: WalletAuthProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  // ウォレット接続状態をチェック
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setIsConnected(true);
          setAddress(accounts[0]);
          onAuthChange?.(true, accounts[0]);
        }
      } catch (error) {
        console.error('ウォレット状態確認エラー:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMaskまたは互換ウォレットをインストールしてください');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setIsConnected(true);
        setAddress(accounts[0]);
        onAuthChange?.(true, accounts[0]);
        console.log('✅ ウォレット接続成功:', accounts[0]);
      }
    } catch (error) {
      console.error('❌ ウォレット接続エラー:', error);
      alert('ウォレット接続に失敗しました');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress('');
    onAuthChange?.(false);
    console.log('🚫 ウォレット切断');
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">🔐 ウォレット認証</h3>
          <div className="text-sm text-gray-500">
            Cypherpunk Primitive: Key-based Auth
          </div>
        </div>

        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Actually Intelligent要件: ユーザー所有インフラでの認証
            </p>
            <Button 
              onClick={connectWallet} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? '接続中...' : 'ウォレットを接続'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">接続済み:</span>
              <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {formatAddress(address)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-green-50 p-2 rounded">
                <div className="font-medium text-green-800">✅ 自律性</div>
                <div className="text-green-600">ユーザー所有</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="font-medium text-blue-800">🔐 セキュリティ</div>
                <div className="text-blue-600">暗号学的認証</div>
              </div>
            </div>

            <Button 
              onClick={disconnectWallet} 
              variant="outline" 
              size="sm"
              className="w-full"
            >
              切断
            </Button>
          </div>
        )}

        <div className="text-xs text-gray-500 border-t pt-2">
          <div>🔑 Key-based Authentication</div>
          <div>🌐 Decentralized Identity</div>
          <div>🛡️ User-Controlled Access</div>
        </div>
      </div>
    </Card>
  );
}

// ウォレット認証フック
export function useWalletAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [address, setAddress] = useState<string>('');

  const handleAuthChange = (authenticated: boolean, userAddress?: string) => {
    setIsAuthenticated(authenticated);
    setAddress(userAddress || '');
  };

  return {
    isAuthenticated,
    address,
    handleAuthChange,
  };
} 