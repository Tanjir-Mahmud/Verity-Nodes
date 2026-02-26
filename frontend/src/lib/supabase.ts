/**
 * Verity-Nodes: Supabase Client
 * Handles document storage in the 'audits' bucket and session logging.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let _supabase: SupabaseClient | null = null;

/**
 * Get the singleton Supabase client instance.
 * Returns null if environment variables are not configured.
 */
export function getSupabase(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("[Verity-Nodes] Supabase not configured — missing env vars.");
        return null;
    }

    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _supabase;
}

/**
 * Upload a document to the 'audits' bucket in Supabase Storage.
 * Returns the public URL for DeepAuditor vision scan.
 */
export async function uploadAuditDocument(
    file: File | Blob,
    fileName: string,
    auditId: string
): Promise<{ url: string | null; path: string; error: string | null }> {
    const supabase = getSupabase();
    if (!supabase) {
        return { url: null, path: "", error: "Supabase not configured" };
    }

    const filePath = `${auditId}/${Date.now()}_${fileName}`;

    const { data, error } = await supabase.storage
        .from("audits")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
        });

    if (error) {
        console.warn("[Supabase] Upload warning:", error.message);
        return { url: null, path: filePath, error: error.message };
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
        .from("audits")
        .getPublicUrl(data.path);

    return {
        url: urlData?.publicUrl || null,
        path: data.path,
        error: null,
    };
}

/**
 * Log an audit session event to Supabase (table: audit_logs).
 */
export async function logAuditEvent(event: {
    audit_id: string;
    agent: string;
    action: string;
    details: string;
    severity: string;
}): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        await supabase.from("audit_logs").insert({
            ...event,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        // Non-blocking — session logging is best-effort
        console.warn("[Supabase] Log insert failed:", err);
    }
}
