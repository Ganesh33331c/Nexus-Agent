/**
 * NEXUS PDF Generation Microservice
 * ----------------------------------
 * POST /generate-pdf   → accepts { reportData, repoName } → returns PDF bytes
 * POST /error-pdf      → accepts { errorDetails, repoName, stage } → returns error PDF bytes
 *
 * Run: node server.js  (default port 3001)
 * Deps: npm install express puppeteer cors
 */

const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PDF_SERVICE_PORT || 3001;

// ─── HTML Template Builder ───────────────────────────────────────────────────
function buildReportHtml(reportData, repoName) {
  const findings = reportData.findings || [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  findings.forEach((f) => {
    const sev = (f.severity || "low").toLowerCase();
    if (counts[sev] !== undefined) counts[sev]++;
  });

  const totalHighRisk = counts.critical + counts.high;
  const totalModerateRisk = counts.medium + counts.low;

  const cardsHtml = findings
    .map((f, index) => {
      const sev = (f.severity || "low").toLowerCase();
      let borderColor, bgColor, textColor, shadowColor;

      if (sev === "critical") {
        borderColor = "#ef4444";
        bgColor = "rgba(239,68,68,0.12)";
        textColor = "#ef4444";
        shadowColor = "rgba(239,68,68,0.25)";
      } else if (sev === "high") {
        borderColor = "#f97316";
        bgColor = "rgba(249,115,22,0.12)";
        textColor = "#f97316";
        shadowColor = "rgba(249,115,22,0.2)";
      } else if (sev === "medium") {
        borderColor = "#f59e0b";
        bgColor = "rgba(245,158,11,0.12)";
        textColor = "#f59e0b";
        shadowColor = "rgba(245,158,11,0.15)";
      } else {
        borderColor = "#3b82f6";
        bgColor = "rgba(59,130,246,0.12)";
        textColor = "#3b82f6";
        shadowColor = "rgba(59,130,246,0.1)";
      }

      const findingId = f.id || `SEC-${String(index + 1).padStart(3, "0")}`;
      const title = f.title || "Unknown Finding";
      const analysis = f.analysis || f.description || "No description provided.";
      const poc = f.poc || "N/A";
      const remediation = f.remediation || f.fix || "Manual intervention required.";

      return `
        <div class="vuln-card" style="
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-left: 4px solid ${borderColor};
          border-radius: 16px;
          padding: 28px 32px;
          margin-bottom: 28px;
          box-shadow: 0 0 24px -6px ${shadowColor};
          page-break-inside: avoid;
        ">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; gap:16px;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap;">
                <span style="
                  background:${bgColor};
                  color:${textColor};
                  border:1px solid ${borderColor}40;
                  padding:3px 12px;
                  border-radius:20px;
                  font-size:10px;
                  font-weight:800;
                  letter-spacing:0.1em;
                  text-transform:uppercase;
                  font-family:'JetBrains Mono', monospace;
                ">${sev} Severity</span>
                <span style="color:#64748b; font-family:'JetBrains Mono',monospace; font-size:11px;">ID: ${findingId}</span>
              </div>
              <h3 style="font-family:'Outfit',sans-serif; font-size:18px; font-weight:700; color:#f1f5f9; margin:0; line-height:1.3;">${title}</h3>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div>
              <p style="font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700; letter-spacing:0.12em; color:#3b82f6; text-transform:uppercase; margin:0 0 8px 0;">Analysis</p>
              <p style="color:#94a3b8; line-height:1.7; font-size:13px; font-family:'Inter',sans-serif; margin:0 0 16px 0;">${analysis}</p>

              ${
                poc && poc !== "N/A"
                  ? `<p style="font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700; letter-spacing:0.12em; color:#64748b; text-transform:uppercase; margin:0 0 6px 0;">Proof of Concept</p>
                <pre style="
                  background:rgba(0,0,0,0.5);
                  border:1px solid rgba(255,255,255,0.08);
                  border-radius:10px;
                  padding:12px 14px;
                  font-family:'JetBrains Mono',monospace;
                  font-size:11px;
                  color:#93c5fd;
                  white-space:pre-wrap;
                  word-break:break-all;
                  margin:0;
                  overflow:hidden;
                ">${escapeHtml(poc)}</pre>`
                  : ""
              }
            </div>
            <div>
              <p style="font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700; letter-spacing:0.12em; color:#3b82f6; text-transform:uppercase; margin:0 0 8px 0;">Remediation Patch</p>
              <pre style="
                background:rgba(0,0,0,0.5);
                border:1px solid rgba(255,255,255,0.08);
                border-radius:10px;
                padding:14px 16px;
                font-family:'JetBrains Mono',monospace;
                font-size:11px;
                color:#93c5fd;
                white-space:pre-wrap;
                word-break:break-all;
                margin:0;
                min-height:80px;
                overflow:hidden;
              ">${escapeHtml(remediation)}</pre>
            </div>
          </div>
        </div>`;
    })
    .join("");

  const scanDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const statusColor =
    reportData.scan_status === "Failed" ||
    reportData.scan_status?.includes("Error")
      ? "#ef4444"
      : "#22c55e";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Security Audit | ${repoName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      background: #020617;
      color: #f1f5f9;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* Cover page */
    .cover-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px;
      position: relative;
      overflow: hidden;
      background: radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.08) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 50%),
                  #020617;
      page-break-after: always;
    }

    .cover-grid {
      position: absolute;
      inset: 0;
      background-image: linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .cover-accent-line {
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      border-radius: 2px;
      margin-bottom: 24px;
    }

    .cover-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.25em;
      color: #3b82f6;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .cover-title {
      font-family: 'Outfit', sans-serif;
      font-size: 52px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: #f8fafc;
      margin-bottom: 12px;
    }

    .cover-title span {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cover-subtitle {
      font-size: 15px;
      color: #64748b;
      margin-bottom: 48px;
      letter-spacing: 0.01em;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      max-width: 600px;
      margin-bottom: 48px;
    }

    .cover-meta-item {
      background: rgba(15,23,42,0.8);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 16px;
    }

    .cover-meta-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 6px;
    }

    .cover-meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      word-break: break-all;
    }

    .cover-risk-grid {
      display: grid;
      grid-template-columns: repeat(4, auto);
      gap: 12px;
      max-width: 480px;
    }

    .risk-badge {
      padding: 8px 16px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: center;
    }

    .cover-footer {
      position: absolute;
      bottom: 40px;
      left: 60px;
      right: 60px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 20px;
    }

    .cover-footer-brand {
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #334155;
    }

    .cover-footer-brand span {
      color: #3b82f6;
    }

    /* Content pages */
    .content-wrap {
      padding: 48px 60px;
      background: #020617;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .section-header-bar {
      width: 4px;
      height: 28px;
      background: linear-gradient(180deg, #3b82f6, #8b5cf6);
      border-radius: 2px;
    }

    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #f1f5f9;
    }

    /* Executive summary */
    .exec-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 40px;
    }

    .exec-card {
      background: rgba(15,23,42,0.7);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 22px;
    }

    .exec-card-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 8px;
    }

    .exec-card-value {
      font-family: 'Outfit', sans-serif;
      font-size: 32px;
      font-weight: 800;
      line-height: 1;
    }

    .exec-card-desc {
      font-size: 13px;
      color: #64748b;
      line-height: 1.6;
      margin-top: 8px;
    }

    .page-break { page-break-before: always; }

    /* Recommendations section */
    .rec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 8px;
    }

    .rec-item {
      background: rgba(15,23,42,0.5);
      border: 1px solid rgba(59,130,246,0.15);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .rec-icon {
      width: 36px;
      height: 36px;
      background: rgba(59,130,246,0.15);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 16px;
    }

    .rec-title {
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #e2e8f0;
      margin-bottom: 4px;
    }

    .rec-desc {
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }

    .report-footer {
      text-align: center;
      padding: 32px 0;
      margin-top: 40px;
      border-top: 1px dashed rgba(255,255,255,0.08);
      color: #334155;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>

  <!-- ═══ COVER PAGE ═══ -->
  <div class="cover-page">
    <div class="cover-grid"></div>

    <div style="position:relative; z-index:1;">
      <div class="cover-label">DevSecOps Autonomous Audit</div>
      <div class="cover-accent-line"></div>
      <h1 class="cover-title">Security<br><span>Analysis Report</span></h1>
      <p class="cover-subtitle">Automated vulnerability assessment powered by Nexus AI Engine</p>

      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Target Repository</div>
          <div class="cover-meta-value" style="color:#93c5fd;">${repoName}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Scan Date</div>
          <div class="cover-meta-value">${scanDate}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Scan Status</div>
          <div class="cover-meta-value" style="color:${statusColor};">${reportData.scan_status || "Completed"}</div>
        </div>
      </div>

      <div class="cover-risk-grid">
        <div class="risk-badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);">
          ${counts.critical} Critical
        </div>
        <div class="risk-badge" style="background:rgba(249,115,22,0.15); color:#f97316; border:1px solid rgba(249,115,22,0.3);">
          ${counts.high} High
        </div>
        <div class="risk-badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);">
          ${counts.medium} Medium
        </div>
        <div class="risk-badge" style="background:rgba(59,130,246,0.12); color:#3b82f6; border:1px solid rgba(59,130,246,0.25);">
          ${counts.low} Low
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div class="cover-footer-brand">NEXUS <span>DevSecOps Agent</span></div>
      <div style="font-family:'JetBrains Mono',monospace; font-size:10px; color:#1e293b;">
        CONFIDENTIAL · AUTOMATED REPORT
      </div>
    </div>
  </div>

  <!-- ═══ CONTENT ═══ -->
  <div class="content-wrap">

    <!-- Executive Summary -->
    <div class="section-header">
      <div class="section-header-bar"></div>
      <h2 class="section-title">Executive Summary</h2>
    </div>

    <div class="exec-grid">
      <div class="exec-card">
        <div class="exec-card-label">Assessment Overview</div>
        <p class="exec-card-desc" style="margin-top:0; color:#94a3b8; font-size:14px; line-height:1.7;">
          The Nexus SAST + SCA scan identified <strong style="color:#f1f5f9;">${findings.length} total vulnerabilities</strong>
          across the repository. <strong style="color:#ef4444;">${totalHighRisk} critical/high severity</strong> issues
          require immediate remediation. <strong style="color:#f59e0b;">${totalModerateRisk} moderate/low</strong> issues
          represent technical debt or defence-in-depth improvements.
        </p>
      </div>
      <div class="exec-card" style="border-left:4px solid #ef4444; box-shadow: 0 0 20px -5px rgba(239,68,68,0.25);">
        <div class="exec-card-label">Critical / High</div>
        <div class="exec-card-value" style="color:#ef4444;">${totalHighRisk}</div>
        <div class="exec-card-desc">Immediate action required</div>
      </div>
      <div class="exec-card" style="border-left:4px solid #f59e0b; box-shadow: 0 0 20px -5px rgba(245,158,11,0.15);">
        <div class="exec-card-label">Moderate / Low</div>
        <div class="exec-card-value" style="color:#f59e0b;">${totalModerateRisk}</div>
        <div class="exec-card-desc">Address in next sprint</div>
      </div>
    </div>

    <!-- Findings -->
    <div class="section-header" style="margin-top:40px;">
      <div class="section-header-bar"></div>
      <h2 class="section-title">Vulnerability Findings</h2>
      <span style="
        margin-left:auto;
        font-family:'JetBrains Mono',monospace;
        font-size:10px;
        color:#475569;
        background:rgba(15,23,42,0.8);
        border:1px solid rgba(255,255,255,0.08);
        padding:4px 12px;
        border-radius:6px;
      ">${findings.length} FINDINGS TOTAL</span>
    </div>

    ${cardsHtml}

    <!-- Recommendations -->
    <div class="section-header page-break" style="margin-top:40px;">
      <div class="section-header-bar" style="background:linear-gradient(180deg,#22c55e,#16a34a);"></div>
      <h2 class="section-title">General Recommendations</h2>
    </div>

    <div class="rec-grid">
      <div class="rec-item">
        <div class="rec-icon">🔄</div>
        <div>
          <div class="rec-title">Keep Dependencies Updated</div>
          <div class="rec-desc">Regularly update all dependencies to their latest stable versions. Use <code style="font-family:'JetBrains Mono',monospace; font-size:10px; color:#93c5fd;">pip-audit</code> or Dependabot to automate this.</div>
        </div>
      </div>
      <div class="rec-item">
        <div class="rec-icon">🔁</div>
        <div>
          <div class="rec-title">Integrate CI/CD Scanning</div>
          <div class="rec-desc">Add the Nexus scan as a GitHub Actions step so every PR is scanned before merge. Fail the pipeline on critical findings.</div>
        </div>
      </div>
      <div class="rec-item">
        <div class="rec-icon">🔐</div>
        <div>
          <div class="rec-title">Secrets Management</div>
          <div class="rec-desc">Never commit secrets to source control. Use environment variables, HashiCorp Vault, or GitHub Secrets instead of hardcoded credentials.</div>
        </div>
      </div>
      <div class="rec-item">
        <div class="rec-icon">📋</div>
        <div>
          <div class="rec-title">Security Code Reviews</div>
          <div class="rec-desc">Require security-focused code reviews for all auth, crypto, and data-handling changes. Use OWASP checklists as review gates.</div>
        </div>
      </div>
    </div>

    <div class="report-footer">
      This report was generated autonomously by the Nexus AI DevSecOps Agent · ${scanDate} ·
      Treat this document as CONFIDENTIAL
    </div>
  </div>

</body>
</html>`;
}

// ─── Error PDF Template ──────────────────────────────────────────────────────
function buildErrorReportHtml(errorDetails, repoName, stage) {
  const scanDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const scanTime = new Date().toLocaleTimeString("en-US", { hour12: false });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nexus Scan Error Report | ${repoName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      background: #020617;
      color: #f1f5f9;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      padding: 60px;
      -webkit-font-smoothing: antialiased;
    }
    .grid-bg {
      position: fixed; inset: 0; pointer-events: none;
      background-image: linear-gradient(rgba(239,68,68,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(239,68,68,0.025) 1px, transparent 1px);
      background-size: 40px 40px;
    }
    .error-banner {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.3);
      border-left: 5px solid #ef4444;
      border-radius: 16px;
      padding: 32px 36px;
      margin-bottom: 36px;
      position: relative;
    }
    .error-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.4);
      color: #ef4444;
      padding: 5px 14px;
      border-radius: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .error-badge::before {
      content: '⬤';
      font-size: 8px;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 36px;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 8px;
    }
    h1 span { color: #ef4444; }
    .subtitle {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 0;
    }
    .meta-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 32px;
    }
    .meta-card {
      background: rgba(15,23,42,0.8);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 18px;
    }
    .meta-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 6px;
    }
    .meta-value { font-size: 13px; font-weight: 600; color: #e2e8f0; word-break: break-all; }
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .section-bar {
      width: 4px; height: 22px;
      background: linear-gradient(180deg, #ef4444, #b91c1c);
      border-radius: 2px;
    }
    .trace-box {
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(239,68,68,0.2);
      border-radius: 12px;
      padding: 20px 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #fca5a5;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.8;
      margin-bottom: 28px;
    }
    .stage-timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 32px;
    }
    .stage-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .stage-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .stage-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 2px;
    }
    .stage-desc { font-size: 12px; color: #475569; }
    .rec-box {
      background: rgba(59,130,246,0.06);
      border: 1px solid rgba(59,130,246,0.2);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 12px;
    }
    .rec-title { font-weight: 700; color: #93c5fd; margin-bottom: 4px; font-size: 13px; }
    .rec-body { font-size: 12px; color: #64748b; line-height: 1.6; }
    .footer { text-align:center; margin-top:40px; color:#1e293b; font-size:11px; letter-spacing:0.05em; border-top:1px dashed rgba(255,255,255,0.05); padding-top:24px; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>

  <div class="error-banner">
    <div class="error-badge">Scan Failed · System Error</div>
    <h1>Scan <span>Failure</span> Report</h1>
    <p class="subtitle">The Nexus engine encountered an error during repository analysis. This report details the failure for debugging purposes.</p>
  </div>

  <div class="meta-row">
    <div class="meta-card">
      <div class="meta-label">Target Repository</div>
      <div class="meta-value" style="color:#93c5fd;">${repoName || "Unknown"}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Failure Stage</div>
      <div class="meta-value" style="color:#ef4444;">${stage || "Unknown Stage"}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Timestamp</div>
      <div class="meta-value">${scanDate} ${scanTime}</div>
    </div>
  </div>

  <div class="section-title">
    <div class="section-bar"></div>
    Error Trace
  </div>
  <div class="trace-box">${escapeHtml(String(errorDetails?.message || errorDetails || "No error details captured."))}</div>

  <div class="section-title">
    <div class="section-bar"></div>
    Pipeline Execution Timeline
  </div>
  <div class="stage-timeline">
    ${buildStageTimeline(stage)}
  </div>

  <div class="section-title">
    <div class="section-bar" style="background:linear-gradient(180deg,#22c55e,#16a34a);"></div>
    Recommended Resolution Steps
  </div>

  <div class="rec-box">
    <div class="rec-title">1. Verify Repository URL</div>
    <div class="rec-body">Ensure the GitHub URL is correct, the repository is public, and the URL ends without trailing slashes. Example: <code style="font-family:monospace; color:#93c5fd;">https://github.com/user/repo</code></div>
  </div>
  <div class="rec-box">
    <div class="rec-title">2. Check API Key & Quota</div>
    <div class="rec-body">Verify your <code style="font-family:monospace; color:#93c5fd;">GEMINI_API_KEY</code> environment variable is set and not rate-limited. If on the free tier, wait 60 seconds between scans.</div>
  </div>
  <div class="rec-box">
    <div class="rec-title">3. Review Server Logs</div>
    <div class="rec-body">Check the FastAPI backend console for the full Python traceback. The error detail above may be truncated.</div>
  </div>
  <div class="rec-box">
    <div class="rec-title">4. Retry the Scan</div>
    <div class="rec-body">Transient network errors often resolve on retry. If the error persists, file a bug report with this PDF attached.</div>
  </div>

  <div class="footer">
    Nexus DevSecOps Agent · Error Report · ${scanDate} · CONFIDENTIAL
  </div>
</body>
</html>`;
}

const PIPELINE_STAGES = [
  { name: "Repository Clone", desc: "Git clone to ephemeral sandbox" },
  { name: "SAST Scan", desc: "Static regex analysis across 20 pattern classes" },
  { name: "SCA Scan", desc: "Dependency manifest parsing and CVE hint matching" },
  { name: "AI Analysis", desc: "Gemini structured-output report generation" },
  { name: "DB Archival", desc: "Audit record persistence to SQLite" },
];

function buildStageTimeline(failedStage) {
  const stageMap = {
    clone: 0,
    sast: 1,
    sca: 2,
    ai: 3,
    db: 4,
  };
  const failIndex =
    stageMap[failedStage?.toLowerCase()] ?? PIPELINE_STAGES.length;

  return PIPELINE_STAGES.map((s, i) => {
    let dotColor, textColor, desc;
    if (i < failIndex) {
      dotColor = "#22c55e";
      textColor = "#22c55e";
      desc = "Completed successfully";
    } else if (i === failIndex) {
      dotColor = "#ef4444";
      textColor = "#ef4444";
      desc = `FAILED — ${s.desc}`;
    } else {
      dotColor = "#334155";
      textColor = "#475569";
      desc = "Not executed";
    }

    return `
      <div class="stage-item">
        <div class="stage-dot" style="background:${dotColor}; box-shadow:0 0 6px ${dotColor}50;"></div>
        <div>
          <div class="stage-name" style="color:${textColor};">${s.name}</div>
          <div class="stage-desc">${desc}</div>
        </div>
      </div>`;
  }).join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Core PDF Generator ──────────────────────────────────────────────────────
async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent(html, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 30000,
    });

    // Wait for Google Fonts to load
    await page.waitForFunction(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 800));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      displayHeaderFooter: false,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "nexus-pdf-service", version: "1.0.0" });
});

// Generate full security report PDF
app.post("/generate-pdf", async (req, res) => {
  const { reportData, repoName } = req.body;

  if (!reportData || !repoName) {
    return res.status(400).json({ error: "reportData and repoName are required" });
  }

  try {
    console.log(`[PDF] Generating report for: ${repoName}`);
    const html = buildReportHtml(reportData, repoName);
    const pdfBuffer = await generatePdf(html);

    const safeFilename = repoName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Nexus_Audit_${safeFilename}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
    console.log(`[PDF] Done — ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.error("[PDF] Generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Generate error report PDF
app.post("/error-pdf", async (req, res) => {
  const { errorDetails, repoName, stage } = req.body;

  try {
    console.log(`[PDF] Generating error report for: ${repoName}, stage: ${stage}`);
    const html = buildErrorReportHtml(errorDetails, repoName, stage);
    const pdfBuffer = await generatePdf(html);

    const safeFilename = (repoName || "unknown").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Nexus_Error_Report_${safeFilename}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
    console.log(`[PDF] Error report done — ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.error("[PDF] Error report generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔒 Nexus PDF Service running on http://localhost:${PORT}`);
  console.log(`   POST /generate-pdf  → full security report`);
  console.log(`   POST /error-pdf     → scan failure report\n`);
});
