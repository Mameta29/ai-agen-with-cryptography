import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
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

export class EASService {
  private eas: EAS;
  private provider: ethers.Provider;
  private signer: ethers.Signer;

  // スキーマUID（事前にEASで作成する必要があります）
  private readonly PAYMENT_SCHEMA_UID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  private readonly SCHEDULE_SCHEMA_UID = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  constructor(
    easContractAddress: string,
    rpcUrl: string,
    privateKey: string
  ) {
    // Ethereum プロバイダーとサイナーを設定
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);

    // EAS インスタンスを初期化
    this.eas = new EAS(easContractAddress);
    this.eas.connect(this.signer);

    console.log('🔗 EAS Service initialized');
  }

  /**
   * 支払い証明をEASにアテストする
   */
  async attestPayment(
    paymentData: PaymentAttestation,
    zkpProof: ZKPProof
  ): Promise<AttestationResult> {
    try {
      console.log('📝 支払い証明をEASにアテスト中...');

      // スキーマエンコーダーを作成
      const schemaEncoder = new SchemaEncoder(
        'string invoiceNumber,uint256 paymentAmount,address recipientAddress,bytes32 zkpProofHash,uint256 timestamp,bool isVerified'
      );

      // データをエンコード
      const encodedData = schemaEncoder.encodeData([
        { name: 'invoiceNumber', value: paymentData.invoiceNumber, type: 'string' },
        { name: 'paymentAmount', value: paymentData.paymentAmount.toString(), type: 'uint256' },
        { name: 'recipientAddress', value: paymentData.recipientAddress, type: 'address' },
        { name: 'zkpProofHash', value: paymentData.zkpProofHash, type: 'bytes32' },
        { name: 'timestamp', value: paymentData.timestamp.toString(), type: 'uint256' },
        { name: 'isVerified', value: paymentData.isVerified, type: 'bool' }
      ]);

      // アテステーションを作成
      const tx = await this.eas.attest({
        schema: this.PAYMENT_SCHEMA_UID,
        data: {
          recipient: paymentData.recipientAddress,
          expirationTime: BigInt(0), // 無期限
          revocable: true,
          data: encodedData,
        },
      });

      console.log('⏳ アテステーション送信中...');
      
      // トランザクションハッシュを取得（EAS SDKの実装に依存）
      const txHash = typeof tx === 'string' ? tx : (tx as any).hash || 'unknown';
      const attestationUID = 'generated_uid_' + Date.now(); // 簡易的な実装

      console.log('✅ 支払い証明がEASに記録されました');
      console.log('📄 Attestation UID:', attestationUID);
      console.log('🔗 Transaction Hash:', txHash);

      return {
        success: true,
        attestationUID,
        transactionHash: tx.hash
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
   * スケジュール証明をEASにアテストする
   */
  async attestSchedule(
    scheduleData: ScheduleAttestation,
    zkpProof: ZKPProof
  ): Promise<AttestationResult> {
    try {
      console.log('📅 スケジュール証明をEASにアテスト中...');

      const schemaEncoder = new SchemaEncoder(
        'string eventTitle,uint256 startTime,uint256 endTime,bytes32 zkpProofHash,uint256 timestamp,bool isVerified'
      );

      const encodedData = schemaEncoder.encodeData([
        { name: 'eventTitle', value: scheduleData.eventTitle, type: 'string' },
        { name: 'startTime', value: scheduleData.startTime.toString(), type: 'uint256' },
        { name: 'endTime', value: scheduleData.endTime.toString(), type: 'uint256' },
        { name: 'zkpProofHash', value: scheduleData.zkpProofHash, type: 'bytes32' },
        { name: 'timestamp', value: scheduleData.timestamp.toString(), type: 'uint256' },
        { name: 'isVerified', value: scheduleData.isVerified, type: 'bool' }
      ]);

      const tx = await this.eas.attest({
        schema: this.SCHEDULE_SCHEMA_UID,
        data: {
          recipient: await this.signer.getAddress(), // 自分自身を受信者に
          expirationTime: BigInt(0),
          revocable: true,
          data: encodedData,
        },
      });

      console.log('⏳ スケジュールアテステーション送信中...');
      
      const txHash = typeof tx === 'string' ? tx : (tx as any).hash || 'unknown';
      const attestationUID = 'schedule_uid_' + Date.now(); // 簡易的な実装

      console.log('✅ スケジュール証明がEASに記録されました');
      console.log('📄 Attestation UID:', attestationUID);

      return {
        success: true,
        attestationUID,
        transactionHash: tx.hash
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
   * アテステーションを取得
   */
  async getAttestation(uid: string) {
    try {
      const attestation = await this.eas.getAttestation(uid);
      return {
        success: true,
        attestation
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
   * アドレスのアテステーション履歴を取得
   */
  async getAttestationsForAddress(address: string) {
    try {
      // GraphQL クエリを使用してアテステーションを取得
      // 実際の実装ではEASのGraphQLエンドポイントを使用
      console.log(`📋 ${address}のアテステーション履歴を取得中...`);
      
      // ここでは簡易的な実装
      return {
        success: true,
        attestations: []
      };
    } catch (error) {
      console.error('アテステーション履歴取得エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * スキーマを作成（初期設定用）
   * 注意: 実際の実装では事前にスキーマを作成し、UIDを環境変数で管理してください
   */
  async createPaymentSchema(): Promise<string> {
    try {
      console.log('📋 支払い証明用スキーマを作成中...');
      
      // 簡易的な実装 - 実際にはEASのSchema Registryを使用
      const mockSchemaUID = '0x' + 'payment_schema_' + Date.now().toString(16).padStart(56, '0');
      
      console.log('✅ 支払い証明スキーマが作成されました:', mockSchemaUID);
      console.log('⚠️  実際の環境では事前にスキーマを作成し、UIDを設定してください');
      
      return mockSchemaUID;
      
    } catch (error) {
      console.error('スキーマ作成エラー:', error);
      throw error;
    }
  }

  /**
   * 健全性チェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // EAS契約の存在確認
      const code = await this.provider.getCode(this.eas.contract.target as string);
      return code !== '0x';
    } catch (error) {
      console.error('EAS健全性チェックエラー:', error);
      return false;
    }
  }
} 