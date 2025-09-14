# 🤖 AI Gmail Automation System

**Private Local AI + zkVM + Blockchain Payment Automation**

A production-ready email automation system that processes Gmail messages using local AI, validates payment policies with zero-knowledge proofs, and executes blockchain payments automatically.

## 🌟 Features

- **🧠 Local AI Analysis**: Llama3.1-powered email classification with privacy protection
- **🔐 zkVM Policy Validation**: RISC Zero zero-knowledge proofs for policy compliance
- **💸 Automated Payments**: Blockchain payments to whitelisted addresses
- **⚙️ Dynamic Policy Configuration**: User-configurable rules and conditions
- **🔍 Verifiable Inference**: Cryptographically verifiable AI decisions
- **🛡️ Privacy-First**: Complete local execution, no data leaves your system

## 🏗️ Architecture

```
📧 Gmail Messages → 🤖 Local AI → 🔐 zkVM Policy → 💸 Blockchain Payment
                     ↓              ↓              ↓
                 Classification   Proof Generation  Automated Execution
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Rust (for zkVM)
- pnpm
- Google Cloud Console project
- Ethereum Sepolia testnet access

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd ai-gmail-automation

# 2. Setup development environment
make setup

# 3. Configure environment variables
cp env.example .env.local
# Edit .env.local with your credentials

# 4. Run the system
make run
```

## 📋 Usage

### System Commands

```bash
# Run complete system
make run

# Check system health
make health

# Display configuration
make config

# Process emails only
make process

# Start web interface
make web
```

### Web Interface

```bash
# Start development server
make web

# Open browser to http://localhost:3000
```

## ⚙️ Configuration

### Environment Variables (.env.local)

```env
# Google APIs
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token

# Local AI
USE_LOCAL_AI=true
LOCAL_AI_URL=http://localhost:11434
LOCAL_AI_MODEL=llama3.1:8b

# Blockchain
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key
PRIVATE_KEY=your_private_key
ENABLE_PAYMENTS=true

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_encryption_key
```

### User Policy Configuration

The system supports dynamic policy configuration through code:

```typescript
// Example user policy
{
  maxPerPayment: 200000,        // 20万円
  maxPerDay: 1000000,           // 100万円
  maxPerWeek: 5000000,          // 500万円
  allowedVendors: [
    "Amazon Web Services株式会社",
    "Microsoft Corporation"
  ],
  categoryRules: {
    "cloud-services": { maxAmount: 300000, requireApproval: false },
    "software": { maxAmount: 200000, requireApproval: true }
  },
  conditionalRules: [
    {
      condition: "amount > 150000",
      action: "require_approval",
      parameters: { reason: "High amount" }
    }
  ]
}
```

## 🔧 Development

### Directory Structure

```
src/
├── app/                     # Next.js App Router
│   ├── api/process-emails/  # Email processing API
│   └── page.tsx            # Main dashboard
├── lib/                    # Core system libraries
│   ├── real-local-ai.ts    # Local AI implementation
│   ├── integrated-ai-zkvm.ts # AI + zkVM integration
│   ├── real-payment-executor.ts # Blockchain payments
│   ├── zkvm-policy-engine.ts # zkVM wrapper
│   ├── email-processor.ts  # Main processing logic
│   └── gmail.ts           # Gmail API integration
└── components/            # UI components

zk/risc0/zkvm-policy-engine/  # zkVM implementation
├── methods/guest/src/main.rs # Policy evaluation logic
├── host/src/main.rs         # Proof generation
└── target/debug/host        # Compiled binary

scripts/
└── run-system.ts           # Production runner
```

### Building Components

```bash
# Build all components
make build

# Build zkVM only
make zkvm:build

# Test zkVM
make test-zkvm
```

## 🔍 System Health

Check system components:

```bash
make health
```

Expected output:
```
🤖 Local AI: ✅ Online
🔐 zkVM: ✅ Ready  
💸 Payment: ✅ Ready
📧 Gmail: ✅ Connected
```

## 💡 How It Works

### 1. Email Analysis
- **Local AI**: Llama3.1 model analyzes email content locally
- **Privacy**: No data sent to external services
- **Fallback**: Pattern matching if AI unavailable
- **Extraction**: Amount, vendor, invoice details

### 2. Intent Generation
- **Dynamic**: Generated from AI analysis results
- **Structured**: Amount, vendor, category, recipient
- **Metadata**: AI confidence, processing method

### 3. Policy Evaluation
- **Dynamic Rules**: User-configurable policies
- **zkVM Proofs**: Cryptographic validation
- **Conditions**: Amount limits, vendor whitelist, time constraints
- **Custom Logic**: Category-specific rules, conditional logic

### 4. Payment Execution
- **Whitelist Only**: Payments to pre-approved addresses
- **Blockchain**: Ethereum Sepolia network
- **Verification**: ZKP-verified policy compliance
- **Audit Trail**: On-chain transaction records

## 🛡️ Security

- **Local Execution**: AI inference runs entirely on your machine
- **Zero-Knowledge Proofs**: Policy compliance without revealing private data
- **Whitelist Protection**: Payments only to approved addresses
- **DKIM/SPF Verification**: Email authenticity checks
- **Rate Limiting**: Automatic processing delays

## 🎯 Actually Intelligent Compliance

This system meets all Actually Intelligent track requirements:

- ✅ **Autonomy Delta**: Complete local execution, user-owned infrastructure
- ✅ **Verifiability**: ZKP proofs + deterministic rule-based inference  
- ✅ **Forkability**: One-command startup, consumer hardware compatible
- ✅ **Composability**: zkp library integration, key-based authentication
- ✅ **Innovation**: World-first local AI + zkVM integration

## 📞 Support

- **System Health**: `make health`
- **Configuration**: `make config`
- **Status Check**: `make status`
- **Help**: `make help`

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
