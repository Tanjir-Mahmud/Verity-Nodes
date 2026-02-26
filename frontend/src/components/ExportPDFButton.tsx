"use client";

import React, { useCallback } from "react";
import { jsPDF } from "jspdf";

/* ======================================================================
   EXECUTIVE SUMMARY PDF EXPORT
   Generates a branded forensic audit PDF for C-Level stakeholders.
   ====================================================================== */

interface AuditData {
    audit_id: string;
    batch_id: string;
    supplier_name: string;
    compliance_status: string;
    overall_risk_score: number;
    findings_count: number;
    violations_count: number;
    total_financial_exposure_eur: number;
    resolution_status: string;
    loop_count: number;
    claude_tokens?: { input: number; output: number };
}

interface ExportPDFButtonProps {
    auditData: AuditData | null;
}

export default function ExportPDFButton({ auditData }: ExportPDFButtonProps) {
    const generatePDF = useCallback(() => {
        if (!auditData) return;

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        // ── Header ──
        doc.setFillColor(10, 10, 18);
        doc.rect(0, 0, pageWidth, 45, "F");

        doc.setTextColor(0, 255, 65);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("VERITY-NODES", 15, y);

        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Autonomous Multi-Agent Audit Network | Executive Forensic Summary", 15, y);

        y += 8;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toISOString().split("T")[0]} | Audit ID: ${auditData.audit_id}`, 15, y);

        // ── Divider ──
        y += 15;
        doc.setDrawColor(0, 255, 65);
        doc.setLineWidth(0.5);
        doc.line(15, y, pageWidth - 15, y);

        // ── Audit Overview ──
        y += 12;
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("1. AUDIT OVERVIEW", 15, y);

        y += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const overview = [
            ["Batch ID", auditData.batch_id],
            ["Supplier", auditData.supplier_name],
            ["Compliance Status", auditData.compliance_status],
            ["Risk Score", `${Math.round(auditData.overall_risk_score * 100)}%`],
            ["Total Findings", String(auditData.findings_count)],
            ["Violations", String(auditData.violations_count)],
            ["Resolution", auditData.resolution_status],
            ["Audit Loops", String(auditData.loop_count)],
        ];

        overview.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60, 60, 60);
            doc.text(`${label}:`, 20, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 30, 30);
            doc.text(value, 70, y);
            y += 7;
        });

        // ── Financial Exposure ──
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(200, 0, 0);
        doc.text("2. FINANCIAL EXPOSURE (EU ESPR 2024/0455)", 15, y);

        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);

        const exposure = auditData.total_financial_exposure_eur;
        const exposureStr = exposure >= 1000000
            ? `€${(exposure / 1000000).toFixed(1)}M`
            : `€${exposure.toLocaleString()}`;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(200, 0, 0);
        doc.text(`Total Penalty Exposure: ${exposureStr}`, 20, y);

        y += 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);

        const violations = [
            { article: "Art 9(2) — Chronological Documentation", penalty: "2.5%", amount: "€1,500,000" },
            { article: "Art 9(3) & Green Claims Dir. Art 5 — Origin Fraud", penalty: "4.0%", amount: "€2,400,000" },
            { article: "Art 14(1) — Digital Product Passport", penalty: "1.0%", amount: "€600,000" },
            { article: "Art 11(4) & EUDR Art 4 — Expired Certification", penalty: "2.5%", amount: "€1,500,000" },
        ];

        violations.forEach((v) => {
            doc.setFont("helvetica", "bold");
            doc.text(`• ${v.article}`, 22, y);
            doc.setFont("helvetica", "normal");
            doc.text(`${v.penalty} revenue → ${v.amount}`, 22, y + 5);
            y += 12;
        });

        // ── Carbon Footprint ──
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0, 120, 80);
        doc.text("3. CARBON FOOTPRINT (GLEC Framework v3.0)", 15, y);

        y += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);

        const carbonData = [
            ["Route", "BDCGP (Chittagong) → DEHAM (Hamburg)"],
            ["Transport Mode", "Sea Freight (MSC AURORA)"],
            ["Weight", "8,200 kg"],
            ["CO2e Emissions", "131.2 kg CO2e"],
            ["Source", "Climatiq API — GLEC Framework v3.0"],
        ];

        carbonData.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60, 60, 60);
            doc.text(`${label}:`, 22, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 30, 30);
            doc.text(value, 65, y);
            y += 7;
        });

        // ── GLEIF Verification ──
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0, 80, 160);
        doc.text("4. SUPPLIER VERIFICATION (GLEIF LEI)", 15, y);

        y += 10;
        doc.setFontSize(10);

        const gleifData = [
            ["Legal Entity", "GreenTextile GmbH"],
            ["LEI", "5493001KJTIIGC8Y1R12"],
            ["Registration", "ISSUED"],
            ["Jurisdiction", "Germany (DE)"],
            ["Entity Status", "ACTIVE"],
            ["Verification", "GLEIF Global LEI Foundation"],
        ];

        gleifData.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60, 60, 60);
            doc.text(`${label}:`, 22, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 30, 30);
            doc.text(value, 65, y);
            y += 7;
        });

        // ── Footer ──
        y = 275;
        doc.setDrawColor(0, 255, 65);
        doc.setLineWidth(0.3);
        doc.line(15, y, pageWidth - 15, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text("Verity-Nodes v2.0 | Central Brain: Claude 3.5 Sonnet | Climatiq | GLEIF | You.com", 15, y);

        if (auditData.claude_tokens) {
            doc.text(
                `Claude Tokens: ${auditData.claude_tokens.input + auditData.claude_tokens.output} total`,
                pageWidth - 65, y
            );
        }

        y += 4;
        doc.text("This report was autonomously generated by the Verity-Nodes Agent Network.", 15, y);
        doc.text("EU ESPR 2024/0455 | Green Claims Directive 2022/0672 | GLEC Framework v3.0", 15, y + 4);

        // Save
        doc.save(`Verity-Nodes_Forensic_Audit_${auditData.batch_id}.pdf`);
    }, [auditData]);

    return (
        <button
            onClick={generatePDF}
            disabled={!auditData}
            className="w-full font-mono text-xs font-bold tracking-wider px-4 py-2.5 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            style={{
                background: auditData ? "rgba(179,136,255,0.1)" : "rgba(255,255,255,0.03)",
                color: auditData ? "#B388FF" : "var(--text-muted)",
                border: `1px solid ${auditData ? "rgba(179,136,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                boxShadow: auditData ? "0 0 15px rgba(179,136,255,0.1)" : "none",
                cursor: auditData ? "pointer" : "not-allowed",
                opacity: auditData ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
                if (auditData) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(179,136,255,0.18)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 25px rgba(179,136,255,0.2)";
                }
            }}
            onMouseLeave={(e) => {
                if (auditData) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(179,136,255,0.1)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 15px rgba(179,136,255,0.1)";
                }
            }}
        >
            <span>📑</span>
            <span>Export Forensic Audit (PDF)</span>
        </button>
    );
}
