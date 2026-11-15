"use client";

import { useState } from "react";

/** A reusable Trace-style status disclosure for AI work. It intentionally shows
 * progress metadata, never hidden model chain-of-thought. */
export function ReasoningTrace({ running, durationMs }: { running: boolean; durationMs: number }) {
  const [userOpen, setUserOpen] = useState<boolean>();
  const open = userOpen ?? running;
  const seconds = Math.max(1, Math.round(durationMs / 1000));

  return (
    <section className="reasoning-trace" aria-label="AI progress">
      <button
        className="reasoning-trace-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="reasoning-trace-content"
        onClick={() => setUserOpen((current) => !(current ?? running))}
      >
        <span className={`reasoning-trace-icon${running ? " is-running" : ""}`} aria-hidden="true">
          {running ? "◌" : "✓"}
        </span>
        <span>{running ? "Thinking" : `Thought · ${seconds}s`}</span>
        <span className="reasoning-trace-chevron" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <p id="reasoning-trace-content" className="reasoning-trace-content">
        {running
          ? "Reviewing the text you provided and preparing fact-preserving suggestions. Your resume will not change automatically."
          : "Suggestions are ready for your review. Only the text and consent you provided were used for this request."}
      </p>}
    </section>
  );
}
