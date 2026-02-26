# Verity-Nodes: The Autonomous Agentic Audit Network

Verity-Nodes is a state-of-the-art, autonomous multi-agent system designed for forensic supply chain auditing. It specializes in detecting origin fraud, verifying sustainability claims, and ensuring compliance with the EU Green Claims Directive and other regulatory frameworks. 

Built for the 2026 enterprise FinTech landscape, Verity-Nodes leverages a "Calm Tech" design philosophy, providing deep intelligence through a seamless, interactive dashboard.

---

## 🚀 Key Features

- **Autonomous Agent Pipeline**: Orchestrates three specialized agents:
  - **DeepAuditor**: Forensic data extraction and anomaly detection using Claude 3.5 Sonnet Vision.
  - **RegulatoryShield**: Real-time compliance verification against global trade and environmental standards.
  - **ActionAgent**: Automated resource dispatch and dispute resolution.
- **Supply Chain Topology**: Interactive visualization of goods flow with real-time risk overlays.
- **Live Agent Feed**: A real-time WebSocket-driven orchestration log.
- **Carbon Intelligence**: Accurate freight emission estimates via Climatiq.
- **Legal Entity Verification**: Instant supplier validation via GLEIF LEI registry.
- **Executive PDF Export**: One-click professional reports for stakeholder compliance.

---

## 🏗️ Architecture

Verity-Nodes uses a robust, modular architecture:

### Backend (FastAPI + LangGraph)
- **LangGraph**: Orchestrates the multi-agent decision loop.
- **Claude 3.5 Sonnet**: Serves as the central "Forensic Brain" for document analysis.
- **Integrations**: 
  - `Climatiq` for ESG/Emissions data.
  - `GLEIF` for legal identity.
  - `You.com` for real-time web intelligence.
- **WebSocket Streaming**: Provides the live agent heartbeat to the frontend.

### Frontend (Next.js + Tailwind CSS)
- **Modern Dashboard**: High-fidelity UI with mesh gradients and glassmorphism.
- **Framer Motion**: Smooth, micro-animations for an interactive feel.
- **Lucide Icons**: Clean, semantic iconography.

---

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- API Keys: Anthropic (Claude), Climatiq, You.com (optional).

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Configure your environment:
   ```bash
   cp .env.example .env
   # Add your API keys to .env
   ```
4. Start the server:
   ```bash
   python main.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment:
   ```bash
   cp .env.example .env.local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## ⚙️ The .agent Directory

The `.agent` directory contains specialized instructions and skills used by Antigravity (the project's autonomous developer). This directory is critical for maintaining the project's agentic integrity and ensuring consistent development patterns.

---

## 📄 License

Verity-Nodes is released under the MIT License.
