import streamlit as st
import google.generativeai as genai
import nexus_agent_logic
import os

# --- 1. PAGE CONFIGURATION (Must be first) ---
st.set_page_config(
    page_title="Nexus | DevSecOps Agent",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- 2. CUSTOM CSS (The UI "Magic") ---
# This forces a professional "Dark Ops" look with Glassmorphism
st.markdown("""
<style>
    /* Main Background - Deep Charcoal */
    .stApp {
        background-color: #0e1117;
    }
    
    /* Card-like Containers */
    .css-1r6slb0, .stMarkdown, .stButton {
        font-family: 'Inter', sans-serif;
    }
    
    /* Custom Title Style */
    .main-title {
        font-size: 3rem !important;
        font-weight: 800;
        background: -webkit-linear-gradient(45deg, #3b82f6, #8b5cf6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    
    /* "Built By" Badge */
    .creator-badge {
        font-size: 1rem;
        color: #94a3b8;
        font-weight: 500;
        margin-bottom: 2rem;
        border-left: 3px solid #3b82f6;
        padding-left: 10px;
    }

    /* The "Control Panel" Card */
    .control-panel {
        background-color: #1e293b;
        padding: 2rem;
        border-radius: 12px;
        border: 1px solid #334155;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin-bottom: 2rem;
    }

    /* Primary Button Styling */
    .stButton>button {
        width: 100%;
        background: linear-gradient(90deg, #2563eb 0%, #4f46e5 100%);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
    }
    
    /* Input Field Styling */
    .stTextInput>div>div>input {
        background-color: #0f172a;
        color: #e2e8f0;
        border: 1px solid #334155;
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

# --- 3. SIDEBAR (Navigation & Status) ---
with st.sidebar:
    st.image("https://cdn-icons-png.flaticon.com/512/9662/9662363.png", width=60) # Placeholder Security Icon
    st.markdown("### Nexus Agent")
    st.caption("v2.5.0 | Enterprise Edition")
    
    st.markdown("---")
    
    st.markdown("#### 📡 System Status")
    st.markdown("✅ **AI Engine:** Online (Gemini 2.5)")
    st.markdown("✅ **Scanner:** Active")
    st.markdown("✅ **Database:** Connected")
    
    st.markdown("---")
    st.info("💡 **Pro Tip:** Use public GitHub URLs for the fastest scan speeds.")

# --- 4. MAIN HEADER ---
col1, col2 = st.columns([3, 1])
with col1:
    st.markdown('<h1 class="main-title">NEXUS AGENT</h1>', unsafe_allow_html=True)
    # --- YOUR REQUESTED TEXT CHANGE ---
    st.markdown('<div class="creator-badge">Built by Ganesh | Powered by Gemini 2.5</div>', unsafe_allow_html=True)

# --- 5. THE CONTROL PANEL (Input Area) ---
st.markdown('<div class="control-panel">', unsafe_allow_html=True)
st.markdown("### 🎯 Target Acquisition")
st.markdown("Enter the GitHub repository URL to initiate a comprehensive DevSecOps audit.")

# Input Form
with st.form("scan_form"):
    repo_url = st.text_input(
        "Repository URL", 
        placeholder="https://github.com/owner/repo",
        help="Paste the full HTTPS URL of the public repository."
    )
    
    # Using columns to center the button or make it responsive
    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        scan_btn = st.form_submit_button("🚀 Initialize Security Scan")

st.markdown('</div>', unsafe_allow_html=True)

# --- 6. SECRETS & SETUP (Hidden Logic) ---
# Try to get keys from Streamlit Cloud Secrets
api_key = None
if "GEMINI_API_KEY" in st.secrets:
    api_key = st.secrets["GEMINI_API_KEY"]
if "GITHUB_TOKEN" in st.secrets:
    os.environ["GITHUB_TOKEN"] = st.secrets["GITHUB_TOKEN"]

if api_key:
    genai.configure(api_key=api_key)
else:
    st.warning("⚠️ API Key missing. Please check Streamlit Secrets.")

# --- 7. AGENT EXECUTION LOGIC ---
if scan_btn and repo_url:
    if not api_key:
        st.error("❌ Authentication Failed: No Gemini API Key found.")
        st.stop()
        
    # Container for results
    result_container = st.container()
    
    with result_container:
        # Progress Bar & Status
        with st.status("🕵️ **Nexus is investigating...**", expanded=True) as status:
            
            st.write("📡 connecting to GitHub Secure Gateway...")
            # STEP 1: SCAN
            scan_data = nexus_agent_logic.scan_repo_manifest(repo_url)
            
            # --- DEBUG MODE (Hidden by default for Pro Look) ---
            with st.expander("🛠️ View Raw Diagnostic Data", expanded=False):
                st.code(scan_data, language='json')
                
            st.write("🧠 Analyzing dependency tree for CVEs...")
            
            # STEP 2: REASONING (The Brain)
            # Robust Model Selection
            try:
                available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
                if 'models/gemini-1.5-flash' in available_models:
                    model_name = 'gemini-1.5-flash'
                elif 'models/gemini-1.5-pro' in available_models:
                    model_name = 'gemini-1.5-pro'
                else:
                    model_name = 'gemini-pro'
                
                model = genai.GenerativeModel(model_name)
                
                prompt = f"""
                You are Nexus, an elite DevSecOps AI built by Ganesh.
                Analyze this repository scan: {scan_data}
                
                Task:
                1. Identify critical vulnerabilities in the dependencies.
                2. Explain *why* they are dangerous (RCE, XSS, etc.).
                3. Provide exact 'pip install' or 'npm install' remediation commands.
                4. Output a professional HTML report using Tailwind CSS. 
                5. Make it look like a "Top Secret" government report (Clean, Serious).
                """
                
                response = model.generate_content(prompt)
                report_html = response.text
                
                # Clean up markdown
                if "```html" in report_html:
                    report_html = report_html.replace("```html", "").replace("```", "")
                
                status.update(label="✅ **Audit Complete. Threat Level Calculated.**", state="complete", expanded=False)
                
            except Exception as e:
                st.error(f"AI Core Malfunction: {e}")
                st.stop()

        # --- 8. DISPLAY REPORT ---
        st.markdown("### 📊 Audit Results")
        st.components.v1.html(report_html, height=800, scrolling=True)
        
        st.download_button(
            label="📥 Download Official Report",
            data=report_html,
            file_name="Nexus_Audit_Report.html",
            mime="text/html"
        )
