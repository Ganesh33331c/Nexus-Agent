import streamlit as st
import google.generativeai as genai
import nexus_agent_logic
import os

# --- 1. PAGE CONFIGURATION ---
st.set_page_config(
    page_title="Nexus DevSecOps Agent",
    page_icon="🛡️",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# --- 2. CUSTOM CSS (Button-Style Input) ---
st.markdown("""
<style>
    /* IMPORT FONT */
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');

    /* BACKGROUND: Colorful Animated Gradient */
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

    /* TYPOGRAPHY */
    h1, h2, h3, p, div, span {
        font-family: 'Outfit', sans-serif !important;
        color: #ffffff !important;
        text-align: center;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    /* LOGO STYLE */
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

    /* TITLE STYLING */
    .agent-title {
        font-size: 3.5rem;
        font-weight: 800;
        margin-bottom: 0px;
        letter-spacing: 1px;
    }

    .agent-subtitle {
        font-size: 1.2rem;
        font-weight: 600;
        opacity: 0.95;
        margin-bottom: 40px;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    /* --- ENTRY FIELD AS BUTTON (The Fix) --- */
    .stTextInput > div > div > input {
        background-color: #ffffff !important; /* Solid White */
        border: none;
        color: #1e293b !important; /* Dark Text */
        font-weight: 800; /* Bold Text */
        border-radius: 50px; /* Full Pill Shape */
        padding: 25px 0px; /* Tall clickable area */
        font-size: 20px;
        text-align: center; /* Center the text like a button */
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    }
    
    /* Hover Effect for Input */
    .stTextInput > div > div > input:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 35px rgba(0,0,0,0.3);
    }

    /* Focus Effect */
    .stTextInput > div > div > input:focus {
        border: 3px solid #3b82f6; /* Blue ring when typing */
        outline: none;
    }
    
    /* Placeholder Styling */
    .stTextInput > div > div > input::placeholder {
        color: #94a3b8;
        font-weight: 600;
    }

    /* SUBMIT BUTTON (Gradient Pill) */
    .stButton > button {
        width: 100%;
        background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%); /* Deep Violet */
        color: white !important;
        font-weight: 800;
        border-radius: 50px;
        padding: 18px 30px;
        border: none;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        font-size: 1.2rem;
        margin-top: 15px;
    }
    
    .stButton > button:hover {
        transform: scale(1.02);
        box-shadow: 0 15px 30px rgba(124, 58, 237, 0.4);
    }
    
    /* HIDE DEFAULT UI */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
</style>
""", unsafe_allow_html=True)

# --- 3. UI LAYOUT ---

# LOGO
st.markdown("""
<div class="logo-container">
    <div class="nexus-logo">
        🛡️
    </div>
</div>
""", unsafe_allow_html=True)

# FULL TITLE
st.markdown('<h1 class="agent-title">NEXUS DEVSECOPS AGENT</h1>', unsafe_allow_html=True)
st.markdown('<div class="agent-subtitle">Autonomous Security Auditor • Built by Ganesh</div>', unsafe_allow_html=True)

# INPUT FORM
with st.form("scan_form"):
    # This input now looks like a big white button
    repo_url = st.text_input("TARGET REPOSITORY", placeholder="Paste GitHub URL Here...")
    st.write("") # Spacer
    
    # Centered Button
    c1, c2, c3 = st.columns([1, 4, 1])
    with c2:
        scan_btn = st.form_submit_button("🚀 LAUNCH AUDIT")

# --- 4. SECRETS & SETUP ---
api_key = None
if "GEMINI_API_KEY" in st.secrets:
    api_key = st.secrets["GEMINI_API_KEY"]
if "GITHUB_TOKEN" in st.secrets:
    os.environ["GITHUB_TOKEN"] = st.secrets["GITHUB_TOKEN"]

if api_key:
    genai.configure(api_key=api_key)

# --- 5. EXECUTION LOGIC ---
if scan_btn and repo_url:
    if not api_key:
        st.error("❌ API Key Error: Please check Streamlit Secrets.")
        st.stop()
        
    st.markdown("<br>", unsafe_allow_html=True)
    
    with st.status("⚙️ **NEXUS CORE ACTIVE**", expanded=True) as status:
        
        st.write("📡 Scanning Repository Manifest...")
        scan_data = nexus_agent_logic.scan_repo_manifest(repo_url)
        
        # DEBUG (Hidden)
        with st.expander("Show Diagnostic Data", expanded=False):
            st.code(scan_data, language='json')
            
        st.write("🛡️ Cross-referencing CVE Database...")
        
        # --- 🔍 SELF-HEALING AI MODEL SELECTOR ---
        response = None
        used_model = None
        
        # Priority: 1.5-Flash (Fast) -> Pro (Stable) -> 1.0 (Legacy)
        models_to_try = [
            'gemini-1.5-flash',
            'gemini-pro',
            'gemini-1.5-pro-latest',
            'gemini-1.0-pro'
        ]
        
        for m_name in models_to_try:
            try:
                model = genai.GenerativeModel(m_name)
                
                prompt = f"""
                You are Nexus, a DevSecOps AI.
                Analyze this repository scan: {scan_data}
                
                Task:
                1. Identify critical vulnerabilities.
                2. Explain the risk (RCE, XSS, etc.).
                3. Provide remediation commands.
                4. Output a professional HTML report using Tailwind CSS. 
                5. Design the report to be clean, white, and corporate.
                """
                
                # Test generation
                response = model.generate_content(prompt)
                used_model = m_name
                break # Success!
            except Exception:
                continue # Try next model
        
        if response:
            report_html = response.text
            if "```html" in report_html:
                report_html = report_html.replace("```html", "").replace("```", "")
            
            status.update(label=f"✅ **AUDIT COMPLETE (Model: {used_model})**", state="complete", expanded=False)
            
            # DISPLAY REPORT
            st.markdown("### 📊 VULNERABILITY REPORT")
            st.components.v1.html(report_html, height=800, scrolling=True)
            
        else:
            st.error("❌ CRITICAL ERROR: All AI models failed.")
            st.info("💡 DID YOU UPDATE REQUIREMENTS.TXT? You must add 'google-generativeai>=0.7.0' to your requirements.txt file on GitHub.")
            st.stop()
