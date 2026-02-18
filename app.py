import streamlit as st
import google.generativeai as genai
import nexus_agent_logic
import os
import re
import json
import importlib.metadata
from datetime import datetime

# --- 1. PAGE CONFIGURATION ---
st.set_page_config(
    page_title="Nexus DevSecOps Agent",
    page_icon="🛡️",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# --- 2. CUSTOM CSS (Professional UI) ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');

    .stApp {
        background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
        background-size: 400% 400%;
        animation: gradient 15s ease infinite;
    }
    
    @keyframes gradient {
        0% {background-position: 0% 50%;}
        50% {background-position: 100% 50%;}
        100% {background-position: 0% 50%;}
    }

    h1, h2, h3, p, div, span {
        font-family: 'Outfit', sans-serif !important;
        color: #ffffff !important;
        text-align: center;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .logo-container {
        display: flex;
        justify-content: center;
        margin-bottom: 20px;
    }
    
    .nexus-logo {
        width: 140px;
        height: 140px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.3);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.5);
        font-size: 70px;
        animation: float 6s ease-in-out infinite;
    }
    
    @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
    }

    .agent-title {
        font-size: 3.5rem;
        font-weight: 800;
        margin-bottom: 0px;
    }

    .agent-subtitle {
        font-size: 1.2rem;
        font-weight: 600;
        opacity: 0.95;
        margin-bottom: 40px;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    /* Forced Dark Text for Visibility */
    .stTextArea > div > div > textarea {
        background-color: #ffffff !important;
        border: 2px solid #e2e8f0;
        color: #000000 !important;
        font-weight: 600;
        border-radius: 12px;
        padding: 15px;
        font-size: 16px;
    }

    .stButton > button {
        width: 100%;
        background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%);
        color: white !important;
        font-weight: 800;
        border-radius: 12px;
        padding: 15px 30px;
        border: none;
        transition: all 0.3s ease;
        cursor: pointer !important;
    }
    
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# --- 3. THE "NUCLEAR" SCANNER TOOL ---

def scan_code_for_patterns(root_dir):
    """
    Recursively scans all files in root_dir for dangerous security patterns using Regex.
   
    """
    findings = []
    patterns = {
        r'yaml\.load\(': "RCE Risk (Unsafe Deserialization)",
        r'pickle\.load\(': "RCE Risk (Unsafe Deserialization)",
        r'eval\(': "Arbitrary Code Execution",
        r'exec\(': "Arbitrary Code Execution",
        r'os\.system\(': "Command Injection",
        r'subprocess\.Popen.*shell=True': "Command Injection",
        r'raw_input\(': "Python 2 Compatibility / Legacy Risk"
    }

    if not os.path.exists(root_dir):
        return "SAFE: No directory found to scan."

    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            
            # Skip hidden files or common binaries
            if filename.startswith('.') or filename.lower().endswith(('.png', '.jpg', '.pyc', '.git')):
                continue

            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()

                for i, line in enumerate(lines):
                    for pattern, risk in patterns.items():
                        if re.search(pattern, line):
                            clean_line = line.strip()[:100]
                            rel_path = os.path.relpath(filepath, root_dir)
                            findings.append(
                                f"[CRITICAL] Found '{pattern.replace(r'\\\\', '')}' "
                                f"in {rel_path} at line {i+1}: \"{clean_line}\" "
                                f"({risk})"
                            )
            except Exception:
                continue

    if not findings:
        return "SAFE: No critical patterns found."

    return "\n".join(findings)

# --- 4. UI LAYOUT ---

st.markdown('<div class="logo-container"><div class="nexus-logo">🛡️</div></div>', unsafe_allow_html=True)
st.markdown('<h1 class="agent-title">NEXUS AGENT</h1>', unsafe_allow_html=True)
st.markdown('<div class="agent-subtitle">Nuclear SAST & SCA Auditor • Built by Ganesh</div>', unsafe_allow_html=True)

with st.form(key="nexus_input_form"):
    repo_url = st.text_area("Target Repository URL", height=100, placeholder="Paste GitHub URL here...", label_visibility="collapsed")
    st.write("") 
    c1, c2 = st.columns([4, 1])
    with c2:
        scan_btn = st.form_submit_button("🚀 LAUNCH")

# --- 5. SECRETS & SETUP ---
api_key = st.secrets.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# --- 6. EXECUTION LOGIC ---
if scan_btn and repo_url:
    if not api_key:
        st.error("❌ API Key Error: Check Streamlit Secrets.")
        st.stop()
        
    st.markdown("<br>", unsafe_allow_html=True)
    
    with st.status("⚙️ **NEXUS CORE ACTIVE**", expanded=True) as status:
        
        # SCA: Manifest Scan
        st.write("📡 Scanning Repository Manifest...")
        raw_output = nexus_agent_logic.scan_repo_manifest(repo_url)
        
        if isinstance(raw_output, str):
            try: scan_data = json.loads(raw_output)
            except: scan_data = {"raw_output": raw_output}
        else: scan_data = raw_output

        # SAST: Nuclear Regex Scan
        st.write("🔬 Initializing Nuclear Regex Scanner...")
        scanner_output = scan_code_for_patterns("repo_clone")
        scan_data["nuclear_sast_results"] = scanner_output
        
        with st.expander("Show Diagnostic Data", expanded=False):
            st.code(json.dumps(scan_data, indent=2), language='json')
            
        st.write("🛡️ Cross-referencing CVE Database...")
        
        # MODEL SELECTION
        try:
            model_names = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            used_model = next((m for m in model_names if 'flash' in m), model_names[0])
            model = genai.GenerativeModel(used_model)
            
            # UPDATED SYSTEM PROMPT
            prompt = f"""
            You are Nexus, a DevSecOps AI. 
            Analyze this repository scan: {scan_data}
            
            ### MANDATORY PROTOCOL:
            1. VERBATIM REPORTING: If 'nuclear_sast_results' contains lines starting with [CRITICAL], you MUST include them exactly.
            2. EVIDENCE SECTION: Create a 'Code Evidence' section in the HTML report using a dark terminal style.
            3. ANALYSIS: Explain the risk (RCE, Injection) for each finding.
            
            Output a professional HTML report using Tailwind CSS.
            """
            
            response = model.generate_content(prompt)
            report_html = response.text.replace("```html", "").replace("```", "")
            
            status.update(label=f"✅ **AUDIT COMPLETE ({used_model})**", state="complete", expanded=False)
            st.markdown("### 📊 VULNERABILITY REPORT")
            st.components.v1.html(report_html, height=800, scrolling=True)
            
            # Download Button
            st.download_button(label="📥 Download Report (.html)", data=report_html, file_name=f"Nexus_Audit_{datetime.now().strftime('%Y%m%d')}.html", mime="text/html")
            
        except Exception as e:
            st.error(f"❌ AI Failure: {e}")
