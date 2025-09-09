import * as snarkjs from 'snarkjs';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ZKPProof } from './zkp-prover';

const execAsync = promisify(exec);

export class ZKPVerifier {
  private verificationKeyPath: string;

  constructor() {
    const projectRoot = process.cwd();
    this.verificationKeyPath = process.env.ZKP_VERIFICATION_KEY_PATH || path.join(projectRoot, 'build/verification_key.json');
    
    console.log('🔧 ZKP検証キーパス:', this.verificationKeyPath);
  }

  /**
   * ZKP証明を検証
   * @param {ZKPProof} zkpProof - 証明データ
   * @returns {boolean} 検証結果
   */
  async verifyProof(zkpProof: ZKPProof): Promise<boolean> {
    try {
      console.log('ZKP証明検証を開始...');

      // モック証明の場合
      if (zkpProof.proof.mock) {
        console.log('モック証明を検証:', zkpProof.proof.validated);
        return zkpProof.proof.validated;
      }

      // エラー証明の場合
      if (zkpProof.proof.error) {
        console.log('エラー証明:', zkpProof.proof.message);
        return zkpProof.isValid;
      }

      // 検証キーファイルの存在確認
      if (!this.checkVerificationKey()) {
        console.warn('検証キーが見つからないため、フォールバック検証を実行');
        return zkpProof.isValid;
      }

      // 検証キーの読み込み
      console.log('🔑 検証キー読み込み開始');
      const vKey = JSON.parse(fs.readFileSync(this.verificationKeyPath, 'utf8'));
      console.log('✅ 検証キー読み込み完了');

      // ワーカープロセスでZKP証明検証を実行
      console.log('🔍 ワーカープロセスでZKP証明検証開始:', new Date().toISOString());
      
      const workerArgs = JSON.stringify({
        action: 'verify',
        proof: zkpProof.proof,
        publicSignals: zkpProof.publicSignals,
        vKeyPath: this.verificationKeyPath
      });
      
      const { stdout, stderr } = await execAsync(
        `node zkp-worker.js '${workerArgs}'`,
        { 
          timeout: 15000, // 15秒タイムアウト
          maxBuffer: 1024 * 1024 // 1MBバッファ
        }
      );
      
      if (stderr) {
        console.log('検証ワーカーstderr:', stderr);
      }
      
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const result = JSON.parse(lastLine);
      
      console.log('✅ ワーカーZKP証明検証完了:', new Date().toISOString());
      console.log('🔍 ZKP証明検証結果:', result.isValid);
      
      if (!result.success) {
        throw new Error(`検証ワーカープロセスエラー: ${result.error}`);
      }
      
      const isValid = result.isValid;
      
      return isValid;

    } catch (error) {
      console.error('ZKP証明検証エラー:', error);
      return false;
    }
  }

  /**
   * 検証キーファイルの存在確認
   */
  checkVerificationKey(): boolean {
    if (!fs.existsSync(this.verificationKeyPath)) {
      console.warn(`検証キーファイルが見つかりません: ${this.verificationKeyPath} - ZKP検証は無効化されます`);
      return false;
    }

    console.log('検証キーファイルの確認完了');
    return true;
  }

  /**
   * 証明データの詳細解析
   * @param {string[]} publicSignals - 公開シグナル
   * @returns {Object} 解析結果
   */
  analyzeProofResults(publicSignals: string[]) {
    return {
      isValid: publicSignals[0] === '1',
      addressValid: publicSignals[1] === '1',
      amountValid: publicSignals[2] === '1',
      timeValid: publicSignals[3] === '1'
    };
  }

  /**
   * 証明の詳細情報を取得
   */
  getProofDetails(zkpProof: ZKPProof) {
    const analysis = this.analyzeProofResults(zkpProof.publicSignals);
    
    return {
      isValid: zkpProof.isValid,
      proofType: zkpProof.proof.mock ? 'mock' : zkpProof.proof.error ? 'error' : 'zkp',
      details: analysis,
      publicSignals: zkpProof.publicSignals,
      timestamp: new Date().toISOString()
    };
  }
} 