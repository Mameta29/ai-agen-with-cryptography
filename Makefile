# AI Gmail Automation System - Production Makefile

.PHONY: run setup build test health config clean help

# 🚀 Main system execution
run:
	@echo "🚀 Starting AI Gmail Automation System..."
	pnpm system:run

# 🔍 System health check
health:
	@echo "🔍 Checking system health..."
	pnpm system:health

# ⚙️ Display system configuration
config:
	@echo "⚙️ Displaying system configuration..."
	pnpm system:config

# 📧 Process emails only
process:
	@echo "📧 Processing emails..."
	pnpm system:process

# 🏗️ Build all components
build:
	@echo "🏗️ Building all system components..."
	@echo "1. Installing dependencies..."
	pnpm install
	@echo "2. Building zkVM components..."
	pnpm zkvm:build
	@echo "3. Building Next.js application..."
	pnpm build
	@echo "✅ Build completed"

# 🧪 Test zkVM functionality
test-zkvm:
	@echo "🧪 Testing zkVM functionality..."
	pnpm zkvm:test

# 🌐 Start web interface
web:
	@echo "🌐 Starting web interface..."
	pnpm dev

# ⚙️ Setup development environment
setup:
	@echo "⚙️ Setting up development environment..."
	@echo "1. Installing dependencies..."
	pnpm install
	@echo "2. Installing RISC Zero toolchain..."
	curl -L https://risczero.com/install | bash
	@echo "3. Building zkVM components..."
	pnpm zkvm:build
	@echo "4. Setting up environment..."
	@if [ ! -f .env.local ]; then cp env.example .env.local; echo "Created .env.local from example"; fi
	@echo "✅ Setup completed"
	@echo ""
	@echo "Next steps:"
	@echo "1. Configure .env.local with your credentials"
	@echo "2. Run 'make health' to check system status"
	@echo "3. Run 'make run' to start the system"

# 🧹 Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf node_modules
	rm -rf .next
	rm -rf zk/risc0/zkvm-policy-engine/target
	rm -rf temp/
	@echo "✅ Clean completed"

# 📊 System status
status:
	@echo "📊 System Status:"
	@echo "Dependencies:"
	@if [ -d "node_modules" ]; then echo "  ✅ Node.js dependencies installed"; else echo "  ❌ Node.js dependencies missing"; fi
	@echo "zkVM:"
	@if [ -f "zk/risc0/zkvm-policy-engine/target/debug/host" ]; then echo "  ✅ zkVM binary built"; else echo "  ❌ zkVM binary missing"; fi
	@echo "Environment:"
	@if [ -f ".env.local" ]; then echo "  ✅ Environment configured"; else echo "  ❌ Environment not configured"; fi

# 📚 Help
help:
	@echo "🤖 AI Gmail Automation System - Production Commands"
	@echo ""
	@echo "Main Commands:"
	@echo "  make run      - Run the complete system"
	@echo "  make health   - Check system health"
	@echo "  make config   - Display configuration"
	@echo "  make process  - Process emails only"
	@echo "  make web      - Start web interface"
	@echo ""
	@echo "Development Commands:"
	@echo "  make setup    - Setup development environment"
	@echo "  make build    - Build all components"
	@echo "  make test-zkvm - Test zkVM functionality"
	@echo "  make status   - Check system status"
	@echo "  make clean    - Clean build artifacts"
	@echo ""
	@echo "System Features:"
	@echo "  🤖 Local AI (Llama3.1 + Pattern Matching Fallback)"
	@echo "  🔐 zkVM Proofs (RISC Zero)"
	@echo "  💸 Blockchain Payments (Ethereum Sepolia)"
	@echo "  ⚙️ Dynamic Policy Configuration"
	@echo "  🔍 Verifiable AI Inference" 