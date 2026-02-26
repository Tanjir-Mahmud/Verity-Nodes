# Verity-Nodes: Zero-Trust Coding Standards

## Project Identity
**Verity-Nodes** is an autonomous Multi-Agent Audit Network for the 2026 EU Green Claims Directive.  
Every line of code must assume **zero trust** — data is guilty until proven compliant.

---

## Core Principles

### 1. Zero-Trust Data Philosophy
- **Never trust raw input.** Every document, API response, and user-submitted claim must be validated, cross-referenced, and logged before entering the audit pipeline.
- **Immutable audit trails.** All agent decisions, state transitions, and data mutations must produce append-only log entries with timestamps and agent IDs.
- **Fail-secure defaults.** If an agent cannot verify a claim, the default status is `NON_COMPLIANT` until human review overrides it.

### 2. Type Safety & Validation
- **Python backend:** Use Pydantic `BaseModel` for ALL data structures. No raw dicts in agent state.
- **TypeScript frontend:** Use strict TypeScript (`"strict": true`). No `any` types permitted.
- **API contracts:** All endpoints must have OpenAPI schema definitions via FastAPI auto-docs.

### 3. Security Standards
- **Secrets management:** API keys stored in `.env` files only. Never committed to version control.
- **Input sanitization:** All user inputs and file uploads validated with size limits and type checks.
- **CORS lockdown:** Only whitelisted frontend origins allowed in production.
- **Rate limiting:** All external API calls throttled with exponential backoff.

### 4. Agent Architecture Rules
- **Single Responsibility:** Each agent (Auditor, Regulatory, Resolver) has ONE job. No cross-contamination.
- **Deterministic State Transitions:** LangGraph state changes must be explicit and logged.
- **Escalation Protocol:** Max 3 autonomous retry loops before mandatory human escalation.
- **Agent Communication:** Agents communicate ONLY through the shared state graph, never directly.

### 5. Code Quality
- **Error handling:** Every external API call wrapped in try/except with structured error logging.
- **Docstrings:** All public functions documented with Args, Returns, and Raises sections.
- **Naming conventions:** `snake_case` for Python, `camelCase` for TypeScript, `SCREAMING_SNAKE` for constants.
- **File organization:** Group by domain (agents/, integrations/, components/), not by file type.

---

## Git Commit Convention
```
<type>(<scope>): <description>

Types: feat, fix, refactor, docs, test, chore
Scopes: agent, integration, ui, infra
```
