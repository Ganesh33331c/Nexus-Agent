import streamlit as st
import google.generativeai as genai
import nexus_agent_logic
import os

# --- 1. PAGE CONFIGURATION ---
st.set_page_config(
    page_title="Nexus | DevSecOps Agent",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- 2. CUSTOM CSS (Dark Glass for Readability) ---
st.markdown("""
<style>
    /* IMPORT FONTS */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

    /* BACKGROUND IMAGE (Fixed & Darkened) */
    .stApp {
        background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop");
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
    }

    /* DARK GLASS CONTAINER (Solves Text Visibility) */
    .glass-container {
        background: rgba(17, 25, 40, 0.75); /* Dark semi-transparent background */
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.125);
        padding: 40px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }

    /* TYPOGRAPHY */
    h1, h2, h3, p, span, div {
        color: #ffffff !important; /* Force all text white */
        font-family: 'Inter', sans-serif;
    }

    .main-title {
        font-size: 3.5rem;
        font-weight: 800;
        background: -webkit-linear-gradient(#4facfe, #00f2fe);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }

    .creator-badge {
        font-size: 1rem;
        color: #a0a0a0 !important;
        font-weight: 500;
        margin-bottom: 1.5rem;
        letter-spacing: 1px;
    }

    /* INPUT FIELD STYLING (High Contrast) */
    .stTextInput > div > div > input {
        background-color: #ffffff; /* White background */
        color: #000000 !important; /* Black text */
        border-radius: 8px;
        border: none;
        padding: 12px;
    }

    /* BUTTON STYLING */
    .stButton > button {
        width: 100%;
        background: linear-gradient(90deg, #0061ff 0%, #60efff 100%);
        color: #000000 !important;
        font-weight: 700;
        border: none;
        padding: 0.75rem;
        border-radius: 8px;
        transition: all 0.3s ease;
    }
    .stButton > button:hover {
        transform: scale(1.02);
        box-shadow: 0 0 15px rgba(0, 242, 254, 0.5);
    }

    /* HIDE STREAMLIT BRANDING */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# --- 3. UI LAYOUT ---
col1, col2, col3 = st.columns([1, 6, 1])

with col2:
    # DARK GLASS CONTAINER START
    st.markdown('<div class="glass-container">', unsafe_allow_html=True)
    
    st.markdown('<h1 class="main-title">NEXUS AGENT</h1>', unsafe_allow_html=True)
    st.markdown('<div class="creator-badge">⚡ CREATED BY GANESH | POWERED BY GEMINI 2.5</div>', unsafe_allow_html=True)
    
    st.markdown("""
    <p style='font-size: 1.1rem; opacity: 0.9;'>
        <b>Enterprise DevSecOps Scanner.</b><br>
        Enter a GitHub repository URL below to initiate an autonomous vulnerability audit.
    </p>
    """, unsafe_allow_html=True)

    with st.form("scan_form"):
        repo_url = st.text_input("Target Repository URL", placeholder="https://github.com/we45/Vulnerable-Flask-App")
        st.write("") # Spacer
        
        c1, c2 = st.columns([2, 1])
        with c2:
            scan_btn = st.form_submit_button("🚀 INITIALIZE SCAN")

    st.markdown('</div>', unsafe_allow_html=True)
    # GLASS CONTAINER END

# --- 4. SECRETS & SETUP ---
api_key = None
if "GEMINI_API_KEY" in st.secrets:
    api_key = st.secrets["GEMINI_API_KEY"]
if "GITHUB_TOKEN" in st.secrets:
    os.environ["GITHUB_TOKEN"] = st.secrets["GITHUB_TOKEN"]

if api_key:
    genai.configure(api_key=api_key)

# --- 5. LOGIC & AI CORE ---
if scan_btn and repo_url:
    if not api_key:
        st.error("❌ System Error: API Key missing in Secrets.")
        st.stop()
        
    st.markdown("---")
    
    with st.status("🕵️ **Nexus is investigating target...**", expanded=True) as status:
        
        # STEP 1: SCAN
        st.write("📡 Establishing secure connection to GitHub...")
        scan_data = nexus_agent_logic.scan_repo_manifest(repo_url)
        
        # DEBUG (Hidden by default)
        with st.expander("🛠️ View Raw Diagnostic Data", expanded=False):
            st.code(scan_data, language='json')
            
        st.write("🧠 Cross-referencing dependencies with CVE Database...")
        
        # STEP 2: REASONING (Fixed Model Selection)
        try:
            # FORCE GEMINI 1.5 FLASH (Most Reliable Model)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt = f"""
            You are Nexus, an elite DevSecOps AI.
            Analyze this repository scan: {scan_data}
            
            Task:
            1. Identify critical vulnerabilities in the dependencies.
            2. Explain *why* they are dangerous (RCE, XSS, etc.).
            3. Provide exact 'pip install' remediation commands.
            4. Output a professional HTML report using Tailwind CSS. 
            5. Use a 'Light Mode' clean corporate style for the report HTML.
            """
            
            response = model.generate_content(prompt)
            report_html = response.text
            
            # Clean Markdown
            if "```html" in report_html:
                report_html = report_html.replace("```html", "").replace("```", "")
            
            status.update(label="✅ **Mission Complete. Threat Level Calculated.**", state="complete", expanded=False)
            
        except Exception as e:
            st.error(f"AI Core Malfunction: {e}")
            # Fallback for debugging
            st.warning("Ensure 'gemini-1.5-flash' is supported by your API key.")
            st.stop()

    # DISPLAY REPORT
    st.markdown("### 📊 Final Audit Report")
    st.components.v1.html(report_html, height=800, scrolling=True)
