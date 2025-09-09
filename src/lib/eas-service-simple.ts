import { ethers } from 'ethers';
import { ZKPProof } from './zkp-prover';

export interface AttestationResult {
  success: boolean;
  attestationUID?: string;
  transactionHash?: string;
  error?: string;
}

export interface PaymentAttestation {
  invoiceNumber: string;
  paymentAmount: number;
  recipientAddress: string;
  zkpProofHash: string;
  timestamp: number;
  isVerified: boolean;
}

export interface ScheduleAttestation {
  eventTitle: string;
  startTime: number;
  endTime: number;
  zkpProofHash: string;
  timestamp: number;
  isVerified: boolean;
}

/**
 * EAS統合サービス（簡易版）
 * 本格的なEAS統合の前段階として、証明記録の基本機能を提供
 */
export class EASService {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private easContractAddress: string;

  // 実際のスキーマUID（事前にEASで作成する必要があります）
  private readonly PAYMENT_SCHEMA_UID = process.env.EAS_PAYMENT_SCHEMA_UID || 
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  private readonly SCHEDULE_SCHEMA_UID = process.env.EAS_SCHEDULE_SCHEMA_UID || 
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  constructor(
    easContractAddress: string,
    rpcUrl: string,
    privateKey: string
  ) {
    this.easContractAddress = easContractAddress;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);

    console.log('🔗 EAS Service (Simple) initialized');
    console.log('📋 Payment Schema UID:', this.PAYMENT_SCHEMA_UID);
    console.log('📋 Schedule Schema UID:', this.SCHEDULE_SCHEMA_UID);
  }

  /**
   * 支払い証明をEASにアテストする（簡易版）
   */
  async attestPayment(
    paymentData: PaymentAttestation,
    zkpProof: ZKPProof
  ): Promise<AttestationResult> {
    try {
      console.log('📝 支払い証明をEASにアテスト中（簡易版）...');

      // ZKP証明のハッシュを生成
      const proofHash = this.generateProofHash(zkpProof);

      // 簡易的な実装：ローカルでデータを記録し、将来的にEASに送信
      const attestationData = {
        schemaUID: this.PAYMENT_SCHEMA_UID,
        recipient: paymentData.recipientAddress,
        data: {
          invoiceNumber: paymentData.invoiceNumber,
          paymentAmount: paymentData.paymentAmount,
          recipientAddress: paymentData.recipientAddress,
          zkpProofHash: proofHash,
          timestamp: paymentData.timestamp,
          isVerified: paymentData.isVerified
        },
        timestamp: Date.now()
      };

      // ローカルストレージに保存（実際の実装ではデータベースを使用）
      await this.saveAttestationLocally('payment', attestationData);

      const attestationUID = this.generateAttestationUID('payment', paymentData.invoiceNumber);
      const mockTxHash = '0x' + Math.random().toString(16).substring(2, 66);

      console.log('✅ 支払い証明が記録されました（簡易版）');
      console.log('📄 Attestation UID:', attestationUID);
      console.log('🔗 Mock Transaction Hash:', mockTxHash);

      return {
        success: true,
        attestationUID,
        transactionHash: mockTxHash
      };

    } catch (error) {
      console.error('❌ EAS支払いアテステーションエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * スケジュール証明をEASにアテストする（簡易版）
   */
  async attestSchedule(
    scheduleData: ScheduleAttestation,
    zkpProof: ZKPProof
  ): Promise<AttestationResult> {
    try {
      console.log('📅 スケジュール証明をEASにアテスト中（簡易版）...');

      const proofHash = this.generateProofHash(zkpProof);

      const attestationData = {
        schemaUID: this.SCHEDULE_SCHEMA_UID,
        recipient: await this.signer.getAddress(),
        data: {
          eventTitle: scheduleData.eventTitle,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          zkpProofHash: proofHash,
          timestamp: scheduleData.timestamp,
          isVerified: scheduleData.isVerified
        },
        timestamp: Date.now()
      };

      await this.saveAttestationLocally('schedule', attestationData);

      const attestationUID = this.generateAttestationUID('schedule', scheduleData.eventTitle);
      const mockTxHash = '0x' + Math.random().toString(16).substring(2, 66);

      console.log('✅ スケジュール証明が記録されました（簡易版）');
      console.log('📄 Attestation UID:', attestationUID);

      return {
        success: true,
        attestationUID,
        transactionHash: mockTxHash
      };

    } catch (error) {
      console.error('❌ EASスケジュールアテステーションエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ZKP証明のハッシュを生成
   */
  generateProofHash(zkpProof: ZKPProof): string {
    const proofString = JSON.stringify({
      proof: zkpProof.proof,
      publicSignals: zkpProof.publicSignals,
      isValid: zkpProof.isValid
    });
    
    return ethers.keccak256(ethers.toUtf8Bytes(proofString));
  }

  /**
   * アテステーションUIDを生成
   */
  private generateAttestationUID(type: string, identifier: string): string {
    const combined = `${type}_${identifier}_${Date.now()}`;
    return ethers.keccak256(ethers.toUtf8Bytes(combined));
  }

  /**
   * アテステーションをローカルに保存
   */
  private async saveAttestationLocally(type: string, data: any): Promise<void> {
    try {
      // 実際の実装ではデータベースを使用
      console.log(`💾 ${type}アテステーションをローカルに保存:`, {
        type,
        schemaUID: data.schemaUID,
        recipient: data.recipient,
        timestamp: data.timestamp
      });
      
      // 将来的にはSQLiteやPostgreSQLに保存
      // await db.attestations.create(data);
      
    } catch (error) {
      console.error('ローカル保存エラー:', error);
    }
  }

  /**
   * アテステーションを取得（簡易版）
   */
  async getAttestation(uid: string) {
    try {
      console.log('📋 アテステーション取得中:', uid);
      
      // 簡易的な実装
      return {
        success: true,
        attestation: {
          uid,
          schema: this.PAYMENT_SCHEMA_UID,
          recipient: '0x...',
          attester: await this.signer.getAddress(),
          time: Date.now(),
          expirationTime: 0,
          revocable: true,
          refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
          data: '0x...',
          revoked: false
        }
      };
    } catch (error) {
      console.error('アテステーション取得エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 健全性チェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // プロバイダー接続確認
      const blockNumber = await this.provider.getBlockNumber();
      console.log('🔍 EAS Health Check - Current Block:', blockNumber);
      
      // EAS契約の存在確認（簡易版）
      const code = await this.provider.getCode(this.easContractAddress);
      const hasContract = code !== '0x';
      
      console.log('🏗️  EAS Contract exists:', hasContract);
      
      return hasContract;
    } catch (error) {
      console.error('EAS健全性チェックエラー:', error);
      return false;
    }
  }

  /**
   * 設定情報を取得
   */
  getConfig() {
    return {
      easContractAddress: this.easContractAddress,
      paymentSchemaUID: this.PAYMENT_SCHEMA_UID,
      scheduleSchemaUID: this.SCHEDULE_SCHEMA_UID,
      signerAddress: this.signer.getAddress()
    };
  }

  /**
   * 将来的な本格EAS統合のための準備
   */
  async prepareForFullEASIntegration(): Promise<void> {
    console.log('🔄 本格的なEAS統合の準備中...');
    console.log('📋 必要な作業:');
    console.log('1. EAS Schema Registryでスキーマを作成');
    console.log('2. 環境変数にスキーマUIDを設定');
    console.log('3. EAS SDKの完全統合');
    console.log('4. GraphQLエンドポイントとの連携');
    console.log('5. アテステーション履歴の取得機能');
  }
} 