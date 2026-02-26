"use client";

import React from "react";

/* ======================================================================
   AGENT STATUS PANEL — Shows each agent's health, action, and live status
   Updated with SUCCESS/ACTIVE/ERROR/IDLE state transitions
   ====================================================================== */

interface AgentStatus {
    id: string;
    name: string;
    icon: string;
    status: "ACTIVE" | "IDLE" | "ERROR" | "PROCESSING" | "SUCCESS" | "ESCALATED";
    lastAction: string;
    processedItems: number;
    color: string;
}

interface AgentStatusPanelProps {
    agents: AgentStatus[];
    loopCount: number;
    maxLoops: number;
    activeAgentId?: string | null;
    onAgentClick?: (id: string) => void;
    onActionClick?: (agentId: string) => void;
}

const STATUS_CONFIG: Record<
    string,
    { label: string; dotColor: string; bg: string; border: string; glow: string }
> = {
    SUCCESS: {
        label: "SUCCESS",
        dotColor: "#00FF41",
        bg: "rgba(0,255,65,0.06)",
        border: "rgba(0,255,65,0.25)",
        glow: "0 0 10px rgba(0,255,65,0.2)",
    },
    ESCALATED: {
        label: "ESCALATED",
        dotColor: "#FF0040",
        bg: "rgba(255,0,64,0.08)",
        border: "rgba(255,0,64,0.4)",
        glow: "0 0 12px rgba(255,0,64,0.25)",
    },
    ACTIVE: {
        label: "ACTIVE",
        dotColor: "#00E5FF",
        bg: "rgba(0,229,255,0.06)",
        border: "rgba(0,229,255,0.25)",
        glow: "0 0 10px rgba(0,229,255,0.2)",
    },
    PROCESSING: {
        label: "SCANNING",
        dotColor: "#FFB800",
        bg: "rgba(255,184,0,0.06)",
        border: "rgba(255,184,0,0.25)",
        glow: "0 0 10px rgba(255,184,0,0.15)",
    },
    ERROR: {
        label: "ERROR",
        dotColor: "#FF0040",
        bg: "rgba(255,0,64,0.06)",
        border: "rgba(255,0,64,0.25)",
        glow: "0 0 10px rgba(255,0,64,0.15)",
    },
    IDLE: {
        label: "STANDBY",
        dotColor: "#666",
        bg: "rgba(255,255,255,0.02)",
        border: "rgba(255,255,255,0.06)",
        glow: "none",
    },
};

export default function AgentStatusPanel({
    agents,
    loopCount,
    maxLoops,
    activeAgentId,
    onAgentClick,
    onActionClick
}: AgentStatusPanelProps) {
    return (
        <div className="glass-panel p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>
                    AGENT NETWORK STATUS
                </h3>
                <span className="font-mono text-xs" style={{ color: "var(--neon-green)" }}>
                    Loop <span style={{ fontWeight: "bold" }}>{loopCount}</span>/{maxLoops}
                </span>
            </div>

            {agents.map((agent) => {
                const cfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.IDLE;
                const isActive = activeAgentId === agent.id;

                return (
                    <div
                        key={agent.id}
                        onClick={() => onAgentClick?.(agent.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-300 ${isActive ? 'ring-1 ring-inset ring-[var(--neon-cyan)]' : 'hover:translate-x-1'
                            }`}
                        style={{
                            background: isActive ? `${agent.color}15` : cfg.bg,
                            border: `1px solid ${isActive ? agent.color : cfg.border}`,
                            boxShadow: cfg.glow,
                        }}
                    >
                        {/* Agent Icon */}
                        <span className="text-xl flex-shrink-0">{agent.icon}</span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold" style={{ color: agent.color }}>
                                    {isActive ? `>> ${agent.name}` : agent.name}
                                </span>
                                {/* Status Dot */}
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{
                                        background: cfg.dotColor,
                                        boxShadow: `0 0 6px ${cfg.dotColor}`,
                                        animation:
                                            agent.status === "PROCESSING"
                                                ? "pulse-neon 1.5s ease-in-out infinite"
                                                : "none",
                                    }}
                                />
                                {/* Status Label */}
                                <span
                                    className="font-mono px-1.5 py-0.5 rounded text-[10px] ml-auto flex-shrink-0"
                                    style={{
                                        fontWeight: "bold",
                                        letterSpacing: "0.05em",
                                        color: cfg.dotColor,
                                        background: `${cfg.dotColor}15`,
                                        border: `1px solid ${cfg.dotColor}30`,
                                    }}
                                >
                                    {cfg.label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                                <p className="font-mono text-[10px] truncate pr-2" style={{ color: "var(--text-secondary)" }}>
                                    {agent.lastAction}
                                </p>
                                {agent.id === 'action_agent' && (agent.status === 'SUCCESS' || agent.status === 'ESCALATED') && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onActionClick?.(agent.id);
                                        }}
                                        className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#00FF41] hover:bg-[#00FF41] hover:text-[#0b0b0e] transition-colors"
                                        style={{ color: "#00FF41" }}
                                    >
                                        VIEW DRAFT
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Processed Count */}
                        <div className="flex flex-col items-end flex-shrink-0">
                            <span className="font-mono text-lg font-bold" style={{ color: agent.color }}>
                                {agent.processedItems}
                            </span>
                            <span className="font-mono" style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>
                                {agent.id === 'regulatory_shield' ? 'viols' : 'items'}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
