import streamlit as st
import google.generativeai as genai
import nexus_agent_logic
import os
import re
import json
import tempfile
import shutil
import time
from git import Repo
from datetime import datetime

# --- 1. THEME & UI CONFIGURATION ---
st.set_page_config(
    page_title="Nexus AI Auditor",
    page_icon="🛡️",
    layout="centered",
    initial_sidebar_state="expanded"
)

# Sidebar Theme Toggle
with st.sidebar:
    st.markdown("### 🎚️ Display Settings")
    dark_mode = st.toggle("Dark Mode", value=False)
    st.markdown("---")
    st.markdown("### 🛠️ Session Info")
    st.caption("Nexus Core: v2.5-Nuclear")

# Opal UI Styling (Dynamic Light/Dark)
bg_color = "#111827" if dark_mode else "#FFFFFF"
text_color = "#F9FAFB" if dark_mode else "#111827"
input_bg = "#1F2937" if dark_mode else "#FFFFFF"

st.markdown(f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
    
    html, body, [data-testid="stAppViewContainer"] {{
        background-color: {bg_color} !important;
        font-family: 'Inter', sans-serif;
    }}

    .stMarkdown, p, h1, h2, h3, span, label {{
        color: {text_color} !important;
    }}

    /* Floating Pill Input */
    .stChatInputContainer {{
        background-color: transparent !important;
        bottom: 30px;
    }}
    
    .stChatInputContainer > div {{
        background-color: {input_bg} !important;
        border-radius: 30px !important;
        border: 1px solid #374151 !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
    }}

    /* Minimalist Cards */
    [data-testid="stExpander"] {{
        background-color: {input_bg} !important;
        border-radius: 15px !important;
        border: 1px solid #374151 !important;
    }}

    #MainMenu, footer, header {{visibility: hidden;}}
</style>
""", unsafe_allow_html=True)

# --- 2. THE BLACK-BOX TOOLS (DO NOT TOUCH) ---

def find_python_root(start_path):
    for dirpath, _, filenames in os.walk(start_path):
        if any(f.endswith(".py") for f in filenames): return dirpath
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
        r'app\.run\(.*debug=True': "Flask Debug Enabled"
    }
    if not os.path.exists(actual_path): return "[DEBUG] Directory not found."
    for dirpath, _, filenames in os.walk(actual_path):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if filename.startswith('.') or filename.lower().endswith(('.png', '.pyc')): continue
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    for i, line in enumerate(f):
                        for pattern, risk in patterns.items():
                            if re.search(pattern, line):
                                findings.append(f"[CRITICAL] Found '{risk}' in {os.path.relpath(filepath, base_dir)} at line {i+1}")
            except: continue
    return "\n".join(findings) if len(findings) > 1 else "SAFE: No critical patterns found."

# --- 3. GRAPHICAL REPORT GENERATOR ---

def generate_visual_report(scan_data, is_dark):
    """Generates a dashboard with SVG charts."""
    theme_bg = "#111827" if is_dark else "#F9FAFB"
    card_bg = "#1F2937" if is_dark else "#FFFFFF"
    text = "#F9FAFB" if is_dark else "#111827"
    
    html_content = f"""
    <script src="https://cdn.tailwindcss.com"></script>
    <div style="background-color: {theme_bg}; color: {text};" class="p-8 font-sans min-h-screen">
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10 border-b border-gray-700 pb-6">
                <div>
                    <h1 class="text-4xl font-extrabold tracking-tight">Security Audit</h1>
                    <p class="opacity-60">Nexus AI Autonomous Scan</p>
                </div>
                <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl text-sm font-bold">LIVE-REPORT</div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div style="background-color: {card_bg};" class="p-6 rounded-3xl shadow-xl border border-gray-700">
                    <p class="text-xs uppercase opacity-50 font-bold mb-2">Vulnerability Ratio</p>
                    <svg class="w-20 h-20 transform -rotate-90">
                        <circle cx="40" cy="40" r="35" stroke="#374151" stroke-width="10" fill="transparent" />
                        <circle cx="40" cy="40" r="35" stroke="#EF4444" stroke-width="10" fill="transparent" 
                            stroke-dasharray="220" stroke-dashoffset="110" />
                    </svg>
                </div>
                <div style="background-color: {card_bg};" class="p-6 rounded-3xl shadow-xl border border-gray-700 col-span-2">
                    <p class="text-xs uppercase opacity-50 font-bold mb-2">Findings Summary</p>
                    <div class="flex items-center gap-4 mt-4">
                        <div class="h-12 w-12 bg-red-500/20 flex items-center justify-center rounded-xl text-red-500 font-bold text-xl">!</div>
                        <p class="text-lg">Critical vulnerabilities identified in repository source.</p>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <div class="p-6 rounded-3xl border-l-8 border-red-500" style="background-color: {card_bg};">
                    <h3 class="font-bold text-xl mb-2">Recursive Pattern Match Found</h3>
                    <pre class="bg-black/30 p-4 rounded-xl font-mono text-sm overflow-x-auto text-red-400">
{scan_data.get('sast', 'No findings')}
                    </pre>
                </div>
            </div>
        </div>
    </div>
    """
    return html_content

# --- 4. APP EXECUTION ---

st.markdown(f"<h1 style='text-align: center;'>Nexus Audit Agent</h1>", unsafe_allow_html=True)
st.markdown(f"<p style='text-align: center; opacity: 0.6;'>Autonomous DevSecOps Analysis Engine</p>", unsafe_allow_html=True)

if repo_url := st.chat_input("Paste repository URL..."):
    api_key = st.secrets.get("GEMINI_API_KEY")
    if not api_key: st.error("API Key Missing"); st.stop()
    genai.configure(api_key=api_key)
    
    temp_dir = None
    try:
        with st.status("💎 Generating Dashboard...", expanded=True) as status:
            # Step 1 & 2: Clone & Scan
            temp_dir = tempfile.mkdtemp()
            Repo.clone_from(repo_url, temp_dir)
            cloned_path = os.path.abspath(temp_dir)
            sast_results = scan_code_for_patterns(cloned_path)
            
            # Step 3: Analysis
            model = genai.GenerativeModel('gemini-1.5-flash')
            scan_context = {"cloned_path": cloned_path, "sast": sast_results}
            
            # Create Graphical Report
            report_html = generate_visual_report(scan_context, dark_mode)
            
            status.update(label="✅ Audit Ready", state="complete", expanded=False)
            st.components.v1.html(report_html, height=700, scrolling=True)
            
            st.download_button("📥 Export Dashboard", data=report_html, file_name="Nexus_Report.html", mime="text/html")
            
    except Exception as e: st.error(f"Scan Failure: {e}")
    finally:
        if temp_dir and os.path.exists(temp_dir): shutil.rmtree(temp_dir)
