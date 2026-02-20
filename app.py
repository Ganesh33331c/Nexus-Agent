import streamlit as st
import streamlit.components.v1 as components
import requests
import datetime
import tempfile
import os
import shutil
import json
import re
import time
from git import Repo
import google.generativeai as genai
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

import nexus_agent_logic 

# --- 1. API KEY SETUP ---
api_key = st.secrets.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# --- 2. DATABASE SETUP ---
Base = declarative_base()
class SecurityAudit(Base):
    __tablename__ = 'audits'
    id = Column(Integer, primary_key=True)
    repo_name = Column(String(255))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(50))
    report_html = Column(Text)

engine = create_engine('sqlite:///nexus_history.db', connect_args={'check_same_thread': False})
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)

def save_audit(repo_name, status, html):
    with SessionLocal() as session:
        session.add(SecurityAudit(repo_name=repo_name, status=status, report_html=html))
        session.commit()

# --- 3. ALERT SYSTEM ---
def send_security_alert(webhook_url, repo_name, critical_count):
    if not webhook_url or critical_count == 0: return
    msg = f"🚨 *NEXUS ALERT* 🚨\n**Repo**: `{repo_name}`\n**Criticals**: {critical_count}\n⚠️ Action required."
    try: requests.post(webhook_url, json={"text": msg, "content": msg}, timeout=5)
    except: pass

# --- 4. BLACK BOX SAST TOOLS ---
def find_python_root(start_path):
    for dirpath, _, filenames in os.walk(start_path):
        if any(f.endswith(".py") for f in filenames):
            return dirpath
    return start_path

def scan_code_for_patterns(base_dir):
    actual_path = find_python_root(base_dir)
    findings = [f"[DEBUG] Scanning directory: {actual_path}"]

    patterns = {
        r'yaml\.load\(': "RCE Risk (Unsafe Deserialization)",
        r'pickle\.load\(': "RCE Risk (Unsafe Deserialization)",
        r'eval\(': "Arbitrary Code Execution",
        r'exec\(': "Arbitrary Code Execution",
        r'os\.system\(': "Command Injection",
        r'subprocess\.Popen.*shell=True': "Command Injection",
        r'(?i)(api_key|secret_key|password|token)\s*=\s*[\'"][a-zA-Z0-9_\-]{16,}[\'"]': "Hardcoded Secret",
        r'app\.run\(.*debug=True': "Flask Debug Enabled",
        r'verify=False': "SSL Verification Disabled (MITM Risk)"
    }

    if not os.path.exists(actual_path):
        return "[DEBUG] Directory not found."

    for dirpath, _, filenames in os.walk(actual_path):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if filename.startswith('.') or filename.lower().endswith(('.png', '.jpg', '.pyc', '.exe')):
                continue

            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    for i, line in enumerate(f):
                        for pattern, risk in patterns.items():
                            if re.search(pattern, line):
                                clean_line = line.strip()[:100]
                                rel_path = os.path.relpath(filepath, base_dir)
                                findings.append(f"[CRITICAL] Found '{risk}' in {rel_path} at line {i+1}: \"{clean_line}\"")
            except Exception:
                continue

    return "\n".join(findings) if len(findings) > 1 else "SAFE: No critical patterns found."

# --- 5. ENTERPRISE HTML TEMPLATE ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {{ background-color: #0f172a; color: #cbd5e1; font-family: sans-serif; }}
        .glass {{ background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); }}
        .sev-critical {{ border-left: 4px solid #ef4444; }}
        .sev-high {{ border-left: 4px solid #f97316; }}
        .hidden {{ display: none; }}
    </style>
    <script>
        function filterSev(level) {{
            document.querySelectorAll('.f-card').forEach(c => {{
                c.classList.toggle('hidden', level !== 'all' && c.dataset.sev !== level);
            }});
        }}
    </script>
</head>
<body class="p-8"><div class="max-w-5xl mx-auto">
    <h1 class="text-3xl font-bold text-white mb-8">NEXUS <span class="text-blue-500">AUDIT</span></h1>
    
    <div class="flex gap-2 mb-8">
        <button onclick="filterSev('all')" class="px-4 py-2 bg-slate-800 text-white rounded">ALL</button>
        <button onclick="filterSev('critical')" class="px-4 py-2 bg-red-900/50 text-red-400 rounded">CRITICAL</button>
    </div>

    <div class="grid grid-cols-4 gap-4 mb-8">
        <div class="glass p-4 rounded text-center"><div class="text-red-500 text-xs font-bold uppercase">Critical</div><div class="text-3xl font-bold text-white mt-1">{c_crit}</div></div>
        <div class="glass p-4 rounded text-center"><div class="text-orange-500 text-xs font-bold uppercase">High</div><div class="text-3xl font-bold text-white mt-1">{c_high}</div></div>
        <div class="glass p-4 rounded text-center"><div class="text-yellow-500 text-xs font-bold uppercase">Medium</div><div class="text-3xl font-bold text-white mt-1">{c_med}</div></div>
        <div class="glass p-4 rounded text-center"><div class="text-emerald-500 text-xs font-bold uppercase">Low</div><div class="text-3xl font-bold text-white mt-1">{c_low}</div></div>
    </div>
    <div class="space-y-4">{detailed_findings}</div>
</div></body></html>
"""

def map_results_to_html(scan_data):
    findings = scan_data.get("findings", [])
    counts = {s: sum(1 for f in findings if f.get('severity', '').lower() == s) for s in ['critical', 'high', 'medium', 'low']}
    
    cards_html = ""
    for f in findings:
        sev = f.get('severity', 'low').lower()
        cards_html += f"""
        <div class="f-card glass p-6 rounded sev-{sev} mb-4" data-sev="{sev}">
            <h3 class="text-xl font-bold text-white mb-2">{f.get('title', 'Unknown')} <span class="text-xs bg-slate-800 p-1 px-2 rounded uppercase align-middle ml-2">{sev}</span></h3>
            <p class="text-sm text-slate-400 mb-4 leading-relaxed">{f.get('description', '')}</p>
            <div class="bg-black/50 p-4 rounded mb-2 border border-white/5"><span class="text-xs text-pink-400 font-bold uppercase tracking-wider block mb-1">Proof of Concept</span> <code class="text-sm text-pink-200">{f.get('poc', '')}</code></div>
            <div class="bg-black/50 p-4 rounded border border-emerald-500/10"><span class="text-xs text-emerald-400 font-bold uppercase tracking-wider block mb-1">Remediation</span> <code class="text-sm text-emerald-200">{f.get('fix', '')}</code></div>
        </div>
        """
    return HTML_TEMPLATE.format(c_crit=counts['critical'], c_high=counts['high'], c_med=counts['medium'], c_low=counts['low'], detailed_findings=cards_html)


# --- 6. STREAMLIT UI: NO SIDEBAR, CENTERED DESIGN ---
st.set_page_config(page_title="Nexus Cyber Audit", layout="wide", initial_sidebar_state="collapsed")

# Hide standard Streamlit header/footer for cleaner look
st.markdown("""
    <style>
        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        footer {visibility: hidden;}
    </style>
""", unsafe_allow_html=True)

# Initialize Session State for View Toggling
if "current_report" not in st.session_state:
    st.session_state.current_report = None


if st.session_state.current_report is None:
    # ==========================================
    # VIEW: LANDING PAGE & SCANNER CONSOLE
    # ==========================================
    
    # Big, Colorful Header
    st.markdown("""
    <div style="text-align: center; margin-top: 1rem; margin-bottom: 2.5rem;">
        <h1 style="font-size: 5rem; font-weight: 900; background: -webkit-linear-gradient(45deg, #06b6d4, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0;">NEXUS AGENT</h1>
        <p style="font-size: 1.2rem; color: #94a3b8; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">Autonomous DevSecOps Vulnerability Scanner</p>
    </div>
    """, unsafe_allow_html=True)

    # Center Console Layout using Columns
    _, center_col, _ = st.columns([1, 2, 1])

    with center_col:
        repo_input = st.text_input("🎯 Target Repository", placeholder="https://github.com/user/vulnerable-repo")
        
        with st.expander("⚙️ Advanced Configurations (Alerts)"):
            alert_webhook = st.text_input("Slack/Discord Webhook URL", type="password", placeholder="https://hooks.slack.com/...")
            st.caption("Receive instant alerts if critical vulnerabilities are discovered.")
            
        scan_btn = st.button("🚀 INITIATE SECURITY AUDIT", use_container_width=True, type="primary")
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        # History Section directly under the button
        with st.container(border=True):
            st.markdown("### 🗄️ Recent Audit History")
            with SessionLocal() as session:
                history = session.query(SecurityAudit).order_by(SecurityAudit.timestamp.desc()).limit(10).all()
                if history:
                    col_sel, col_btn = st.columns([3, 1])
                    with col_sel:
                        selected_audit = st.selectbox("Select Report", history, format_func=lambda x: f"{x.repo_name} ({x.timestamp.strftime('%Y-%m-%d %H:%M')})", label_visibility="collapsed")
                    with col_btn:
                        if st.button("Load Report", use_container_width=True):
                            st.session_state.current_report = selected_audit.report_html
                            st.rerun() # Immediately switch to report view
                else:
                    st.info("No previous audits found. Run your first scan above!")

    st.markdown("---")
    
    # Features Section
    c1, c2, c3 = st.columns(3)
    with c1:
        st.info("#### 🎯 1. Target Environment\nProvide a GitHub repository URL. Nexus creates a secure ephemeral workspace and clones the source code seamlessly.")
    with c2:
        st.warning("#### 🔬 2. Deep Scan\nThe SAST Regex Engine and SCA APIs aggressively hunt for RCEs, injections, and exposed secrets in milliseconds.")
    with c3:
        st.success("#### 🧠 3. AI Remediation\nThe Gemini Engine analyzes the raw vulnerability data to generate actionable proof-of-concepts and secure code fixes.")

    # Execution Logic
    if scan_btn and repo_input:
        with st.status("🛠️ Nexus Engine Active...", expanded=True) as status:
            
            st.write("📂 Cloning repository for SAST...")
            temp_dir = tempfile.mkdtemp()
            Repo.clone_from(repo_input, temp_dir)
            cloned_path = os.path.abspath(temp_dir)
            
            st.write("🔬 Executing Regex Pattern Engine...")
            sast_results = scan_code_for_patterns(cloned_path)
            
            st.write("📡 Fetching manifest via GitHub API...")
            raw_sca_json = nexus_agent_logic.scan_repo_manifest(repo_input)
            try:
                sca_results = json.loads(raw_sca_json)
            except json.JSONDecodeError:
                sca_results = {"error": "Failed to parse manifest."}

            st.write("🧠 Nexus AI preparing final report...")
            st.write("🛡️ Locating compatible AI model...")
            
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            if not available_models:
                st.error("❌ No compatible text models found.")
                st.stop()
                
            best_model_name = next((m for m in available_models if "flash" in m.lower()), available_models[0])
            model = genai.GenerativeModel(best_model_name)
            
            prompt = f"""
            Analyze this security data for repository: {repo_input}
            SAST Data: {sast_results}
            SCA Data: {sca_results}
            
            Return ONLY a raw JSON object with this exact structure (no markdown blocks like ```json):
            {{
                "repo_name": "Name of the repo",
                "findings": [
                    {{
                        "title": "Short title",
                        "severity": "Critical/High/Medium/Low",
                        "description": "1 sentence explanation",
                        "poc": "Vulnerable code or dependency version",
                        "fix": "How to fix it"
                    }}
                ]
            }}
            """
            
            max_retries = 3
            response = None
            
            for attempt in range(max_retries):
                try:
                    response = model.generate_content(prompt)
                    break 
                except Exception as e:
                    error_msg = str(e)
                    if "429" in error_msg and attempt < max_retries - 1:
                        st.warning(f"⚠️ API Quota limit reached. Waiting 31 seconds... (Attempt {attempt+1}/{max_retries})")
                        time.sleep(31)
                    else:
                        st.error(f"❌ AI Generation Failed: {error_msg}")
                        st.stop()
            
            try:
                if response and response.text:
                    clean_json = response.text.replace("```json", "").replace("```", "").strip()
                    scan_data = json.loads(clean_json)
                else:
                    raise ValueError("Empty response from AI.")
            except Exception as e:
                st.error(f"AI Output Parsing Error: {e}")
                scan_data = {"repo_name": repo_input, "findings": []}
                
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            
            status.update(label="Audit Complete! Preparing Report...", state="complete")
            time.sleep(1) # Small pause so the user sees completion before the page switches

        # Generate, Save, Alert, and Switch Views
        final_html = map_results_to_html(scan_data)
        crit_count = sum(1 for f in scan_data.get('findings', []) if f.get('severity', '').lower() == 'critical')
        audit_status = "Failed" if crit_count > 0 else "Passed"
        
        save_audit(scan_data['repo_name'], audit_status, final_html)
        if crit_count > 0: 
            send_security_alert(alert_webhook, scan_data['repo_name'], crit_count)
            st.toast("Alert sent to team channel!", icon="⚠️")
            
        st.session_state.current_report = final_html
        st.rerun() # Immediately switch to report view

else:
    # ==========================================
    # VIEW: ACTIVE HTML REPORT
    # ==========================================
    
    # Top Action Bar
    col_back, col_space, col_down = st.columns([1, 4, 1.5])
    
    with col_back:
        if st.button("⬅️ New Scan", use_container_width=True):
            st.session_state.current_report = None
            st.rerun() # Clears the report and goes back to landing page
            
    with col_down:
        # THE SINGLE DOWNLOAD BUTTON
        st.download_button(
            label="📥 Download HTML Report",
            data=st.session_state.current_report,
            file_name=f"Nexus_Audit_Report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html",
            mime="text/html",
            key="unique_nexus_download_btn",
            use_container_width=True,
            type="primary"
        )
        
    st.markdown("---")
    
    # The Visual Dashboard
    components.html(st.session_state.current_report, height=850, scrolling=True)
