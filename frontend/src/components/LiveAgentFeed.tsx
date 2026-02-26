"use client";

import React, { useState, useEffect, useRef } from "react";

/* ======================================================================
   TYPE DEFINITIONS
   ====================================================================== */
interface AgentLogEntry {
    timestamp: string;
    agent: "DEEP_AUDITOR" | "REGULATORY_SHIELD" | "ACTION_AGENT" | "SYSTEM" | "HUMAN";
    action: string;
    details: string;
    severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
}

/* ======================================================================
   EU LAW DEEP-LINK MAP — Clickable citations
   ====================================================================== */
const EU_LAW_LINKS: Record<string, { label: string; url: string }> = {
    "Art 9(2)": { label: "Art 9(2)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 9(2)": { label: "Art. 9(2)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art 9(3)": { label: "Art 9(3)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 9(3)": { label: "Art. 9(3)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art 14(1)": { label: "Art 14(1)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 14(1)": { label: "Art. 14(1)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 11(4)": { label: "Art. 11(4)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art 11(4)": { label: "Art 11(4)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 7(2)": { label: "Art. 7(2)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 48": { label: "Art. 48", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024PC0455" },
    "Art. 5": { label: "Art. 5", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52022PC0672" },
    "Art 5": { label: "Art 5", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52022PC0672" },
    "Art. 4": { label: "Art. 4", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1115" },
};

/* ======================================================================
   CONSTANTS
   ====================================================================== */
const AGENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    DEEP_AUDITOR: { icon: "🔍", color: "#00E5FF", label: "DeepAuditor" },
    REGULATORY_SHIELD: { icon: "⚖️", color: "#B388FF", label: "RegulatoryShield" },
    ACTION_AGENT: { icon: "🔧", color: "#00FF41", label: "ActionAgent" },
    SYSTEM: { icon: "⚡", color: "#FFB800", label: "System" },
    HUMAN: { icon: "👤", color: "#FF0040", label: "Human Operator" },
};

const SEVERITY_CLASSES: Record<string, string> = {
    INFO: "badge-info",
    WARNING: "badge-warning",
    ERROR: "badge-critical",
    CRITICAL: "badge-critical",
};

/* ======================================================================
   REPUTATION CARD — You.com scandal snippet
   ====================================================================== */
interface ReputationCardData {
    title: string;
    source: string;
    url: string;
    riskLevel: string;
}

function ReputationCard({ card }: { card: ReputationCardData }) {
    return (
        <div
            className="mt-2 rounded-lg px-3 py-2.5 transition-all duration-300"
            style={{
                background: "rgba(255,0,64,0.04)",
                border: "1px solid rgba(255,0,64,0.15)",
                borderLeft: "3px solid #FF0040",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,0,64,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,0,64,0.04)"; }}
        >
            <div className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0 mt-0.5">📰</span>
                <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold mb-1" style={{ color: "var(--neon-red)" }}>
                        REPUTATION ALERT — {card.riskLevel}
                    </p>
                    <p className="text-xs mb-1.5" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        {card.title}
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="font-mono" style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
                            {card.source}
                        </span>
                        <a
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs transition-colors"
                            style={{ color: "var(--neon-cyan)", textDecoration: "underline" }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#fff"; }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--neon-cyan)"; }}
                        >
                            View Source →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ======================================================================
   TEXT RENDERER — Injects clickable EU law links
   ====================================================================== */
function renderDetailsWithCitations(text: string): React.ReactNode {
    // Build regex from EU_LAW_LINKS keys, sorted by length (longest first)
    const keys = Object.keys(EU_LAW_LINKS).sort((a, b) => b.length - a.length);
    const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(${escaped.join("|")})`, "g");

    const parts = text.split(regex);

    return parts.map((part, i) => {
        const link = EU_LAW_LINKS[part];
        if (link) {
            return (
                <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-bold transition-all duration-200"
                    style={{
                        color: "#B388FF",
                        textDecoration: "underline",
                        textDecorationColor: "rgba(179,136,255,0.4)",
                        textUnderlineOffset: "2px",
                        cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.color = "#E0C0FF";
                        (e.target as HTMLElement).style.textShadow = "0 0 8px rgba(179,136,255,0.5)";
                    }}
                    onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.color = "#B388FF";
                        (e.target as HTMLElement).style.textShadow = "none";
                    }}
                    title={`Open EU legislation: ${link.label}`}
                >
                    {part}
                </a>
            );
        }
        return <span key={i}>{part}</span>;
    });
}

/* ======================================================================
   REPUTATION CARD DETECTION
   ====================================================================== */
function getReputationCard(entry: AgentLogEntry): ReputationCardData | null {
    if (
        entry.agent === "REGULATORY_SHIELD" &&
        (entry.action === "SCANDAL_DETECTED" || entry.action === "LIVE_INTEL_CLEAR")
    ) {
        if (entry.action === "SCANDAL_DETECTED") {
            return {
                title: entry.details,
                source: "You.com Search API",
                url: "https://you.com/search?q=GreenTextile+GmbH+sustainability+scandal",
                riskLevel: "HIGH",
            };
        }
    }

    // Mock reputation card for demo purposes when live intel is checked
    if (
        entry.agent === "REGULATORY_SHIELD" &&
        entry.action === "LIVE_INTEL_CLEAR" &&
        entry.details.includes("LOW risk")
    ) {
        return {
            title: "No recent environmental violations or labor disputes found for this supplier in the past 12 months.",
            source: "You.com Search API — Live Intelligence",
            url: "https://you.com/search?q=GreenTextile+GmbH+environmental+compliance",
            riskLevel: "LOW",
        };
    }

    return null;
}

/* ======================================================================
   COMPONENT
   ====================================================================== */
export default function LiveAgentFeed({ logs, filterAgent }: { logs: AgentLogEntry[], filterAgent?: string | null }) {
    const feedRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(0);

    const filteredLogs = filterAgent
        ? logs.filter(log => log.agent === filterAgent)
        : logs;

    useEffect(() => {
        if (visibleCount < filteredLogs.length) {
            const timer = setTimeout(() => setVisibleCount((c) => c + 1), 80);
            return () => clearTimeout(timer);
        }
    }, [visibleCount, filteredLogs.length]);

    useEffect(() => {
        // Reset visibility when filter changes
        setVisibleCount(filteredLogs.length > 0 ? 1 : 0);
    }, [filterAgent]);

    useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, [visibleCount]);

    return (
        <div className="glass-panel p-0 overflow-hidden flex flex-col" style={{ height: "100%" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
                <div className="flex items-center gap-3">
                    <div className="neon-dot animate-pulse-neon" />
                    <h2 className="font-mono text-sm font-bold tracking-wider" style={{ color: "var(--neon-green)" }}>
                        LIVE AGENT ORCHESTRATION FEED
                    </h2>
                    {filterAgent && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white flex items-center gap-1">
                            FILTER: {filterAgent}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(0,229,255,0.1)", color: "var(--neon-cyan)" }}>CLAUDE 3.5</span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{filteredLogs.length} events</span>
                </div>
            </div>

            {/* Feed */}
            <div ref={feedRef} className="flex-1 overflow-y-auto p-4 data-stream-bg" style={{ minHeight: 0 }}>
                <div className="flex flex-col gap-2">
                    {filteredLogs.slice(0, visibleCount).map((entry, i) => {
                        const agent = AGENT_CONFIG[entry.agent] || AGENT_CONFIG.SYSTEM;
                        const sevClass = SEVERITY_CLASSES[entry.severity] || "badge-info";
                        const reputationCard = getReputationCard(entry);

                        return (
                            <div key={i}>
                                <div
                                    className="animate-slide-in flex items-start gap-3 px-3 py-2 rounded-lg transition-all duration-200"
                                    style={{
                                        background: entry.severity === "CRITICAL" ? "rgba(255,0,64,0.05)" : "rgba(255,255,255,0.02)",
                                        borderLeft: `3px solid ${agent.color}`,
                                        animationDelay: `${i * 0.05}s`,
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = entry.severity === "CRITICAL" ? "rgba(255,0,64,0.08)" : "rgba(255,255,255,0.05)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = entry.severity === "CRITICAL" ? "rgba(255,0,64,0.05)" : "rgba(255,255,255,0.02)"; }}
                                >
                                    <span className="text-lg mt-0.5 flex-shrink-0">{agent.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-mono text-xs font-bold" style={{ color: agent.color }}>{agent.label}</span>
                                            <span className={sevClass}>{entry.severity}</span>
                                            <span className="font-mono text-xs ml-auto flex-shrink-0" style={{ color: "var(--text-muted)" }}>{entry.action}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                            {renderDetailsWithCitations(entry.details)}
                                        </p>
                                    </div>
                                </div>

                                {/* Reputation Card (Task 2) */}
                                {reputationCard && (
                                    <div className="ml-8 animate-fade-in-up">
                                        <ReputationCard card={reputationCard} />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {visibleCount >= logs.length && logs.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 animate-pulse-neon">
                            <span className="font-mono text-xs" style={{ color: "var(--neon-green)" }}>█</span>
                            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Awaiting next audit cycle...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
