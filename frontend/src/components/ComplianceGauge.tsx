"use client";

import React, { useState, useEffect, useRef } from "react";

/* ======================================================================
   COMPLIANCE GAUGE — Animated SVG ring with counter tick effect
   ====================================================================== */
interface ComplianceGaugeProps {
    riskScore: number;     // 0.0 – 1.0
    complianceStatus: string;
    findingsCount: number;
    violationsCount: number;
}

/** Custom hook: animates a number from 0 → target with easing. */
function useCountUp(target: number, durationMs: number = 1500) {
    const [value, setValue] = useState(0);
    const prevTarget = useRef(0);

    useEffect(() => {
        if (target === prevTarget.current) return;
        const start = prevTarget.current;
        prevTarget.current = target;
        const diff = target - start;
        if (diff === 0) return;

        const startTime = performance.now();

        function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            // Cubic ease-out
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(start + diff * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }, [target, durationMs]);

    return value;
}

export default function ComplianceGauge({
    riskScore,
    complianceStatus,
    findingsCount,
    violationsCount,
}: ComplianceGaugeProps) {
    // Animated values
    const animatedRisk = useCountUp(riskScore, 1800);
    const animatedFindings = useCountUp(findingsCount, 1200);
    const animatedViolations = useCountUp(violationsCount, 1400);

    const percentage = Math.round(animatedRisk * 100);
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (animatedRisk * circumference);

    const getColor = () => {
        if (animatedRisk >= 0.8) return { stroke: "#FF0040", glow: "rgba(255,0,64,0.3)" };
        if (animatedRisk >= 0.5) return { stroke: "#FFB800", glow: "rgba(255,184,0,0.3)" };
        if (animatedRisk >= 0.01) return { stroke: "#00E5FF", glow: "rgba(0,229,255,0.3)" };
        return { stroke: "#00FF41", glow: "rgba(0,255,65,0.3)" };
    };

    const color = getColor();
    const statusLabel = complianceStatus === "COMPLIANT" ? "COMPLIANT" :
        complianceStatus === "NON_COMPLIANT" ? "NON-COMPLIANT" : "PENDING REVIEW";

    return (
        <div className="glass-panel p-6 flex flex-col items-center gap-4">
            <h3 className="font-mono text-xs font-bold tracking-wider self-start" style={{ color: "var(--text-muted)" }}>
                RISK ASSESSMENT
            </h3>

            {/* SVG Gauge */}
            <div className="relative" style={{ width: 160, height: 160 }}>
                <svg width="160" height="160" className="transform -rotate-90">
                    <circle cx="80" cy="80" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle
                        cx="80" cy="80" r="45" fill="none"
                        stroke={color.stroke}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 8px ${color.glow})`, transition: "stroke 0.5s ease" }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-3xl font-black" style={{ color: color.stroke, textShadow: `0 0 20px ${color.glow}` }}>
                        {percentage}%
                    </span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>RISK</span>
                </div>
            </div>

            {/* Status Badge */}
            <div className={`text-center font-mono text-xs font-bold tracking-wider px-4 py-1.5 rounded-full ${complianceStatus === "COMPLIANT" ? "badge-success" : complianceStatus === "NON_COMPLIANT" ? "badge-critical" : "badge-warning"}`}>
                {statusLabel}
            </div>

            {/* Animated Stats */}
            <div className="flex gap-6 w-full">
                <div className="flex-1 text-center">
                    <span className="block font-mono text-2xl font-bold" style={{ color: "var(--neon-amber)" }}>
                        {Math.round(animatedFindings)}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Findings</span>
                </div>
                <div className="w-px" style={{ background: "var(--border-default)" }} />
                <div className="flex-1 text-center">
                    <span className="block font-mono text-2xl font-bold" style={{ color: "var(--neon-red)" }}>
                        {Math.round(animatedViolations)}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Violations</span>
                </div>
            </div>
        </div>
    );
}
