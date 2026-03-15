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

      const totalHighRisk = counts.critical + counts.high;
      const totalModerateRisk = counts.medium + counts.low;

      // --- PREMIUM BENTO-BOX HTML LAYOUT ---
      const cardsHtml = findings.map((f: any, index: number) => {
        const sev = (f.severity || "low").toLowerCase();
        
        let sevClass = "";
        let sevBg = "";
        let sevText = "";
        let sevBorder = "";

        if (sev === "critical" || sev === "high") {
            sevClass = "severity-high border-l-4 border-l-destructive";
            sevBg = "bg-destructive/20";
            sevText = "text-destructive";
            sevBorder = "border-destructive/30";
        } else if (sev === "medium") {
            sevClass = "severity-medium border-l-4 border-l-warning";
            sevBg = "bg-warning/20";
            sevText = "text-warning";
            sevBorder = "border-warning/30";
        } else {
            sevClass = "border-l-4 border-l-primary";
            sevBg = "bg-primary/20";
            sevText = "text-primary";
            sevBorder = "border-primary/30";
        }

        const findingId = `SEC-${String(index + 1).padStart(3, '0')}`;

        return `
        <div class="vulnerability-card glass-panel rounded-[2rem] p-8 border border-white/10 ${sevClass}" data-sev="${sev}">
            <div class="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="px-3 py-1 rounded-full ${sevBg} ${sevText} text-[10px] font-extrabold uppercase tracking-widest border ${sevBorder}">${sev} Severity</span>
                        <span class="text-muted-foreground text-sm font-mono">ID: ${findingId}</span>
                    </div>
                    <h3 class="font-display text-2xl font-bold">${f.title || 'Unknown Finding'}</h3>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mb-2">
                <div class="space-y-4">
                    <h4 class="text-sm font-bold uppercase tracking-widest text-primary/80">Analysis</h4>
                    <p class="text-muted-foreground leading-relaxed">
                        ${f.description || 'No description provided.'}
                    </p>
                    
                    ${f.poc && f.poc !== 'N/A' ? `
                    <div class="pt-4">
                        <h4 class="text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">Proof of Concept</h4>
                        <pre class="bg-black/40 p-4 rounded-xl border border-white/10 font-mono text-xs text-pink-300 overflow-x-auto whitespace-pre-wrap">${f.poc}</pre>
                    </div>` : ''}
                </div>
                
                <div class="space-y-4 flex flex-col">
                    <h4 class="text-sm font-bold uppercase tracking-widest text-primary/80">Remediation Patch</h4>
                    <div class="relative group flex-1">
                        <div class="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                        <pre class="relative h-full bg-black/40 p-5 rounded-xl border border-white/10 font-mono text-sm overflow-x-auto text-emerald-300 whitespace-pre-wrap">${f.fix || 'Manual intervention required.'}</pre>
                    </div>
                </div>
            </div>
        </div>`;
      }).join("");

      const htmlString = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Analysis | ${data.repo_name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        background: "hsl(222.2 84% 4.9%)",
                        foreground: "hsl(210 40% 98%)",
                        primary: { DEFAULT: "hsl(217.2 91.2% 59.8%)", foreground: "hsl(222.2 47.4% 11.2%)" },
                        secondary: { DEFAULT: "hsl(217.2 32.6% 12%)", foreground: "hsl(210 40% 98%)" },
                        destructive: { DEFAULT: "hsl(0 84.2% 60.2%)", foreground: "hsl(210 40% 98%)" },
                        warning: { DEFAULT: "hsl(38 92% 50%)", foreground: "hsl(210 40% 98%)" },
                        muted: { DEFAULT: "hsl(217.2 32.6% 17.5%)", foreground: "hsl(215 20.2% 65.1%)" },
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        display: ['Outfit', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #020617;
            background-image: 
                radial-gradient(at 0% 0%, hsla(217, 91%, 60%, 0.07) 0px, transparent 50%),
                radial-gradient(at 100% 0%, hsla(210, 40%, 98%, 0.03) 0px, transparent 50%);
            background-attachment: fixed;
        }
        .glass-panel {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .vulnerability-card { transition: transform 0.2s ease-out, border-color 0.2s ease; }
        .vulnerability-card:hover { transform: translateY(-2px); border-color: rgba(255, 255, 255, 0.15); }
        .severity-high { box-shadow: 0 0 20px -5px rgba(239, 68, 68, 0.3); }
        .severity-medium { box-shadow: 0 0 20px -5px rgba(245, 158, 11, 0.2); }
        pre::-webkit-scrollbar { height: 4px; }
        pre::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .hidden { display: none !important; }
    </style>
</head>
<body class="text-foreground font-sans antialiased min-h-screen">

    <header class="sticky top-0 z-50 w-full border-b border-white/10 glass-panel">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex h-20 items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div>
                        <h1 class="font-display font-extrabold text-xl tracking-tight">Security Analysis Report</h1>
                        <p class="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">NEXUS AI DEVSECOPS AUDIT</p>
                    </div>
                </div>
                <div class="hidden md:block">
                    <div class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.28 1.15-.28 2.35 0 3.5-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                        ${data.repo_name}
                    </div>
                </div>
            </div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section class="mb-16">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2 glass-panel rounded-3xl p-8 border border-white/10 relative overflow-hidden group flex flex-col justify-center">
                    <div class="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all"></div>
                    <h2 class="font-display text-2xl font-bold mb-4">Executive Summary</h2>
                    <p class="text-muted-foreground leading-relaxed mb-6">
                        The Nexus AI Agent autonomously scanned the target repository and identified <span class="text-white font-bold">${findings.length} total vulnerabilities</span>. 
                        Based on the analysis, there are <span class="text-destructive font-bold">${totalHighRisk} high/critical risks</span> that require immediate mitigation. Please review the specific remediation patches below.
                    </p>
                    <div class="flex flex-wrap gap-4 text-xs font-mono">
                        <div class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Scan Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Type: AI SAST/SCA Audit</div>
                    </div>
                </div>
                <div class="flex flex-col gap-6">
                    <div class="flex-1 glass-panel rounded-3xl p-6 border-l-4 border-l-destructive severity-high flex flex-col justify-center">
                        <span class="text-muted-foreground text-sm font-medium">Critical / High Risks</span>
                        <div class="flex items-baseline gap-2 mt-1">
                            <span class="text-4xl font-display font-extrabold text-destructive">${totalHighRisk}</span>
                            <span class="text-muted-foreground font-medium">Flags Raised</span>
                        </div>
                    </div>
                    <div class="flex-1 glass-panel rounded-3xl p-6 border-l-4 border-l-warning severity-medium flex flex-col justify-center">
                        <span class="text-muted-foreground text-sm font-medium">Moderate / Low Risks</span>
                        <div class="flex items-baseline gap-2 mt-1">
                            <span class="text-4xl font-display font-extrabold text-warning">${totalModerateRisk}</span>
                            <span class="text-muted-foreground font-medium">Flags Raised</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="space-y-8">
            <div class="flex justify-between items-end mb-8">
                <h2 class="font-display text-3xl font-extrabold flex items-center gap-3">
                    <span class="w-8 h-1 bg-primary rounded-full"></span>
                    Vulnerability Details
                </h2>
                <div class="hidden md:flex bg-white/5 p-1 rounded-lg border border-white/10 font-mono text-xs">
                    <button onclick="filterSev('all')" class="px-4 py-2 rounded-md hover:bg-white/10 transition text-white">ALL</button>
                    <button onclick="filterSev('critical')" class="px-4 py-2 rounded-md hover:bg-destructive/20 transition text-destructive">CRITICAL</button>
                    <button onclick="filterSev('high')" class="px-4 py-2 rounded-md hover:bg-destructive/20 transition text-destructive">HIGH</button>
                    <button onclick="filterSev('medium')" class="px-4 py-2 rounded-md hover:bg-warning/20 transition text-warning">MEDIUM</button>
                </div>
            </div>

            ${cardsHtml}

        </section>

        <section class="mt-20">
            <div class="bg-primary/5 rounded-[2.5rem] border border-primary/20 p-8 md:p-12 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-8 opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h2 class="font-display text-3xl font-extrabold mb-8">General Recommendations</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex gap-4">
                        <div class="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24"/><polyline points="21 3 21 12 12 12"/></svg>
                        </div>
                        <div>
                            <h4 class="font-bold mb-1">Keep Dependencies Updated</h4>
                            <p class="text-sm text-muted-foreground">Regularly update all dependencies to their latest stable versions for security patches and bug fixes.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                        </div>
                        <div>
                            <h4 class="font-bold mb-1">Automated Scanning</h4>
                            <p class="text-sm text-muted-foreground">Integrate automated dependency scanning into CI/CD pipelines for continuous vulnerability identification.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </div>
                        <div>
                            <h4 class="font-bold mb-1">Dependency Locking</h4>
                            <p class="text-sm text-muted-foreground">Use dependency locking mechanisms (e.g., pip freeze or package-lock.json) for deterministic and secure builds.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                        </div>
                        <div>
                            <h4 class="font-bold mb-1">Thorough Testing</h4>
                            <p class="text-sm text-muted-foreground">Conduct comprehensive testing after applying AI-suggested remediation code to ensure application stability.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <div class="mt-12 mb-12 text-center p-8 rounded-3xl border border-dashed border-white/10 text-muted-foreground text-sm">
            This report was generated autonomously by the Nexus AI Engine.
        </div>
    </main>

    <script>
        function filterSev(level) {
            document.querySelectorAll('.vulnerability-card').forEach(c => {
                c.classList.toggle('hidden', level !== 'all' && c.dataset.sev !== level);
            });
        }
    </script>
</body>
</html>`;

      const blob = new Blob([htmlString], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nexus_Security_Report_${data.repo_name}.html`;
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
