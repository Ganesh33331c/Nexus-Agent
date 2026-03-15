"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import TopNav from "@/components/layout/TopNav";
import ChatPanel from "@/components/chat/ChatPanel";
import TerminalWidget from "@/components/terminal/TerminalWidget";
import NexusCorePanel from "@/components/ui/NexusCorePanel";

const SPLINE_URL = ""; // e.g. "https://my.spline.design/nexuscore-xxxxx/"

export default function WorkspacePage() {
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="flex flex-col cyber-grid-bg"
      style={{
        height: "100vh",
        background: "#020409",
        position: "relative",
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "-20%", left: "-10%", width: "600px", height: "600px",
          borderRadius: "50%", background: "radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)", zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none fixed"
        style={{
          bottom: "-20%", right: "-10%", width: "700px", height: "700px",
          borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)", zIndex: 0,
        }}
      />

      {/* Top Navigation Bar */}
      <div style={{ position: "relative", zIndex: 10 }}>
        <TopNav />
      </div>

      {/* ─── Responsive Split-Screen Workspace ─── */}
      <div
        ref={panelRef}
        className="flex flex-col md:flex-row flex-1 gap-4 p-3 overflow-y-auto md:overflow-hidden"
        style={{ position: "relative", zIndex: 5 }}
      >
        {/* ─── LEFT PANEL: Conversational AI Chat ─── */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="glass-panel rounded-xl flex flex-col w-full md:w-[42%] min-h-[70vh] md:min-h-0 flex-shrink-0"
          style={{ overflow: "hidden" }}
        >
          <ChatPanel />
        </motion.div>

        {/* ─── RIGHT PANEL: Core + Terminal ─── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-4 w-full md:flex-1 min-h-[85vh] md:min-h-0 flex-shrink-0"
          style={{ overflow: "hidden" }}
        >
          {/* Top Half: 3D Core Visualization */}
          <div
            className="glass-panel rounded-xl hidden md:block"
            style={{ flex: "0 0 45%", overflow: "hidden" }}
          >
            <NexusCorePanel splineUrl={SPLINE_URL || undefined} />
          </div>

          {/* Mobile divider for visual separation */}
          <div className="cyber-divider flex-shrink-0 md:hidden my-2" />

          {/* Bottom Half: Terminal Widget */}
          <div
            className="glass-panel rounded-xl flex-1"
            style={{ overflow: "hidden" }}
          >
            <TerminalWidget />
          </div>
        </motion.div>
      </div>

      {/* Footer status bar (Hidden on mobile to save screen space) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="hidden md:flex flex-shrink-0 items-center justify-between px-5 py-1"
        style={{
          background: "rgba(2,4,9,0.95)", borderTop: "1px solid rgba(0,245,255,0.06)", zIndex: 10,
        }}
      >
        <div className="flex items-center gap-4">
          {[
            { label: "BACKEND", status: "CONNECTING", color: "#ffa502" },
            { label: "AI MODEL", status: "GEMINI 2.0 FLASH", color: "#2ed573" },
            { label: "DB", status: "SQLITE · LOCAL", color: "#00f5ff" },
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
