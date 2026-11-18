"use client";

import { useState } from "react";
import DownloadIcon from "@/components/ui/download-icon";

export function DataExportButton({ className = "button" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to download your account data." : "Could not prepare your data export.");
      const account = await response.json();
      let browserDraft: unknown = null;
      try { browserDraft = JSON.parse(localStorage.getItem("forme-resume-v1") ?? "null"); } catch { /* leave malformed local storage out of the export */ }
      const blob = new Blob([JSON.stringify({ ...account, localBrowserDraft: browserDraft }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "forme-personal-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare your data export.");
    } finally {
      setBusy(false);
    }
  };

  return <span style={{ display: "inline-grid", gap: 4 }}><button className={className} disabled={busy} onClick={() => void download()}><DownloadIcon size={16}/>{busy ? "Preparing download…" : "Download my data"}</button>{error && <span role="status" className="field-note">{error}</span>}</span>;
}
