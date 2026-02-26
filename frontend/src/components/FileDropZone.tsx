"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";

/* ======================================================================
   FILE DROP ZONE — Neon-bordered upload intake for the audit pipeline
   ====================================================================== */

interface UploadedFile {
    name: string;
    size: number;
    type: string;
    base64: string;
}

interface FileDropZoneProps {
    onFilesAccepted: (files: UploadedFile[]) => void;
    isProcessing: boolean;
}

const ACCEPTED_TYPES: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export default function FileDropZone({ onFilesAccepted, isProcessing }: FileDropZoneProps) {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(
        async (acceptedFiles: File[], rejections: FileRejection[]) => {
            setError(null);

            if (rejections.length > 0) {
                const reasons = rejections.map((r) => `${r.file.name}: ${r.errors.map((e) => e.message).join(", ")}`);
                setError(reasons.join("; "));
                return;
            }

            if (acceptedFiles.length === 0) return;

            // Convert files to base64
            const processed: UploadedFile[] = [];
            for (const file of acceptedFiles) {
                const base64 = await fileToBase64(file);
                processed.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    base64,
                });
            }

            setUploadedFiles((prev) => [...prev, ...processed]);
            onFilesAccepted(processed);
        },
        [onFilesAccepted]
    );

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: ACCEPTED_TYPES,
        maxSize: MAX_FILE_SIZE,
        disabled: isProcessing,
        multiple: true,
    });

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    };

    const borderColor = isDragReject
        ? "var(--neon-red)"
        : isDragActive
            ? "var(--neon-green)"
            : "rgba(0,255,65,0.25)";

    const bgColor = isDragReject
        ? "rgba(255,0,64,0.05)"
        : isDragActive
            ? "rgba(0,255,65,0.08)"
            : "rgba(0,255,65,0.02)";

    return (
        <div className="glass-panel p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>
                    DOCUMENT INTAKE
                </h3>
                {uploadedFiles.length > 0 && (
                    <span className="font-mono text-xs" style={{ color: "var(--neon-green)" }}>
                        {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Drop Zone */}
            <div
                {...getRootProps()}
                className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-lg cursor-pointer transition-all duration-300"
                style={{
                    border: `2px dashed ${borderColor}`,
                    background: bgColor,
                    minHeight: "120px",
                    boxShadow: isDragActive ? `0 0 25px rgba(0,255,65,0.15), inset 0 0 25px rgba(0,255,65,0.05)` : "none",
                    animation: isDragActive ? "glow-pulse 1.5s ease-in-out infinite" : "none",
                    opacity: isProcessing ? 0.5 : 1,
                    pointerEvents: isProcessing ? "none" : "auto",
                }}
            >
                <input {...getInputProps()} id="file-upload-input" />

                {/* Icon */}
                <div
                    className="text-3xl transition-transform duration-300"
                    style={{ transform: isDragActive ? "scale(1.2)" : "scale(1)" }}
                >
                    {isDragReject ? "🚫" : isDragActive ? "📥" : "📄"}
                </div>

                {/* Text */}
                <p className="font-mono text-xs text-center" style={{ color: isDragActive ? "var(--neon-green)" : "var(--text-secondary)" }}>
                    {isDragReject
                        ? "Invalid file type — PDF, PNG, JPG only"
                        : isDragActive
                            ? "Drop to begin forensic analysis..."
                            : "Drop invoices, certificates, or bills of lading"}
                </p>
                <p className="font-mono text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
                    PDF · PNG · JPG · Max 20MB
                </p>

                {/* Scanning line animation when active */}
                {isDragActive && (
                    <div
                        className="absolute left-0 right-0 h-px"
                        style={{
                            background: "linear-gradient(90deg, transparent, var(--neon-green), transparent)",
                            animation: "scan-line 2s ease-in-out infinite",
                            top: "50%",
                        }}
                    />
                )}
            </div>

            {/* File List */}
            {uploadedFiles.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                    {uploadedFiles.map((file, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md animate-fade-in-up"
                            style={{
                                background: "rgba(0,255,65,0.04)",
                                border: "1px solid rgba(0,255,65,0.1)",
                                animationDelay: `${i * 0.1}s`,
                            }}
                        >
                            <span className="text-sm flex-shrink-0">
                                {file.type.includes("pdf") ? "📄" : "🖼️"}
                            </span>
                            <span className="font-mono text-xs truncate flex-1" style={{ color: "var(--text-primary)" }}>
                                {file.name}
                            </span>
                            <span className="font-mono text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                                {formatSize(file.size)}
                            </span>
                            <span className="neon-dot" style={{ width: "5px", height: "5px" }} />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <p className="font-mono text-xs" style={{ color: "var(--neon-red)" }}>
                    ⚠ {error}
                </p>
            )}
        </div>
    );
}

/* ======================================================================
   UTILITY
   ====================================================================== */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the data:...;base64, prefix
            const base64 = result.split(",")[1] || result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
