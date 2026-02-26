"use client";

import React from "react";

/* ======================================================================
   PROCESSING PROGRESS BAR — Animated extraction pipeline indicator
   ====================================================================== */

interface ProcessingStage {
    label: string;
    icon: string;
    status: "pending" | "active" | "complete" | "error";
}

interface ProcessingProgressProps {
    isProcessing: boolean;
    progress: number; // 0-100
    currentStage: string;
    stages: ProcessingStage[];
}

export default function ProcessingProgress({
    isProcessing,
    progress,
    currentStage,
    stages,
}: ProcessingProgressProps) {
    if (!isProcessing && progress === 0) return null;

    return (
        <div className="glass-panel p-4 flex flex-col gap-3 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>
                    EXTRACTION PIPELINE
                </h3>
                <span className="font-mono text-xs font-bold" style={{ color: "var(--neon-green)" }}>
                    {Math.round(progress)}%
                </span>
            </div>

            {/* Progress Bar */}
            <div
                className="relative h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
            >
                {/* Fill */}
                <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${progress}%`,
                        background: progress >= 100
                            ? "var(--neon-green)"
                            : "linear-gradient(90deg, var(--neon-green), var(--neon-cyan))",
                        boxShadow: `0 0 12px rgba(0,255,65,0.4)`,
                    }}
                />

                {/* Scanning shimmer */}
                {isProcessing && progress < 100 && (
                    <div
                        className="absolute top-0 h-full w-20 rounded-full"
                        style={{
                            background: "linear-gradient(90deg, transparent, rgba(0,255,65,0.3), transparent)",
                            animation: "progress-shimmer 1.8s ease-in-out infinite",
                            left: `${Math.max(0, progress - 10)}%`,
                        }}
                    />
                )}
            </div>

            {/* Current Stage */}
            <p className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                {currentStage}
            </p>

            {/* Pipeline Stages */}
            <div className="flex items-center gap-1">
                {stages.map((stage, i) => (
                    <React.Fragment key={i}>
                        {/* Stage Node */}
                        <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all duration-500"
                                style={{
                                    background:
                                        stage.status === "complete" ? "rgba(0,255,65,0.15)" :
                                            stage.status === "active" ? "rgba(0,229,255,0.15)" :
                                                stage.status === "error" ? "rgba(255,0,64,0.15)" :
                                                    "rgba(255,255,255,0.03)",
                                    border: `1px solid ${stage.status === "complete" ? "rgba(0,255,65,0.4)" :
                                            stage.status === "active" ? "rgba(0,229,255,0.4)" :
                                                stage.status === "error" ? "rgba(255,0,64,0.4)" :
                                                    "rgba(255,255,255,0.08)"
                                        }`,
                                    boxShadow:
                                        stage.status === "active" ? "0 0 12px rgba(0,229,255,0.3)" :
                                            stage.status === "complete" ? "0 0 8px rgba(0,255,65,0.2)" :
                                                "none",
                                    animation: stage.status === "active" ? "pulse-neon 2s ease-in-out infinite" : "none",
                                }}
                            >
                                {stage.status === "complete" ? "✓" : stage.icon}
                            </div>
                            <span
                                className="font-mono text-center truncate w-full"
                                style={{
                                    fontSize: "0.6rem",
                                    color:
                                        stage.status === "active" ? "var(--neon-cyan)" :
                                            stage.status === "complete" ? "var(--neon-green)" :
                                                "var(--text-muted)",
                                }}
                            >
                                {stage.label}
                            </span>
                        </div>

                        {/* Connector */}
                        {i < stages.length - 1 && (
                            <div
                                className="h-px flex-shrink-0 mt-[-14px]"
                                style={{
                                    width: "12px",
                                    background: stage.status === "complete"
                                        ? "rgba(0,255,65,0.4)"
                                        : "rgba(255,255,255,0.08)",
                                }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
