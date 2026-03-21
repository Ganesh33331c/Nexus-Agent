/**
 * NEXUS PDF Generation Microservice
 * -----------------------------------
 * POST /generate-pdf  → full security report PDF
 * POST /error-pdf     → scan failure report PDF
 * GET  /health        → health check
 *
 * Uses html-pdf-node (lighter than Puppeteer, works on Render free tier)
 *
 * Deploy on Render:
 *   Root Directory:  nexus-pdf-service
 *   Build Command:   npm install
 *   Start Command:   node server.js
 */

const express  = require("express");
const cors     = require("cors");
const htmlPdf  = require("html-pdf-node");

const app  = express();
const PORT = process.env.PDF_SERVICE_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));


// ─── Core PDF Generator ───────────────────────────────────────────────────────

async function generatePdf(html) {
  const file    = { content: html };
  const options = {
    format:          "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
  };
  const pdfBuffer = await htmlPdf.generatePdf(file, options);
  return pdfBuffer;
}


// ─── HTML Escape Helper ───────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}


// ─── Full Security Report HTML Builder ───────────────────────────────────────

function buildReportHtml(reportData, repoName) {
  const findings = reportData.findings || [];
  const counts   = { critical: 0, high: 0, medium: 0, low: 0 };

  findings.forEach((f) => {
    const sev = (f.severity || "low").toLowerCase();
    if (counts[sev] !== undefined) counts[sev]++;
  });

  const totalHighRisk     = counts.critical + counts.high;
  const totalModerateRisk = counts.medium   + counts.low;

  const scanDate = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const statusColor =
    reportData.scan_status === "Failed" ||
    String(reportData.scan_status).includes("Error")
      ? "#ef4444"
      : "#22c55e";

  // ── Vulnerability cards ──
  const cardsHtml = findings.map((f, index) => {
    const sev = (f.severity || "low").toLowerCase();

    const palette = {
      critical: { border: "#ef4444", bg: "rgba(239,68,68,0.12)",  text: "#ef4444", shadow: "rgba(239,68,68,0.25)" },
      high:     { border: "#f97316", bg: "rgba(249,115,22,0.12)", text: "#f97316", shadow: "rgba(249,115,22,0.20)" },
      medium:   { border: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "#f59e0b", shadow: "rgba(245,158,11,0.15)" },
      low:      { border: "#3b82f6", bg: "rgba(59,130,246,0.12)", text: "#3b82f6", shadow: "rgba(59,130,246,0.10)" },
    };
    const p = palette[sev] || palette.low;

    const findingId   = f.id           || `SEC-${String(index + 1).padStart(3, "0")}`;
    const title       = f.title        || "Unknown Finding";
    const analysis    = f.analysis     || f.description || "No description provided.";
    const poc         = f.poc          || "N/A";
    const remediation = f.remediation  || f.fix         || "Manual intervention required.";

    return `
      <div style="
        background:rgba(15,23,42,0.7);
        border:1px solid rgba(255,255,255,0.08);
        border-left:4px solid ${p.border};
        border-radius:16px;
        padding:28px 32px;
        margin-bottom:28px;
        box-shadow:0 0 24px -6px ${p.shadow};
        page-break-inside:avoid;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;gap:16px;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
              <span style="
                background:${p.bg};color:${p.text};
                border:1px solid ${p.border}40;
                padding:3px 12px;border-radius:20px;
                font-size:10px;font-weight:800;letter-spacing:0.1em;
                text-transform:uppercase;font-family:'JetBrains Mono',monospace;
              ">${sev} Severity</span>
              <span style="color:#64748b;font-family:'JetBrains Mono',monospace;font-size:11px;">
                ID: ${findingId}
              </span>
            </div>
            <h3 style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:#f1f5f9;margin:0;line-height:1.3;">
              ${escapeHtml(title)}
            </h3>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <p style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;
               letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;margin:0 0 8px 0;">
              Analysis
            </p>
            <p style="color:#94a3b8;line-height:1.7;font-size:13px;
               font-family:'Inter',sans-serif;margin:0 0 16px 0;">
              ${escapeHtml(analysis)}
            </p>
            ${poc && poc !== "N/A" ? `
            <p style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;
               letter-spacing:0.12em;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;">
              Proof of Concept
            </p>
            <pre style="
              background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);
              border-radius:10px;padding:12px 14px;
              font-family:'JetBrains Mono',monospace;font-size:11px;
              color:#93c5fd;white-space:pre-wrap;word-break:break-all;margin:0;overflow:hidden;
            ">${escapeHtml(poc)}</pre>` : ""}
          </div>

          <div>
            <p style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;
               letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;margin:0 0 8px 0;">
              Remediation Patch
            </p>
            <pre style="
              background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);
              border-radius:10px;padding:14px 16px;
              font-family:'JetBrains Mono',monospace;font-size:11px;
              color:#93c5fd;white-space:pre-wrap;word-break:break-all;
              margin:0;min-height:80px;overflow:hidden;
            ">${escapeHtml(remediation)}</pre>
          </div>
        </div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nexus Security Audit | ${escapeHtml(repoName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body {
      background:#020617; color:#f1f5f9;
      font-family:'Inter',sans-serif;
      -webkit-font-smoothing:antialiased;
    }

    /* ── Cover page ── */
    .cover {
      min-height:100vh; display:flex; flex-direction:column;
      justify-content:center; padding:60px; position:relative; overflow:hidden;
      background:
        radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 50%),
        #020617;
      page-break-after:always;
    }
    .cover-grid {
      position:absolute; inset:0;
      background-image:
        linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px);
      background-size:40px 40px;
    }
    .cover-label {
      font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600;
      letter-spacing:0.25em; color:#3b82f6; text-transform:uppercase; margin-bottom:20px;
    }
    .cover-accent {
      width:60px; height:3px;
      background:linear-gradient(90deg,#3b82f6,#8b5cf6);
      border-radius:2px; margin-bottom:24px;
    }
    .cover-title {
      font-family:'Outfit',sans-serif; font-size:52px; font-weight:800;
      line-height:1.1; letter-spacing:-0.02em; color:#f8fafc; margin-bottom:12px;
    }
    .cover-title span {
      background:linear-gradient(135deg,#3b82f6,#8b5cf6);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }
    .cover-sub { font-size:15px; color:#64748b; margin-bottom:48px; }

    .meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; max-width:600px; margin-bottom:48px; }
    .meta-card { background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; }
    .meta-label { font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#475569; margin-bottom:6px; }
    .meta-value { font-size:13px; font-weight:600; color:#e2e8f0; word-break:break-all; }

    .risk-grid { display:grid; grid-template-columns:repeat(4,auto); gap:12px; max-width:480px; }
    .risk-badge { padding:8px 16px; border-radius:8px; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-align:center; }

    .cover-footer {
      position:absolute; bottom:40px; left:60px; right:60px;
      display:flex; justify-content:space-between; align-items:center;
      border-top:1px solid rgba(255,255,255,0.06); padding-top:20px;
    }
    .cover-brand { font-family:'Outfit',sans-serif; font-size:13px; font-weight:700; letter-spacing:0.08em; color:#334155; }
    .cover-brand span { color:#3b82f6; }

    /* ── Content ── */
    .content { padding:48px 60px; background:#020617; }

    .section-header { display:flex; align-items:center; gap:14px; margin-bottom:28px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.06); }
    .section-bar { width:4px; height:28px; background:linear-gradient(180deg,#3b82f6,#8b5cf6); border-radius:2px; }
    .section-title { font-family:'Outfit',sans-serif; font-size:22px; font-weight:700; color:#f1f5f9; }

    .exec-grid { display:grid; grid-template-columns:2fr 1fr 1fr; gap:16px; margin-bottom:40px; }
    .exec-card { background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:22px; }
    .exec-label { font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600; letter-spacing:0.15em; text-transform:uppercase; color:#475569; margin-bottom:8px; }
    .exec-value { font-family:'Outfit',sans-serif; font-size:32px; font-weight:800; line-height:1; }
    .exec-desc  { font-size:13px; color:#64748b; line-height:1.6; margin-top:8px; }

    .page-break { page-break-before:always; }

    .rec-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:8px; }
    .rec-item { background:rgba(15,23,42,0.5); border:1px solid rgba(59,130,246,0.15); border-radius:12px; padding:20px; display:flex; gap:14px; align-items:flex-start; }
    .rec-icon { width:36px; height:36px; background:rgba(59,130,246,0.15); border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:16px; }
    .rec-title { font-family:'Outfit',sans-serif; font-size:14px; font-weight:700; color:#e2e8f0; margin-bottom:4px; }
    .rec-desc  { font-size:12px; color:#64748b; line-height:1.6; }

    .report-footer { text-align:center; padding:32px 0; margin-top:40px; border-top:1px dashed rgba(255,255,255,0.08); color:#334155; font-size:11px; letter-spacing:0.05em; }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover">
    <div class="cover-grid"></div>
    <div style="position:relative;z-index:1;">
      <div class="cover-label">DevSecOps Autonomous Audit</div>
      <div class="cover-accent"></div>
      <h1 class="cover-title">Security<br><span>Analysis Report</span></h1>
      <p class="cover-sub">Automated vulnerability assessment powered by Nexus AI Engine</p>

      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">Target Repository</div>
          <div class="meta-value" style="color:#93c5fd;">${escapeHtml(repoName)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Scan Date</div>
          <div class="meta-value">${scanDate}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Scan Status</div>
          <div class="meta-value" style="color:${statusColor};">${escapeHtml(reportData.scan_status || "Completed")}</div>
        </div>
      </div>

      <div class="risk-grid">
        <div class="risk-badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">${counts.critical} Critical</div>
        <div class="risk-badge" style="background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.3);">${counts.high} High</div>
        <div class="risk-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);">${counts.medium} Medium</div>
        <div class="risk-badge" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.25);">${counts.low} Low</div>
      </div>
    </div>

    <div class="cover-footer">
      <div class="cover-brand">NEXUS <span>DevSecOps Agent</span></div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#1e293b;">CONFIDENTIAL · AUTOMATED REPORT</div>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="content">

    <!-- Executive Summary -->
    <div class="section-header">
      <div class="section-bar"></div>
      <h2 class="section-title">Executive Summary</h2>
    </div>
    <div class="exec-grid">
      <div class="exec-card">
        <div class="exec-label">Assessment Overview</div>
        <p class="exec-desc" style="margin-top:0;color:#94a3b8;font-size:14px;line-height:1.7;">
          The Nexus SAST + SCA scan identified <strong style="color:#f1f5f9;">${findings.length} total vulnerabilities</strong>.
          <strong style="color:#ef4444;">${totalHighRisk} critical/high severity</strong> issues require immediate remediation.
          <strong style="color:#f59e0b;">${totalModerateRisk} moderate/low</strong> issues represent technical debt.
        </p>
      </div>
      <div class="exec-card" style="border-left:4px solid #ef4444;box-shadow:0 0 20px -5px rgba(239,68,68,0.25);">
        <div class="exec-label">Critical / High</div>
        <div class="exec-value" style="color:#ef4444;">${totalHighRisk}</div>
        <div class="exec-desc">Immediate action required</div>
      </div>
      <div class="exec-card" style="border-left:4px solid #f59e0b;box-shadow:0 0 20px -5px rgba(245,158,11,0.15);">
        <div class="exec-label">Moderate / Low</div>
        <div class="exec-value" style="color:#f59e0b;">${totalModerateRisk}</div>
        <div class="exec-desc">Address in next sprint</div>
      </div>
    </div>

    <!-- Findings -->
    <div class="section-header" style="margin-top:40px;">
      <div class="section-bar"></div>
      <h2 class="section-title">Vulnerability Findings</h2>
      <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;color:#475569;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);padding:4px 12px;border-radius:6px;">
        ${findings.length} FINDINGS TOTAL
      </span>
    </div>

    ${cardsHtml}

    <!-- Recommendations -->
    <div class="section-header page-break" style="margin-top:40px;">
      <div class="section-bar" style="background:linear-gradient(180deg,#22c55e,#16a34a);"></div>
      <h2 class="section-title">General Recommendations</h2>
    </div>
    <div class="rec-grid">
      <div class="rec-item">
        <div class="rec-icon">🔄</div>
        <div>
          <div class="rec-title">Keep Dependencies Updated</div>
          <div class="rec-desc">Regularly update all dependencies. Use pip-audit or Dependabot to automate security patch tracking.</div>
        </div>
      </div>
      <div class="rec-item">
        <div class="rec-icon">🔁</div>
        <div>
          <div class="rec-title">Integrate CI/CD Scanning</div>
          <div class="rec-desc">Add Nexus as a GitHub Actions step so every PR is scanned before merge. Fail the pipeline on critical findings.</div>
        </div>
      </div>
      <div class="rec-item">
        <div class="rec-icon">🔐</div>
        <div>
          <div class="rec-title">Secrets Management</div>
          <div class="rec-desc">Never commit secrets to source control. Use environment variables, HashiCorp Vault, or GitHub Secrets.</div>
        </div>
      </div>
      <div class="rec-item">
        <div class="rec-icon">📋</div>
        <div>
          <div class="rec-title">Security Code Reviews</div>
          <div class="rec-desc">Require security-focused reviews for auth, crypto, and data-handling changes using OWASP checklists.</div>
        </div>
      </div>
    </div>

    <div class="report-footer">
      Generated autonomously by the Nexus AI DevSecOps Agent · ${scanDate} · CONFIDENTIAL
    </div>
  </div>

</body>
</html>`;
}


// ─── Error Report HTML Builder ────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "clone", name: "Repository Clone",  desc: "Git clone to ephemeral sandbox" },
  { key: "sast",  name: "SAST Scan",         desc: "Static regex analysis across 20 pattern classes" },
  { key: "sca",   name: "SCA Scan",          desc: "Dependency manifest parsing and CVE hint matching" },
  { key: "ai",    name: "AI Analysis",       desc: "Gemini structured-output report generation" },
  { key: "db",    name: "DB Archival",       desc: "Audit record persistence to SQLite" },
];

function buildErrorReportHtml(errorDetails, repoName, stage) {
  const scanDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const scanTime = new Date().toLocaleTimeString("en-US", { hour12: false });

  const failIndex = PIPELINE_STAGES.findIndex((s) => s.key === (stage || "").toLowerCase());

  const timelineHtml = PIPELINE_STAGES.map((s, i) => {
    let dotColor, nameColor, descText;
    if (i < failIndex) {
      dotColor = "#22c55e"; nameColor = "#22c55e"; descText = "Completed successfully";
    } else if (i === failIndex) {
      dotColor = "#ef4444"; nameColor = "#ef4444"; descText = `FAILED — ${s.desc}`;
    } else {
      dotColor = "#334155"; nameColor = "#475569"; descText = "Not executed";
    }
    return `
      <div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor}50;margin-top:4px;flex-shrink:0;"></div>
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:${nameColor};margin-bottom:2px;">${s.name}</div>
          <div style="font-size:12px;color:#475569;">${descText}</div>
        </div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nexus Scan Error Report | ${escapeHtml(repoName || "Unknown")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { background:#020617; color:#f1f5f9; font-family:'Inter',sans-serif; padding:60px; -webkit-font-smoothing:antialiased; }
  </style>
</head>
<body>

  <!-- Grid background -->
  <div style="position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(239,68,68,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.025) 1px,transparent 1px);background-size:40px 40px;"></div>

  <!-- Error banner -->
  <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-left:5px solid #ef4444;border-radius:16px;padding:32px 36px;margin-bottom:36px;position:relative;">
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;padding:5px 14px;border-radius:20px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">
      ⬤ Scan Failed · System Error
    </div>
    <h1 style="font-family:'Outfit',sans-serif;font-size:36px;font-weight:800;color:#f8fafc;margin-bottom:8px;">
      Scan <span style="color:#ef4444;">Failure</span> Report
    </h1>
    <p style="color:#64748b;font-size:14px;">
      The Nexus engine encountered an error during repository analysis. This report details the failure for debugging.
    </p>
  </div>

  <!-- Meta -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px;">
    <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:6px;">Target Repository</div>
      <div style="font-size:13px;font-weight:600;color:#93c5fd;word-break:break-all;">${escapeHtml(repoName || "Unknown")}</div>
    </div>
    <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:6px;">Failure Stage</div>
      <div style="font-size:13px;font-weight:600;color:#ef4444;">${escapeHtml(stage || "Unknown")}</div>
    </div>
    <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:6px;">Timestamp</div>
      <div style="font-size:13px;font-weight:600;color:#e2e8f0;">${scanDate} ${scanTime}</div>
    </div>
  </div>

  <!-- Error trace -->
  <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:14px;display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="width:4px;height:22px;background:linear-gradient(180deg,#ef4444,#b91c1c);border-radius:2px;"></div>
    Error Trace
  </div>
  <pre style="background:rgba(0,0,0,0.6);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:20px 24px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#fca5a5;white-space:pre-wrap;word-break:break-all;line-height:1.8;margin-bottom:28px;">${escapeHtml(String(errorDetails?.message || errorDetails || "No error details captured."))}</pre>

  <!-- Pipeline timeline -->
  <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:14px;display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="width:4px;height:22px;background:linear-gradient(180deg,#ef4444,#b91c1c);border-radius:2px;"></div>
    Pipeline Execution Timeline
  </div>
  <div style="margin-bottom:32px;">${timelineHtml}</div>

  <!-- Recommendations -->
  <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:14px;display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="width:4px;height:22px;background:linear-gradient(180deg,#22c55e,#16a34a);border-radius:2px;"></div>
    Recommended Resolution Steps
  </div>

  ${[
    ["1. Verify Repository URL", "Ensure the GitHub URL is correct and the repository is public. Example: https://github.com/user/repo"],
    ["2. Check API Key & Quota", "Verify your GEMINI_API_KEY env variable is set and not rate-limited. If on free tier, wait 60 seconds between scans."],
    ["3. Review Server Logs",    "Check the FastAPI backend console for the full Python traceback. The error detail above may be truncated."],
    ["4. Retry the Scan",        "Transient network errors often resolve on retry. If the error persists, file a bug report with this PDF attached."],
  ].map(([title, body]) => `
    <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:20px 24px;margin-bottom:12px;">
      <div style="font-weight:700;color:#93c5fd;margin-bottom:4px;font-size:13px;">${title}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.6;">${body}</div>
    </div>`).join("")}

  <div style="text-align:center;margin-top:40px;color:#1e293b;font-size:11px;letter-spacing:0.05em;border-top:1px dashed rgba(255,255,255,0.05);padding-top:24px;">
    Nexus DevSecOps Agent · Error Report · ${scanDate} · CONFIDENTIAL
  </div>

</body>
</html>`;
}


// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nexus-pdf-service", version: "2.0.0" });
});

app.post("/generate-pdf", async (req, res) => {
  const { reportData, repoName } = req.body;
  if (!reportData || !repoName) {
    return res.status(400).json({ error: "reportData and repoName are required" });
  }
  try {
    console.log(`[PDF] Generating report for: ${repoName}`);
    const html       = buildReportHtml(reportData, repoName);
    const pdfBuffer  = await generatePdf(html);
    const safeName   = repoName.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Nexus_Audit_${safeName}.pdf"`,
      "Content-Length":      pdfBuffer.length,
    });
    res.send(pdfBuffer);
    console.log(`[PDF] Done — ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.error("[PDF] Generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/error-pdf", async (req, res) => {
  const { errorDetails, repoName, stage } = req.body;
  try {
    console.log(`[PDF] Generating error report for: ${repoName}, stage: ${stage}`);
    const html      = buildErrorReportHtml(errorDetails, repoName, stage);
    const pdfBuffer = await generatePdf(html);
    const safeName  = (repoName || "unknown").replace(/[^a-z0-9]/gi, "_").toLowerCase();

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="Nexus_Error_${safeName}.pdf"`,
      "Content-Length":      pdfBuffer.length,
    });
    res.send(pdfBuffer);
    console.log(`[PDF] Error report done — ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.error("[PDF] Error report generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});


// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🔒 Nexus PDF Service running on http://localhost:${PORT}`);
  console.log(`   POST /generate-pdf  → full security report`);
  console.log(`   POST /error-pdf     → scan failure report`);
  console.log(`   GET  /health        → health check\n`);

  // Keep Render free tier alive — self-ping every 14 minutes
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  if (SELF_URL) {
    setInterval(async () => {
      try {
        await fetch(`${SELF_URL}/health`);
        console.log("[KEEPALIVE] pinged self");
      } catch (e) {
        console.log("[KEEPALIVE] ping failed:", e.message);
      }
    }, 14 * 60 * 1000);
  }
});
