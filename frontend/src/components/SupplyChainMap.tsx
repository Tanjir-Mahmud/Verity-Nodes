"use client";

import React from "react";

/* ======================================================================
   SUPPLY CHAIN MAP — Visual topology of the supply chain
   ====================================================================== */
interface SupplyChainNode {
    id: string;
    label: string;
    subLabel?: string;
    type: "supplier" | "port" | "logistics" | "warehouse" | "destination";
    status: "verified" | "flagged" | "unverified";
    location: string;
    emissions?: string;
}

const DEFAULT_NODES: SupplyChainNode[] = [
    { id: "1", label: "GreenTextile GmbH", type: "supplier", status: "unverified", location: "Bangladesh" },
    { id: "2", label: "Port Chittagong", type: "port", status: "unverified", location: "BDCGP" },
    { id: "3", label: "MSC AURORA", type: "logistics", status: "verified", location: "Indian Ocean", subLabel: "Vessel: 9817078" },
    { id: "4", label: "Port Hamburg", type: "port", status: "verified", location: "DEHAM" },
    { id: "5", label: "EU Distribution", type: "warehouse", status: "unverified", location: "Germany" },
    { id: "6", label: "Retail (EU Market)", type: "destination", status: "verified", location: "EU" },
];

const TYPE_ICONS: Record<string, string> = {
    supplier: "🏭",
    port: "🚢",
    logistics: "🌊",
    warehouse: "📦",
    destination: "🏪",
};

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
    verified: { border: "#00FF41", bg: "rgba(0,255,65,0.08)", text: "#00FF41" },
    flagged: { border: "#FF0040", bg: "rgba(255,0,64,0.08)", text: "#FF0040" },
    unverified: { border: "rgba(255,255,255,0.2)", bg: "rgba(255,255,255,0.02)", text: "var(--text-muted)" },
};

export default function SupplyChainMap({ nodes = DEFAULT_NODES }: { nodes?: SupplyChainNode[] }) {
    return (
        <div className="glass-panel p-5">
            <h3
                className="font-mono text-xs font-bold tracking-wider mb-4"
                style={{ color: "var(--text-muted)" }}
            >
                SUPPLY CHAIN TOPOLOGY
            </h3>

            <div className="flex flex-col gap-3">
                {nodes.map((node, i) => {
                    const colors = STATUS_COLORS[node.status] || STATUS_COLORS.unverified;
                    return (
                        <React.Fragment key={node.id}>
                            <div
                                className="flex items-center gap-3 p-3 rounded-lg transition-all duration-300 animate-fade-in-up"
                                style={{
                                    background: colors.bg,
                                    border: `1px solid ${colors.border}${node.status === 'unverified' ? '' : '40'}`,
                                    animationDelay: `${i * 0.15}s`,
                                }}
                            >
                                <span className="text-xl flex-shrink-0">{TYPE_ICONS[node.type]}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold truncate" style={{ color: colors.text }}>
                                            {node.label}
                                        </span>
                                        <span
                                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${node.status === "verified" ? "badge-success" :
                                                node.status === "flagged" ? "badge-critical" :
                                                    "badge-secondary"
                                                }`}
                                        >
                                            {node.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                                            {node.subLabel || node.location}
                                        </span>
                                        {node.emissions && (
                                            <span className="font-mono text-[10px] px-1 rounded" style={{ background: "rgba(0,229,255,0.1)", color: "var(--neon-cyan)" }}>
                                                💨 {node.emissions} CO2e
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Connector Arrow */}
                            {i < nodes.length - 1 && (
                                <div className="flex justify-center my-0.5">
                                    <div className="flex flex-col items-center">
                                        <span style={{ color: "rgba(0,255,65,0.3)", fontSize: "10px" }}>▼</span>
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
