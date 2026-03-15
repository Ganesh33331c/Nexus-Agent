"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  Trash2,
  Download,
  ChevronRight,
  FileText
} from "lucide-react";
import { streamScan, TerminalLine, getScanReport } from "@/lib/api";

// ─── Syntax Highlighter ─────────────────────────────────────
function colorize(line: TerminalLine): React.ReactNode {
  const { type, content, timestamp } = line;

  const colorMap: Record<TerminalLine["type"], string> = {
    critical: "#ff4757",
    warning: "#ffa502",
    success: "#2ed573",
    info: "#00f5ff",
    debug: "#747d8c",
    prompt: "#a855f7",
  };

  const color = colorMap[type] || "#cbd5e1";
  const ts = timestamp
    ? `[${timestamp}] `
    : `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] `;

  const highlighted = content
    .replace(/\b(CRITICAL|FATAL|ERROR|RCE)\b/g, '<span style="color:#ff4757;font-weight:600">$1</span>')
    .replace(/\b(WARNING|WARN|HIGH)\b/g, '<span style="color:#ffa502;font-weight:600">$1</span>')
    .replace(/\b(SUCCESS|PASS|CLEAN|SAFE)\b/g, '<span style="color:#2ed573;font-weight:600">$1</span>')
    .replace(/\b(INFO|SCAN|FETCH)\b/g, '<span style="color:#00f5ff">$1</span>')
    .replace(/("[^"]*")/g, '<span style="color:#eccc68">$1</span>')
    .replace(/\b(\d+\.\d+\.\d+\.\d+)\b/g, '<span style="color:#70a1ff">$1</span>')
    .replace(/(\/[^\s]+)/g, '<span style="color:#a4b0be">$1</span>')
    .replace(/\b(CVE-\d{4}-\d+)/g, '<span style="color:#ff6b81;font-weight:600">$1</span>');

  return (
    <span>
      <span style={{ color: "rgba(148,163,184,0.4)", fontWeight: 300 }}>{ts}</span>
      <span style={{ color }} dangerouslySetInnerHTML={{ __html: highlighted }} />
    </span>
  );
}

const DEMO_LINES: TerminalLine[] = [
  { type: "success", content: "NEXUS Terminal v2.4.1 initialized", timestamp: "00:00:01" },
  { type: "info", content: "Awaiting target repository...", timestamp: "00:00:01" },
  { type: "debug", content: "SAST engine: READY | SCA engine: READY | AI model: READY", timestamp: "00:00:02" },
  { type: "prompt", content: "Enter a GitHub URL in the chat to begin scanning.", timestamp: "00:00:02" },
];

interface TerminalWidgetProps {
  externalLines?: TerminalLine[];
  isScanning?: boolean;
}

export default function TerminalWidget({ externalLines, isScanning = false }: TerminalWidgetProps) {
  const [lines, setLines] = useState<TerminalLine[]>(DEMO_LINES);
  const [localRepoUrl, setLocalRepoUrl] = useState("");
  const [localScanning, setLocalScanning] = useState(false);
  const [auditId, setAuditId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalLines && externalLines.length > 0) setLines(externalLines);
  }, [externalLines]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const startScan = () => {
    if (!localRepoUrl.trim() || localScanning) return;
    setLocalScanning(true);
    setLines([]);
    setAuditId(null); 

    abortRef.current = streamScan(
      localRepoUrl,
      (line) => {
        setLines((prev) => [...prev, line]);
        if (line.content.includes("Audit archived to nexus_history.db")) {
          const match = line.content.match(/ID:\s*(\d+)/);
          if (match) setAuditId(parseInt(match[1], 10));
        }
      },
      () => {
        setLocalScanning(false);
        setLines((prev) => [...prev, { type: "success", content: "Scan complete. Report generated." }]);
      },
      (err) => {
        setLocalScanning(false);
        setLines((prev) => [...prev, { type: "critical", content: `Scan error: ${err.message}` }]);
      }
    );
  };

  const stopScan = () => {
    abortRef.current?.abort();
    setLocalScanning(false);
    setLines((prev) => [...prev, { type: "warning", content: "Scan aborted by user." }]);
  };

  const clearTerminal = () => {
      setLines(DEMO_LINES);
      setAuditId(null);
  }

  const downloadLog = () => {
    const text = lines.map((l) => `[${l.timestamp || ""}] [${l.type.toUpperCase()}] ${l.content}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus_scan_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── DYNAMIC HTML REPORT GENERATOR ───
  const downloadHtmlReport = async () => {
    if (!auditId) return;
    try {
      const res = await getScanReport(auditId);
      const data = res.data;
      const findings = data.findings || [];
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      
      findings.forEach((f: any) => {
        const sev = (f.severity || "low").toLowerCase();
        if (counts[sev as keyof typeof counts] !== undefined) {
          counts[sev as keyof typeof counts]++;
        }
      });

      // --- PREMIUM HTML LAYOUT GENERATOR ---
      const cardsHtml = findings.map((f: any) => {
        const sev = (f.severity || "low").toLowerCase();
        
        let sevColor = "";
        let glowColor = "";
        let badgeStyle = "";
        
        if (sev === "critical") {
            sevColor = "text-rose-500";
            glowColor = "shadow-[0_0_15px_rgba(244,63,94,0.15)]";
            badgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/20";
        } else if (sev === "high") {
            sevColor = "text-amber-500";
            glowColor = "shadow-[0_0_15px_rgba(245,158,11,0.15)]";
            badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        } else if (sev === "medium") {
            sevColor = "text-yellow-400";
            glowColor = "shadow-[0_0_15px_rgba(250,204,21,0.15)]";
            badgeStyle = "bg-yellow-400/10 text-yellow-300 border-yellow-400/20";
        } else {
            sevColor = "text-emerald-400";
            glowColor = "shadow-[0_0_15px_rgba(52,211,153,0.15)]";
            badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        }

        return `
        <div class="f-card w-full mb-8 relative rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-md overflow-hidden ${glowColor} transition-all duration-300 hover:border-slate-600" data-sev="${sev}">
            <div class="h-1 w-full ${sev === 'critical' ? 'bg-rose-500' : sev === 'high' ? 'bg-amber-500' : sev === 'medium' ? 'bg-yellow-400' : 'bg-emerald-500'}"></div>
            
            <div class="p-8">
                <div class="flex justify-between items-start mb-6">
                    <h3 class="text-2xl font-bold text-slate-100 font-display tracking-wide">${f.title || 'Unknown Finding'}</h3>
                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${badgeStyle}">${sev}</span>
                </div>
                
                <p class="text-base text-slate-300 mb-8 leading-relaxed font-body">${f.description || ''}</p>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="rounded-lg border border-slate-700/80 bg-[#0d1117] overflow-hidden">
                        <div class="flex items-center px-4 py-2 bg-slate-800/80 border-b border-slate-700">
                            <div class="flex space-x-2 mr-4">
                                <div class="w-3 h-3 rounded-full bg-rose-500/80"></div>
                                <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
                                <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                            </div>
                            <span class="text-xs text-slate-400 font-mono font-semibold uppercase tracking-widest">Proof of Concept</span>
                        </div>
                        <div class="p-4 overflow-x-auto">
                            <code class="text-sm text-rose-200/90 font-mono block whitespace-pre-wrap">${f.poc || 'N/A'}</code>
                        </div>
                    </div>
                    
                    <div class="rounded-lg border border-emerald-900/30 bg-[#0d1117] overflow-hidden">
                        <div class="flex items-center px-4 py-2 bg-emerald-950/20 border-b border-emerald-900/30">
                            <div class="flex space-x-2 mr-4">
                                <div class="w-3 h-3 rounded-full bg-slate-600/50"></div>
                                <div class="w-3 h-3 rounded-full bg-slate-600/50"></div>
                                <div class="w-3 h-3 rounded-full bg-slate-600/50"></div>
                            </div>
                            <span class="text-xs text-emerald-400 font-mono font-semibold uppercase tracking-widest">Remediation Guide</span>
                        </div>
                        <div class="p-4 overflow-x-auto">
                            <code class="text-sm text-emerald-200/90 font-mono block whitespace-pre-wrap">${f.fix || 'N/A'}</code>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
      }).join("");

      const htmlString = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nexus Security Audit | ${data.repo_name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
          <style>
              body { 
                  background-color: #020617; 
                  background-image: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #020617 70%);
                  background-attachment: fixed;
                  color: #e2e8f0; 
                  font-family: 'Inter', sans-serif; 
              }
              .font-display { font-family: 'Space Grotesk', sans-serif; }
              .font-mono { font-family: 'JetBrains Mono', monospace; }
              .font-body { font-family: 'Inter', sans-serif; }
              
              /* Custom Scrollbar for Code Blocks */
              ::-webkit-scrollbar { height: 8px; width: 8px; }
              ::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
              ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
              ::-webkit-scrollbar-thumb:hover { background: #475569; }

              .glass-header { 
                  background: rgba(15, 23, 42, 0.6); 
                  backdrop-filter: blur(16px); 
                  border-bottom: 1px solid rgba(255, 255, 255, 0.05); 
              }
              
              .filter-btn { transition: all 0.2s; }
              .filter-btn.active { background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8; }
              .hidden { display: none !important; }
          </style>
      </head>
      <body class="antialiased min-h-screen pb-20">
          
          <div class="glass-header sticky top-0 z-50 px-8 py-4 mb-10 shadow-lg">
              <div class="max-w-7xl mx-auto flex justify-between items-center">
                  <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <h1 class="text-xl font-bold text-white font-display tracking-wide">NEXUS <span class="text-cyan-400">CORE</span></h1>
                  </div>
                  <div class="text-right flex items-center gap-4">
                      <div class="hidden sm:block text-right mr-4 border-r border-slate-700 pr-4">
                          <p class="text-[10px] text-slate-400 font-mono tracking-widest uppercase mb-1">Generated</p>
                          <p class="text-xs text-slate-200 font-mono">${new Date().toUTCString()}</p>
                      </div>
                      <div class="bg-slate-800/80 border border-slate-600 rounded-md px-4 py-2 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                          <span class="text-sm font-bold text-white font-mono">${data.repo_name}</span>
                      </div>
                  </div>
              </div>
          </div>

          <div class="max-w-7xl mx-auto px-8">
              
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                  
                  <div class="lg:col-span-1 rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-md p-6 flex flex-col items-center justify-center">
                      <h2 class="text-sm text-slate-400 font-mono uppercase tracking-widest mb-4 w-full text-left">Threat Distribution</h2>
                      <div class="relative w-48 h-48">
                          <canvas id="severityChart"></canvas>
                          <div class="absolute inset-0 flex items-center justify-center flex-col">
                              <span class="text-3xl font-bold font-display text-white">${findings.length}</span>
                              <span class="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Total</span>
                          </div>
                      </div>
                  </div>

                  <div class="lg:col-span-2 grid grid-cols-2 gap-4">
                      <div class="rounded-xl border border-rose-900/30 bg-rose-950/10 p-6 flex flex-col justify-center relative overflow-hidden group">
                          <div class="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all"></div>
                          <div class="text-rose-500 font-mono text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                              <div class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> Critical Risk
                          </div>
                          <div class="text-6xl font-display font-bold text-white">${counts.critical}</div>
                      </div>
                      
                      <div class="rounded-xl border border-amber-900/30 bg-amber-950/10 p-6 flex flex-col justify-center relative overflow-hidden group">
                          <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
                          <div class="text-amber-500 font-mono text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                              <div class="w-2 h-2 rounded-full bg-amber-500"></div> High Risk
                          </div>
                          <div class="text-6xl font-display font-bold text-white">${counts.high}</div>
                      </div>
                      
                      <div class="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6 flex flex-col justify-center relative overflow-hidden group">
                          <div class="absolute -right-4 -top-4 w-24 h-24 bg-yellow-400/5 rounded-full blur-xl group-hover:bg-yellow-400/10 transition-all"></div>
                          <div class="text-yellow-400 font-mono text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                              <div class="w-2 h-2 rounded-full bg-yellow-400"></div> Medium Risk
                          </div>
                          <div class="text-6xl font-display font-bold text-white">${counts.medium}</div>
                      </div>
                      
                      <div class="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-6 flex flex-col justify-center relative overflow-hidden group">
                          <div class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
                          <div class="text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                              <div class="w-2 h-2 rounded-full bg-emerald-500"></div> Low Risk
                          </div>
                          <div class="text-6xl font-display font-bold text-white">${counts.low}</div>
                      </div>
                  </div>
              </div>

              <div class="flex flex-col md:flex-row gap-8 items-end mb-8 border-b border-slate-800 pb-4">
                  <h2 class="text-2xl font-display font-bold text-white flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                      Vulnerability Assessment
                  </h2>
                  
                  <div class="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 font-mono text-xs ml-auto overflow-x-auto">
                      <button onclick="filterSev('all', this)" class="filter-btn active px-4 py-2 rounded-md text-slate-300 hover:text-white font-semibold">ALL</button>
                      <button onclick="filterSev('critical', this)" class="filter-btn px-4 py-2 rounded-md text-slate-400 hover:text-rose-400 font-semibold">CRITICAL</button>
                      <button onclick="filterSev('high', this)" class="filter-btn px-4 py-2 rounded-md text-slate-400 hover:text-amber-400 font-semibold">HIGH</button>
                      <button onclick="filterSev('medium', this)" class="filter-btn px-4 py-2 rounded-md text-slate-400 hover:text-yellow-400 font-semibold">MEDIUM</button>
                      <button onclick="filterSev('low', this)" class="filter-btn px-4 py-2 rounded-md text-slate-400 hover:text-emerald-400 font-semibold">LOW</button>
                  </div>
              </div>

              <div class="space-y-6">
                  ${cardsHtml}
              </div>
              
          </div>

          <script>
              // Filter Logic
              function filterSev(level, btnElement) {
                  // Update cards
                  document.querySelectorAll('.f-card').forEach(c => {
                      if (level === 'all') {
                          c.classList.remove('hidden');
                      } else {
                          c.classList.toggle('hidden', c.dataset.sev !== level);
                      }
                  });
                  
                  // Update active button state
                  document.querySelectorAll('.filter-btn').forEach(btn => {
                      btn.classList.remove('active');
                  });
                  btnElement.classList.add('active');
              }

              // Chart Initialization
              document.addEventListener('DOMContentLoaded', function() {
                  const ctx = document.getElementById('severityChart').getContext('2d');
                  
                  // Handle empty state
                  const data = [${counts.critical}, ${counts.high}, ${counts.medium}, ${counts.low}];
                  const sum = data.reduce((a, b) => a + b, 0);
                  
                  new Chart(ctx, {
                      type: 'doughnut',
                      data: {
                          labels: ['Critical', 'High', 'Medium', 'Low'],
                          datasets: [{
                              data: sum === 0 ? [0,0,0,1] : data,
                              backgroundColor: sum === 0 
                                  ? ['#1e293b', '#1e293b', '#1e293b', '#1e293b'] 
                                  : ['#f43f5e', '#f59e0b', '#facc15', '#10b981'],
                              borderWidth: 0,
                              hoverOffset: 4
                          }]
                      },
                      options: {
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: '75%',
                          plugins: {
                              legend: { display: false },
                              tooltip: {
                                  enabled: sum > 0,
                                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                  titleFont: { family: 'JetBrains Mono', size: 11 },
                                  bodyFont: { family: 'Inter', size: 13 },
                                  padding: 12,
                                  borderColor: 'rgba(255,255,255,0.1)',
                                  borderWidth: 1
                              }
                          },
                          animation: { animateScale: true, animateRotate: true }
                      }
                  });
              });
          </script>
      </body>
      </html>`;

      const blob = new Blob([htmlString], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nexus_Audit_${data.repo_name}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to fetch report", err);
    }
  };

  return (
    <div className="terminal-window flex flex-col h-full">
      <div className="terminal-header justify-between">
        <div className="flex items-center gap-2">
          <div className="terminal-dot" style={{ background: "#ff5f57" }} />
          <div className="terminal-dot" style={{ background: "#febc2e" }} />
          <div className="terminal-dot" style={{ background: "#28c840" }} />
          <div className="w-px h-3 bg-white/10 mx-1" />
          <TerminalIcon size={11} style={{ color: "#00f5ff" }} />
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#00f5ff" }}>
            NEXUS EXECUTION ENGINE
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <AnimatePresence>
            {(localScanning || isScanning) && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)" }}>
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full" style={{ background: "#ff4757" }} />
                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "0.5rem", color: "#ff4757", letterSpacing: "0.1em" }}>SCANNING</span>
              </motion.div>
            )}
          </AnimatePresence>

          {auditId && (
            <button
              onClick={downloadHtmlReport}
              title="Download HTML Report"
              style={{ background: "rgba(0, 245, 255, 0.1)", border: "1px solid rgba(0, 245, 255, 0.3)", cursor: "pointer", color: "#00f5ff", padding: "3px 8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.55rem", fontFamily: "'Orbitron', monospace", marginRight: "4px" }}
            >
              <FileText size={10} /> HTML REPORT
            </button>
          )}

          <button onClick={clearTerminal} title="Clear terminal" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}><Trash2 size={11} /></button>
          <button onClick={downloadLog} title="Download log" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}><Download size={11} /></button>
        </div>
      </div>

      <div className="terminal-output flex-1 overflow-y-auto min-h-0">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} style={{ display: "flex", gap: "4px", paddingBottom: "1px", alignItems: "flex-start" }}>
              <ChevronRight size={10} style={{ color: "rgba(0,245,255,0.3)", marginTop: "3px", flexShrink: 0 }} />
              <span style={{ wordBreak: "break-all" }}>{colorize(line)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {(localScanning || isScanning) && (
          <motion.div className="flex items-center gap-1 mt-1" style={{ color: "#00f5ff", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}>
            <ChevronRight size={10} style={{ color: "rgba(0,245,255,0.3)" }} />
            <span style={{ color: "rgba(148,163,184,0.5)" }}>nexus@scanner:~$</span>
            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.6, repeat: Infinity }} style={{ display: "inline-block", width: "6px", height: "12px", background: "#00f5ff", borderRadius: "1px" }} />
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2.5 border-t" style={{ borderColor: "rgba(0,245,255,0.08)" }}>
        <div className="flex gap-2 items-center">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "rgba(0,245,255,0.5)", flexShrink: 0 }}>$</span>
          <input value={localRepoUrl} onChange={(e) => setLocalRepoUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startScan()} placeholder="github.com/user/repo" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "#a4b0be", minWidth: 0 }} />
          {localScanning ? (
            <button onClick={stopScan} title="Stop scan"><Square size={11} style={{ color: "#ff4757", cursor: "pointer" }} /></button>
          ) : (
            <button onClick={startScan} title="Start scan"><Play size={11} style={{ color: "#2ed573", cursor: "pointer" }} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
