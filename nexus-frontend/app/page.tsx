"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TopNav from "@/components/layout/TopNav";
import ChatPanel from "@/components/chat/ChatPanel";
import TerminalWidget from "@/components/terminal/TerminalWidget";
import NexusCorePanel from "@/components/ui/NexusCorePanel";

const SPLINE_URL = ""; // e.g. "https://my.spline.design/nexuscore-xxxxx/"

// ── Types mirrored from TerminalWidget so page.tsx can own the PDF state ──────
export type PdfStatus =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "ready"; url: string; filename: string; isError: boolean }
  | { status: "error"; message: string };

export default function WorkspacePage() {
  const reportRef  = useRef<HTMLDivElement>(null);   // anchor for auto-scroll
  const [pdfState, setPdfState] = useState<PdfStatus>({ status: "idle" });

  // ── Auto-scroll into the report zone whenever it becomes visible ────────────
  useEffect(() => {
    if (pdfState.status !== "idle") {
      // Small delay so the DOM has rendered before we scroll
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }, [pdfState.status]);

  // ── Lifted callback — TerminalWidget calls this to push PDF state up ────────
  const handlePdfState = useCallback((next: PdfStatus) => {
    setPdfState(next);
  }, []);

  const pdfVisible = pdfState.status !== "idle";

  return (
    /*
     * KEY LAYOUT CHANGE:
     * The outer container is now `overflow-y: auto` (was `overflow: hidden`).
     * This lets the page scroll vertically when the report panel appears below
     * the two-column workspace, instead of clipping it inside the right column.
     */
    <div
      className="flex flex-col cyber-grid-bg"
      style={{ minHeight: "100vh", background: "#020409", position: "relative" }}
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "-20%", left: "-10%", width: "600px", height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none fixed"
        style={{
          bottom: "-20%", right: "-10%", width: "700px", height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <TopNav />
      </div>

      {/* ── Two-column workspace — fixed 100vh so it never scrolls itself ─── */}
      <div
        className="flex flex-col md:flex-row gap-4 p-3"
        style={{
          position: "relative", zIndex: 5,
          height: "calc(100vh - 56px)",   // exactly the viewport minus TopNav
          flexShrink: 0,                   // do not shrink when report appears below
          overflow: "hidden",              // columns stay fixed; report lives outside
        }}
      >
        {/* ── LEFT PANEL: Conversational AI Chat ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="glass-panel rounded-xl flex flex-col w-full md:w-[42%] flex-shrink-0"
          style={{ overflow: "hidden", height: "100%" }}
        >
          <ChatPanel />
        </motion.div>

        {/* ── RIGHT PANEL: Core + Terminal ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-4 w-full md:flex-1 flex-shrink-0"
          style={{ overflow: "hidden", height: "100%" }}
        >
          {/* Top half: 3D Core */}
          <div
            className="glass-panel rounded-xl hidden md:block"
            style={{ flex: "0 0 40%", overflow: "hidden" }}
          >
            <NexusCorePanel splineUrl={SPLINE_URL || undefined} />
          </div>

          {/* Mobile divider */}
          <div className="cyber-divider flex-shrink-0 md:hidden my-2" />

          {/* Bottom half: Terminal — PDF viewer is now OUTSIDE this box */}
          <div
            className="glass-panel rounded-xl flex-1"
            style={{ overflow: "hidden" }}
          >
            <TerminalWidget onPdfStateChange={handlePdfState} />
          </div>
        </motion.div>
      </div>

      {/* ── REPORT PANEL ─────────────────────────────────────────────────────
           Lives at page level, BELOW the two columns, full viewport width.
           The auto-scroll ref sits just above it so scrollIntoView lands cleanly.
      ───────────────────────────────────────────────────────────────────────── */}
      <div ref={reportRef} style={{ position: "relative", zIndex: 5 }}>
        <AnimatePresence>
          {pdfVisible && (
            <ReportPanel
              pdfState={pdfState}
              onClose={() => setPdfState({ status: "idle" })}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="hidden md:flex flex-shrink-0 items-center justify-between px-5 py-1"
        style={{
          background: "rgba(2,4,9,0.95)",
          borderTop: "1px solid rgba(0,245,255,0.06)",
          zIndex: 10,
          position: "relative",
        }}
      >
        <div className="flex items-center gap-4">
          {[
            { label: "BACKEND",  status: "CONNECTING",       color: "#ffa502" },
            { label: "AI MODEL", status: "GEMINI 2.0 FLASH", color: "#2ed573" },
            { label: "DB",       status: "SQLITE · LOCAL",   color: "#00f5ff" },
          ].map(({ label, status, color }, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "0.48rem", letterSpacing: "0.08em", color: "rgba(148,163,184,0.4)" }}>
                {label}: <span style={{ color }}>{status}</span>
              </span>
            </div>
          ))}
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.48rem", color: "rgba(148,163,184,0.2)", letterSpacing: "0.06em" }}>
          NEXUS DEVSECOPS AGENT · BUILT BY <span style={{ color: "rgba(0,245,255,0.3)" }}>@YOUR_HANDLE</span> · FastAPI + Next.js + Gemini
        </span>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT PANEL  (was PdfViewer inside TerminalWidget — now lives at page level)
// Full viewport width, min 70vh tall, slides up from bottom.
// ─────────────────────────────────────────────────────────────────────────────
import {
  FileText, Download, ExternalLink,
  AlertTriangle, Loader2, X,
} from "lucide-react";

interface ReportPanelProps {
  pdfState: PdfStatus;
  onClose: () => void;
}

function ReportPanel({ pdfState, onClose }: ReportPanelProps) {
  const isReady       = pdfState.status === "ready";
  const isErrorReport = isReady && (pdfState as Extract<PdfStatus, { status: "ready" }>).isError;

  const headerLabel =
    pdfState.status === "loading"
      ? (pdfState as Extract<PdfStatus, { status: "loading" }>).message.toUpperCase()
      : isErrorReport ? "SCAN FAILURE REPORT"
      : isReady       ? "SECURITY AUDIT REPORT"
      : "REPORT ERROR";

  const headerColor = isErrorReport ? "#ff4757" : "#00f5ff";

  const pdfUrl =
    isReady ? (pdfState as Extract<PdfStatus, { status: "ready" }>).url : null;

  const handleDownload = () => {
    if (!isReady) return;
    const s = pdfState as Extract<PdfStatus, { status: "ready" }>;
    const a = document.createElement("a");
    a.href = s.url; a.download = s.filename; a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: "100%",
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(2,4,9,0.98)",
        borderTop: "2px solid rgba(0,245,255,0.2)",
      }}
    >
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          background: "rgba(6,13,26,0.98)",
          borderBottom: "1px solid rgba(0,245,255,0.08)",
          flexShrink: 0, gap: 8, position: "sticky", top: 0, zIndex: 10,
        }}
      >
        {/* Left: icon + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pdfState.status === "loading" ? (
            <Loader2 size={14} style={{ color: "#00f5ff", animation: "spin 1s linear infinite" }} />
          ) : isErrorReport ? (
            <AlertTriangle size={14} style={{ color: "#ff4757" }} />
          ) : (
            <FileText size={14} style={{ color: "#00f5ff" }} />
          )}
          <span style={{
            fontFamily: "'Orbitron', monospace", fontSize: "0.65rem",
            letterSpacing: "0.12em", color: headerColor,
          }}>
            {headerLabel}
          </span>

          {/* Visual "below both panels" breadcrumb */}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem",
            color: "rgba(148,163,184,0.3)", marginLeft: 8,
          }}>
            ↓ FULL-WINDOW REPORT ZONE
          </span>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isReady && pdfUrl && (
            <>
              <a
                href={pdfUrl} target="_blank" rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px",
                  background: "rgba(0,245,255,0.06)",
                  border: "1px solid rgba(0,245,255,0.2)",
                  borderRadius: 6, cursor: "pointer", color: "#00f5ff",
                  fontFamily: "'Orbitron', monospace", fontSize: "0.52rem",
                  letterSpacing: "0.08em", textDecoration: "none",
                }}
              >
                <ExternalLink size={10} /> OPEN TAB
              </a>
              <button
                onClick={handleDownload}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px",
                  background: "rgba(0,245,255,0.1)",
                  border: "1px solid rgba(0,245,255,0.3)",
                  borderRadius: 6, cursor: "pointer", color: "#00f5ff",
                  fontFamily: "'Orbitron', monospace", fontSize: "0.52rem",
                  letterSpacing: "0.08em",
                }}
              >
                <Download size={10} /> DOWNLOAD PDF
              </button>
            </>
          )}

          <button
            onClick={onClose}
            title="Close report"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30,
              background: "rgba(255,71,87,0.08)",
              border: "1px solid rgba(255,71,87,0.25)",
              borderRadius: 6, cursor: "pointer", color: "#ff4757",
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: "60vh", position: "relative", background: "#020617" }}>

        {/* Loading spinner */}
        {pdfState.status === "loading" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              border: "2px solid rgba(0,245,255,0.1)",
              borderTop: "2px solid #00f5ff",
              animation: "spin 0.9s linear infinite",
            }} />
            <span style={{
              fontFamily: "'Orbitron', monospace", fontSize: "0.65rem",
              letterSpacing: "0.1em", color: "rgba(0,245,255,0.6)",
            }}>
              {(pdfState as Extract<PdfStatus, { status: "loading" }>).message}
            </span>
          </div>
        )}

        {/* PDF iframe — fills the full report zone */}
        {isReady && pdfUrl && (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            style={{ width: "100%", height: "100%", minHeight: "60vh", border: "none" }}
            title="Nexus Security Report"
          />
        )}

        {/* Error state */}
        {pdfState.status === "error" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 16, padding: 32,
          }}>
            <AlertTriangle size={40} style={{ color: "#ff4757" }} />
            <p style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem",
              color: "#ff4757", textAlign: "center", maxWidth: 520,
              lineHeight: 1.7,
            }}>
              {(pdfState as Extract<PdfStatus, { status: "error" }>).message}
            </p>
            <p style={{
              fontFamily: "'Exo 2', sans-serif", fontSize: "0.7rem",
              color: "rgba(148,163,184,0.5)", textAlign: "center", maxWidth: 480,
            }}>
              Make sure <code style={{ color: "#00f5ff" }}>nexus-pdf-service</code> is running:{" "}
              <code style={{ color: "#a855f7" }}>cd nexus-pdf-service && node server.js</code>
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}
