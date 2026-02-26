"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import LiveAgentFeed from "@/components/LiveAgentFeed";
import ComplianceGauge from "@/components/ComplianceGauge";
import AgentStatusPanel from "@/components/AgentStatusPanel";
import AuditTimeline from "@/components/AuditTimeline";
import SupplyChainMap from "@/components/SupplyChainMap";
import FileDropZone from "@/components/FileDropZone";
import ProcessingProgress from "@/components/ProcessingProgress";
import ExportPDFButton from "@/components/ExportPDFButton";
import { uploadAuditDocument, logAuditEvent } from "@/lib/supabase";

/* ======================================================================
   TYPE DEFINITIONS
   ====================================================================== */
interface AuditResult {
  audit_id: string;
  batch_id: string;
  supplier_id: string;
  supplier_name: string;
  compliance_status: string;
  overall_risk_score: number;
  findings_count: number;
  violations_count: number;
  total_financial_exposure_eur: number;
  findings: Record<string, unknown>[];
  violations: Record<string, unknown>[];
  corrective_actions: Record<string, unknown>[];
  supplier_email: Record<string, unknown> | null;
  resolution_status: string;
  loop_count: number;
  loop_decision: string;
  emissions_data: Record<string, unknown> | null;
  agent_log: AgentLogEntry[];
  claude_tokens?: { input: number; output: number };
}

interface AgentLogEntry {
  audit_id?: string;
  timestamp: string;
  agent: "DEEP_AUDITOR" | "REGULATORY_SHIELD" | "ACTION_AGENT" | "SYSTEM" | "HUMAN";
  action: string;
  details: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  base64: string;
}

interface ProcessingStage {
  label: string;
  icon: string;
  status: "pending" | "active" | "complete" | "error";
}

type AgentState = "ACTIVE" | "IDLE" | "ERROR" | "PROCESSING" | "SUCCESS" | "ESCALATED";

/* ======================================================================
   PIPELINE STAGES
   ====================================================================== */
const DEFAULT_STAGES: ProcessingStage[] = [
  { label: "Ingest", icon: "📤", status: "pending" },
  { label: "OCR", icon: "👁️", status: "pending" },
  { label: "Audit", icon: "🔍", status: "pending" },
  { label: "Shield", icon: "⚖️", status: "pending" },
  { label: "Action", icon: "🔧", status: "pending" },
];

/* ======================================================================
   MOCK TIMELINE (reused across flows)
   ====================================================================== */
const MOCK_TIMELINE = [];

/* ======================================================================
   MAIN PAGE COMPONENT
   ====================================================================== */
export default function WarRoom() {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [agentLog, setAgentLog] = useState<AgentLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentAuditId, setCurrentAuditId] = useState("");

  // --- Explicit Baseline State (per requirement) ---
  const [riskScore, setRiskScore] = useState(0);
  const [findings, setFindings] = useState([]);
  const [violations, setViolations] = useState([]);
  const [exposure, setExposure] = useState(0);

  // --- Intake / Pipeline ---
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [pipelineStages, setPipelineStages] = useState<ProcessingStage[]>(DEFAULT_STAGES);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Agent Network Status ---
  const [auditorState, setAuditorState] = useState<AgentState>("IDLE");
  const [shieldState, setShieldState] = useState<AgentState>("IDLE");
  const [actionState, setActionState] = useState<AgentState>("IDLE");
  const [auditorAction, setAuditorAction] = useState("Claude 3.5 Vision ready");
  const [shieldAction, setShieldAction] = useState("EU ESPR vector DB loaded");
  const [actionAction, setActionAction] = useState("GLEIF + You.com ready");
  const [auditorItems, setAuditorItems] = useState(0);
  const [shieldItems, setShieldItems] = useState(0);
  const [actionItems, setActionItems] = useState(0);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(null);

  const [activeNodes, setActiveNodes] = useState<any[]>([
    { id: "1", label: "GreenTextile GmbH", type: "supplier", status: "unverified", location: "Bangladesh" },
    { id: "2", label: "Port Chittagong", type: "port", status: "unverified", location: "BDCGP" },
    { id: "3", label: "MSC AURORA", type: "logistics", status: "verified", location: "Indian Ocean", subLabel: "Vessel: 9817078" },
    { id: "4", label: "Port Hamburg", type: "port", status: "verified", location: "DEHAM" },
    { id: "5", label: "EU Distribution", type: "warehouse", status: "unverified", location: "Germany" },
    { id: "6", label: "Retail (EU Market)", type: "destination", status: "verified", location: "EU" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Helpers ---
  const updateStage = useCallback((index: number, status: ProcessingStage["status"]) => {
    setPipelineStages((prev) => prev.map((s, i) => (i === index ? { ...s, status } : s)));
  }, []);

  const animateProgress = useCallback((target: number, duration: number) => {
    if (progressRef.current) clearInterval(progressRef.current);
    const step = (target - extractionProgress) / (duration / 40);
    let current = extractionProgress;
    progressRef.current = setInterval(() => {
      current += step;
      if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
        current = target;
        if (progressRef.current) clearInterval(progressRef.current);
      }
      setExtractionProgress(current);
    }, 40);
  }, [extractionProgress]);

  const pushLog = useCallback((entry: AgentLogEntry) => {
    setAgentLog((prev) => [...prev, entry]);

    // Persist to Supabase if auditId is present
    if (entry.audit_id) {
      logAuditEvent({
        audit_id: entry.audit_id,
        agent: entry.agent,
        action: entry.action,
        details: entry.details,
        severity: entry.severity
      }).catch(err => console.warn("[Supabase] Async log failed:", err));
    }
  }, []);

  const mkLog = (
    agent: AgentLogEntry["agent"],
    action: string,
    details: string,
    severity: AgentLogEntry["severity"] = "INFO",
    audit_id?: string
  ): AgentLogEntry => ({
    audit_id,
    timestamp: new Date().toISOString(),
    agent, action, details, severity,
  });

  // --- Reset agent states ---
  const resetAgents = useCallback(() => {
    setAuditorState("IDLE"); setShieldState("IDLE"); setActionState("IDLE");
    setAuditorAction("Claude 3.5 Vision ready"); setShieldAction("EU ESPR vector DB loaded"); setActionAction("GLEIF + You.com ready");
    setAuditorItems(0); setShieldItems(0); setActionItems(0);
    setSelectedAgentFilter(null);
  }, []);

  /* ==================================================================
     CORE PIPELINE: File Drop → Supabase → Claude Extraction → Agents
     ================================================================== */
  const handleFilesAccepted = useCallback(async (files: UploadedFile[]) => {
    // 1. TOTAL STATE PURGE (Winner Mode Protocol)
    setFindings([]);
    setViolations([]);
    setExposure(0);
    setRiskScore(0);
    setAgentLog([]); // Clear orchestration feed
    setAuditResult(null);
    resetAgents();

    if (files.length === 0) return;

    setIsExtracting(true);
    setExtractionProgress(0);
    setPipelineStages(DEFAULT_STAGES.map((s) => ({ ...s, status: "pending" })));

    // 2. DYNAMIC SESSION ID (CRITICAL)
    const auditId = "VERITY-" + Date.now();
    setCurrentAuditId(auditId);

    // ──────────────────────────────────────
    // STAGE 1: INGEST — Upload to Supabase
    // ──────────────────────────────────────
    updateStage(0, "active");
    setCurrentStage("Ingesting documents into Supabase 'audits' bucket...");

    pushLog(mkLog("SYSTEM", "FILE_RECEIVED",
      `File received: ${files.map((f) => f.name).join(", ")}. Initializing DeepAuditor for OCR and Forensic Analysis...`,
      "INFO", auditId
    ));

    // Upload each file to Supabase storage
    for (const file of files) {
      try {
        const byteString = atob(file.base64);
        const bytes = new Uint8Array(byteString.length);
        for (let j = 0; j < byteString.length; j++) bytes[j] = byteString.charCodeAt(j);
        const blob = new Blob([bytes], { type: file.type });

        const result = await uploadAuditDocument(blob, file.name, auditId);
        if (result.error) {
          pushLog(mkLog("SYSTEM", "SUPABASE_WARN",
            `Supabase upload: ${result.error}. Proceeding with in-memory pipeline.`, "WARNING", auditId
          ));
        } else {
          pushLog(mkLog("SYSTEM", "SUPABASE_STORED",
            `Document "${file.name}" stored in Supabase bucket 'audits' at path: ${result.path}.`, "INFO", auditId
          ));
        }
      } catch {
        // Non-blocking — we still have the file in-memory
        pushLog(mkLog("SYSTEM", "SUPABASE_SKIP",
          `Supabase storage unavailable. Proceeding with in-memory pipeline.`, "WARNING", auditId
        ));
      }
    }

    await delay(400);
    pushLog(mkLog("SYSTEM", "INGESTION_COMPLETE",
      `Ingestion Complete. ${files.length} file(s) stored in Supabase. Forwarding to Claude 3.5 Vision for forensic extraction.`, "INFO", auditId
    ));

    updateStage(0, "complete");
    animateProgress(15, 400);

    // ──────────────────────────────────────
    // STAGE 2: OCR — Claude 3.5 Vision Extraction
    // ──────────────────────────────────────
    updateStage(1, "active");
    setAuditorState("PROCESSING");
    setAuditorAction("Claude Vision: Forensic field extraction...");
    setCurrentStage("Claude 3.5 Sonnet Vision: Forensic field extraction...");

    pushLog(mkLog("DEEP_AUDITOR", "CLAUDE_VISION_OCR",
      `Sending ${files.length} document(s) to Claude 3.5 Sonnet Vision — extracting vendor, dates, origin, certificates with forensic-grade precision.`, "INFO", auditId
    ));

    await delay(300);
    animateProgress(30, 1000);

    // Call the real extraction API via FastAPI backend
    let extractedData: Record<string, unknown> | null = null;
    const allExtractedData: any[] = [];
    for (const file of files) {
      try {
        const formData = new FormData();
        const byteString = atob(file.base64);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
        const blob = new Blob([bytes], { type: file.type });
        formData.append("file", blob, file.name);
        formData.append("document_type", "auto");

        const res = await fetch("http://localhost:8000/api/audit/extract", {
          method: "POST",
          body: formData,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            extractedData = data.extraction;
            allExtractedData.push(extractedData);
            pushLog(mkLog("DEEP_AUDITOR", "EXTRACTION_COMPLETE",
              `Extracted: Vendor="${(extractedData as Record<string, string>)?.vendor_name || "?"}",` +
              ` Origin="${(extractedData as Record<string, string>)?.country_of_origin || "?"}",` +
              ` Certs: ${JSON.stringify((extractedData as Record<string, string[]>)?.certificate_numbers || [])}.` +
              ` Tokens: ${data.tokens?.input || 0}+${data.tokens?.output || 0}.`, "INFO", auditId
            ));
          } else {
            pushLog(mkLog("DEEP_AUDITOR", "EXTRACTION_ERROR",
              `Extraction failed for "${file.name}": ${data.error || "Unknown error"}. Proceeding without this document.`, "ERROR", auditId
            ));
          }
        } else {
          const errorText = await res.text();
          pushLog(mkLog("DEEP_AUDITOR", "EXTRACTION_FAILED",
            `Backend error (${res.status}) for "${file.name}": ${errorText.slice(0, 100)}.`, "ERROR", auditId
          ));
        }
      } catch (err) {
        console.error("Extraction API call failed:", err);
        pushLog(mkLog("DEEP_AUDITOR", "EXTRACTION_EXCEPTION",
          `Network error during extraction of "${file.name}".`, "ERROR", auditId
        ));
      }
    }

    updateStage(1, "complete");
    animateProgress(40, 400);
    await delay(300);

    // ──────────────────────────────────────
    // STAGE 3-5: FULL LANGGRAPH AUDIT
    // ──────────────────────────────────────
    updateStage(2, "active");
    setAuditorState("PROCESSING");
    setShieldState("PROCESSING");
    setActionState("PROCESSING");
    setAuditorAction("Waiting for Claude Core Analysis...");
    setShieldAction("Waiting for Compliance Check...");
    setActionAction("Waiting for Resolution Strategy...");
    setCurrentStage("DeepAuditor: Cross-referencing against global knowledge graph...");

    // The backend takes ~30-60s for full Claude analysis. Animate slowly to 95%.
    animateProgress(95, 30000);

    try {
      const vendor = (extractedData as Record<string, string>)?.vendor_name || "Unknown Supplier";

      const res = await fetch("http://localhost:8000/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: auditId,
          supplier_id: "SUP-" + Math.floor(Math.random() * 10000),
          supplier_name: vendor,
          documents: files.map(f => f.name),
          extracted_data: allExtractedData,
        }),
      });

      const realAuditData = await res.json();
      animateProgress(100, 500);

      // Emit the real agent logs rapidly for a cool "matrix" feel, rather than instantly
      for (const log of realAuditData.agent_log || []) {
        pushLog({ ...log, audit_id: auditId });
        await delay(150);
      }

      setAuditorState("SUCCESS");
      setAuditorAction(`${realAuditData.findings_count || 0} findings`);
      setAuditorItems(realAuditData.findings_count || 0);
      updateStage(2, "complete");

      setShieldState("SUCCESS");
      setShieldAction(`${realAuditData.violations_count || 0} violations`);
      setShieldItems(realAuditData.violations_count || 0);
      updateStage(3, "complete");

      setActionState("SUCCESS");
      setActionAction(`Status: ${realAuditData.resolution_status || "UNKNOWN"}`);
      setActionItems(realAuditData.corrective_actions?.length || 0);
      updateStage(4, "complete");

      setCurrentStage("Pipeline complete. All agents reported. AI Engine cycle finished.");

      setAuditResult(realAuditData);
      setExposure(realAuditData.total_financial_exposure_eur || 0);

      // --- DYNAMIC TOPOLOGY UPDATE ---
      const hasOriginMismatch = (realAuditData.findings || []).some((f: any) => f.finding_type === "SOURCE_MISMATCH");
      const hasQuantityDrift = (realAuditData.findings || []).some((f: any) => f.finding_type === "QUANTITY_DRIFT");
      const co2 = realAuditData.emissions_data?.total_emissions_kg;

      setActiveNodes(prev => prev.map(n => {
        if (n.id === "1") return { ...n, status: hasOriginMismatch ? "flagged" : "verified" };
        if (n.id === "2") return { ...n, status: (realAuditData.findings_count === 0 && realAuditData.audit_id.startsWith("VERITY-")) ? "verified" : n.status };
        if (n.id === "3") return { ...n, emissions: co2 ? `${co2.toFixed(1)}kg` : n.emissions };
        return n;
      }));

      if (realAuditData.violations_count > 0) {
        setActionState("ESCALATED");
        setActionAction("Drafting Escalation Email...");
      }

    } catch (err) {
      console.error("Agent audit failed via API", err);
      setCurrentStage("Pipeline error: Agent backend unreachable.");
      setAuditorState("ERROR"); setShieldState("ERROR"); setActionState("ERROR");
      updateStage(2, "error"); updateStage(3, "error"); updateStage(4, "error");
    }

    setIsExtracting(false);
  }, [updateStage, animateProgress, pushLog, resetAgents]);

  /* ==================================================================
     DIRECT RUN AUDIT (no file upload — uses mock or API)
     ================================================================== */
  const runAudit = useCallback(async () => {
    // Simulate the same pipeline but triggered via RUN AUDIT button
    const mockFiles: UploadedFile[] = [{
      name: "INV-2026-0402-003.pdf",
      size: 245000,
      type: "application/pdf",
      base64: "",
    }];
    await handleFilesAccepted(mockFiles);
  }, [handleFilesAccepted]);

  const formatEUR = (n: number) => {
    if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `€${(n / 1000).toFixed(0)}K`;
    return `€${n}`;
  };

  const agentStatuses = [
    { id: "deep_auditor", name: "DeepAuditor", icon: "🔍", status: auditorState, lastAction: auditorAction, processedItems: auditorItems, color: "#00E5FF" },
    { id: "regulatory_shield", name: "RegulatoryShield", icon: "⚖️", status: shieldState, lastAction: shieldAction, processedItems: shieldItems, color: "#B388FF" },
    { id: "action_agent", name: "ActionAgent", icon: "🔧", status: actionState, lastAction: actionAction, processedItems: actionItems, color: "#00FF41" },
  ];

  const isProcessing = isRunning || isExtracting;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-void)" }}>
      {/* ==================== HEADER ==================== */}
      <header
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{ background: "rgba(5, 5, 8, 0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="neon-dot animate-pulse-neon" />
            <h1 className="font-mono text-lg font-black tracking-wider neon-text">VERITY-NODES</h1>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-full" style={{ background: "rgba(0,255,65,0.08)", color: "var(--neon-green)", border: "1px solid rgba(0,255,65,0.2)" }}>
            AUTONOMOUS AUDIT NETWORK v2.0
          </span>
          {(auditResult || exposure >= 0) && (
            <span className="font-mono text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,0,64,0.08)", color: "var(--neon-red)", border: "1px solid rgba(255,0,64,0.2)" }}>
              EXPOSURE: {formatEUR(auditResult?.total_financial_exposure_eur ?? exposure)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          {auditResult?.claude_tokens && (
            <span className="font-mono text-xs" style={{ color: "var(--neon-cyan)" }}>
              🧠 {(auditResult.claude_tokens.input + auditResult.claude_tokens.output).toLocaleString()} tokens
            </span>
          )}
          <span className="font-mono text-sm" style={{ color: "var(--neon-green)" }}>{currentTime}</span>
          <button
            onClick={runAudit}
            disabled={isProcessing}
            className="font-mono text-xs font-bold tracking-wider px-5 py-2 rounded-lg transition-all duration-300"
            style={{
              background: isProcessing ? "rgba(255,184,0,0.15)" : "rgba(0,255,65,0.12)",
              color: isProcessing ? "#FFB800" : "#00FF41",
              border: `1px solid ${isProcessing ? "rgba(255,184,0,0.4)" : "rgba(0,255,65,0.4)"}`,
              boxShadow: isProcessing ? "0 0 20px rgba(255,184,0,0.1)" : "0 0 20px rgba(0,255,65,0.1)",
              cursor: isProcessing ? "wait" : "pointer",
            }}
          >
            {isProcessing ? "⟳ PROCESSING..." : "▶ RUN AUDIT"}
          </button>
        </div>
      </header>

      {/* ==================== MAIN GRID ==================== */}
      <main className="p-4 grid grid-cols-12 gap-4" style={{ minHeight: "calc(100vh - 56px)" }}>
        <div className="col-span-8 flex flex-col gap-4" style={{ minHeight: "calc(100vh - 80px)" }}>
          <ProcessingProgress
            isProcessing={isExtracting}
            progress={extractionProgress}
            currentStage={currentStage}
            stages={pipelineStages}
          />
          <div className="flex-1" style={{ minHeight: 0 }}>
            <LiveAgentFeed
              logs={agentLog.filter((log) => log.audit_id === currentAuditId)}
              filterAgent={selectedAgentFilter as any}
            />
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <FileDropZone onFilesAccepted={handleFilesAccepted} isProcessing={isProcessing} />
          <ComplianceGauge
            riskScore={auditResult?.overall_risk_score ?? riskScore}
            complianceStatus={auditResult?.compliance_status || "PENDING"}
            findingsCount={auditResult?.findings_count ?? findings.length}
            violationsCount={auditResult?.violations_count ?? violations.length}
          />
          <AgentStatusPanel
            agents={agentStatuses}
            loopCount={auditResult?.loop_count || 0}
            maxLoops={3}
            activeAgentId={selectedAgentFilter}
            onAgentClick={(id) => setSelectedAgentFilter(prev => prev === id ? null : id)}
            onActionClick={(id) => {
              if (id === 'action_agent') {
                const draft = auditResult?.supplier_email?.body || "DRAFT: Escalation required due to compliance violations detected by RegulatoryShield...";
                alert(`--- AI GENERATED ESCALATION DRAFT ---\n\n${draft}`);
              }
            }}
          />
          <ExportPDFButton auditData={auditResult} />
          <SupplyChainMap nodes={activeNodes} />
          <AuditTimeline events={
            auditResult
              ? [
                ...(auditResult.findings || []).map((f: any) => ({
                  time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                  agent: "DeepAuditor",
                  title: f.finding_type.replace(/_/g, " "),
                  description: f.description,
                  type: (f.severity === "CRITICAL" || f.severity === "HIGH" ? "error" : "warning") as any
                })),
                ...(auditResult.violations || []).map((v: any) => ({
                  time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                  agent: "RegulatoryShield",
                  title: `VIOLATION: ${v.regulation}`,
                  description: v.description,
                  type: "error" as any
                }))
              ].slice(-8) // Keep it manageable
              : []
          } />
        </div>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="px-6 py-3 flex items-center justify-between font-mono text-xs" style={{ borderTop: "1px solid var(--border-default)", color: "var(--text-muted)" }}>
        <span>VERITY-NODES v2.0.0 | EU ESPR 2024/0455 | GLEC Framework v3.0</span>
        <span>
          Central Brain: <span style={{ color: "var(--neon-cyan)" }}>Claude 3.5 Sonnet</span> |{" "}
          <span style={{ color: "var(--neon-green)" }}>Supabase</span> |{" "}
          <span style={{ color: "var(--neon-green)" }}>Climatiq</span> |{" "}
          <span style={{ color: "var(--neon-amber)" }}>GLEIF</span> |{" "}
          <span style={{ color: "var(--neon-purple)" }}>You.com</span>
        </span>
      </footer>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
