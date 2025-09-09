const snarkjs = require('snarkjs');
const fs = require('fs');

async function generateZKPProof(circuitInputs, wasmPath, zkeyPath) {
  try {
    console.error('ZKP Worker: Starting proof generation'); // stderr出力でJSON汚染を回避
    console.error('ZKP Worker: Inputs:', circuitInputs);
    console.error('ZKP Worker: Files:', { wasmPath, zkeyPath });
    
    const startTime = Date.now();
    const result = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath
    );
    const endTime = Date.now();
    
    console.error('ZKP Worker: Proof generation completed in', (endTime - startTime) / 1000, 'seconds');
    
    return {
      success: true,
      proof: result.proof,
      publicSignals: result.publicSignals,
      isValid: result.publicSignals[0] === '1',
      processingTime: endTime - startTime
    };
  } catch (error) {
    console.error('ZKP Worker: Error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

async function verifyZKPProof(proof, publicSignals, vKeyPath) {
  try {
    console.error('ZKP Worker: Starting proof verification');
    
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf8'));
    
    const startTime = Date.now();
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    const endTime = Date.now();
    
    console.error('ZKP Worker: Verification completed in', (endTime - startTime) / 1000, 'seconds');
    
    return {
      success: true,
      isValid,
      processingTime: endTime - startTime
    };
  } catch (error) {
    console.error('ZKP Worker: Verification error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// コマンドライン引数から入力を取得
if (process.argv.length > 2) {
  const args = JSON.parse(process.argv[2]);
  
  if (args.action === 'verify') {
    verifyZKPProof(args.proof, args.publicSignals, args.vKeyPath)
      .then(result => {
        console.log(JSON.stringify(result));
        process.exit(0);
      })
      .catch(error => {
        console.error(JSON.stringify({ success: false, error: error.message }));
        process.exit(1);
      });
  } else {
    generateZKPProof(args.inputs, args.wasmPath, args.zkeyPath)
      .then(result => {
        console.log(JSON.stringify(result));
        process.exit(0);
      })
      .catch(error => {
        console.error(JSON.stringify({ success: false, error: error.message }));
        process.exit(1);
      });
  }
}

module.exports = generateZKPProof; 