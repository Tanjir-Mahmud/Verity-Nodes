"use client";

import React from "react";

/* ======================================================================
   AUDIT TIMELINE — Chronological event display
   ====================================================================== */
interface TimelineEvent {
    time: string;
    agent: string;
    title: string;
    description: string;
    type: "success" | "warning" | "error" | "info";
}

const TYPE_STYLES: Record<string, { dot: string; color: string }> = {
    success: { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(0,255,65,0.5)]", color: "#00FF41" },
    warning: { dot: "bg-amber-400 shadow-[0_0_8px_rgba(255,184,0,0.5)]", color: "#FFB800" },
    error: { dot: "bg-red-400 shadow-[0_0_8px_rgba(255,0,64,0.5)]", color: "#FF0040" },
    info: { dot: "bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.5)]", color: "#00E5FF" },
};

export default function AuditTimeline({ events }: { events: TimelineEvent[] }) {
    return (
        <div className="glass-panel p-5">
            <h3
                className="font-mono text-xs font-bold tracking-wider mb-4"
                style={{ color: "var(--text-muted)" }}
            >
                AUDIT TIMELINE
            </h3>

            <div className="relative">
                {/* Vertical Line */}
                <div
                    className="absolute left-[11px] top-0 bottom-0 w-px"
                    style={{ background: "var(--border-default)" }}
                />

                <div className="flex flex-col gap-4">
                    {events.map((event, i) => {
                        const style = TYPE_STYLES[event.type] || TYPE_STYLES.info;
                        return (
                            <div
                                key={i}
                                className="flex gap-4 animate-fade-in-up"
                                style={{ animationDelay: `${i * 0.1}s` }}
                            >
                                {/* Dot */}
                                <div className="flex flex-col items-center flex-shrink-0 z-10">
                                    <div
                                        className={`w-[10px] h-[10px] rounded-full mt-1.5 ${style.dot}`}
                                    />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 pb-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span
                                            className="font-mono text-xs font-semibold"
                                            style={{ color: style.color }}
                                        >
                                            {event.agent}
                                        </span>
                                        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                                            {event.time}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                        {event.title}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                        {event.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
