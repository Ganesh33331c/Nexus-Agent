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

# --- 2. CUSTOM CSS (Colorful Animation & Glass UI) ---
st.markdown("""
<style>
    /* IMPORT FONT */
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');

    /* BACKGROUND: Colorful Animated Gradient (Restored) */
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
        width: 130px;
        height: 130px;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        font-size: 65px;
        animation: float 6s ease-in-out infinite;
    }
    
    @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
    }

    /* TITLE STYLING */
    .agent-title {
        font-size: 3.2rem;
        font-weight: 800;
        margin-bottom: 0px;
        letter-spacing: 1px;
    }

    .agent-subtitle {
        font-size: 1.1rem;
        font-weight: 600;
        opacity: 0.95;
        margin-bottom: 40px;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    /* INPUT FIELD: Frost Glass (Visible & Beautiful) */
    .stTextInput > div > div > input {
        background-color: rgba(255, 255, 255, 0.25); /* Semi-transparent White */
        border: 2px solid rgba(255, 255, 255, 0.5);
        color: #ffffff !important;
        border-radius: 15px;
        padding: 25px 20px;
        font-size: 18px;
        text-align: center;
        backdrop-filter: blur(10px);
        transition: all 0.3s ease;
    }
    
    .stTextInput > div > div > input::placeholder {
        color: rgba(255, 255, 255, 0.8);
    }
    
    .stTextInput > div > div > input:focus {
        background-color: rgba(255, 255, 255, 0.35);
        border-color: #ffffff;
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
    }

    /* BUTTON: Vibrant Gradient (Not Black!) */
    .stButton > button {
        width: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); /* Purple-Blue */
        color: white !important;
        font-weight: 800;
        border-radius: 15px;
        padding: 15px 30px;
        border: none;
        box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        font-size: 1.2rem;
        margin-top: 10px;
        letter-spacing: 1px;
    }
    
    .stButton > button:hover {
        transform: translateY(-3px);
        box-shadow: 0 15px 30px rgba(0,0,0,0.3);
        background: linear-gradient(90deg, #764ba2 0%, #667eea 100%); /* Reverse gradient */
    }
    
    /* Hide Default UI */
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

# TITLE (Full Name)
st.markdown('<h1 class="agent-title">NEXUS DEVSECOPS AGENT</h1>', unsafe_allow_html=True)
st.markdown('<div class="agent-subtitle">Autonomous Security Auditor • Built by Ganesh</div>', unsafe_allow_html=True)

# INPUT FORM
with st.form("scan_form"):
    repo_url = st.text_input("TARGET REPOSITORY", placeholder="Paste GitHub URL here...")
    st.write("") # Spacer
    
    c1, c2, c3 = st.columns([1, 4, 1])
    with c2:
        scan_btn = st.form_submit_button("🚀 START SECURITY AUDIT")

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
        
        # DEBUG
        with st.expander("Show Diagnostic Data", expanded=False):
            st.code(scan_data, language='json')
            
        st.write("🛡️ Cross-referencing CVE Database...")
        
        # --- 🔍 SMART MODEL FINDER (FIXES 404 ERROR) ---
        try:
            # 1. Ask Google: "What models do I have?"
            all_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            
            # 2. Pick the best one intelligently
            # Priority: 1.5-Flash -> 1.5-Pro -> Pro -> First Available
            if any('gemini-1.5-flash' in m for m in all_models):
                model_name = 'models/gemini-1.5-flash'
            elif any('gemini-1.5-pro' in m for m in all_models):
                model_name = 'models/gemini-1.5-pro'
            elif any('gemini-pro' in m for m in all_models):
                model_name = 'models/gemini-pro'
            else:
                model_name = all_models[0] # Just take the first one that works
            
            # st.write(f"DEBUG: Using Model: {model_name}") # Uncomment to see which model picked
            model = genai.GenerativeModel(model_name)
            
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
            
            response = model.generate_content(prompt)
            report_html = response.text
            
            if "```html" in report_html:
                report_html = report_html.replace("```html", "").replace("```", "")
            
            status.update(label="✅ **AUDIT COMPLETE**", state="complete", expanded=False)
            
        except Exception as e:
            st.error(f"AI Engine Critical Failure: {e}")
            st.stop()

    # DISPLAY REPORT
    st.markdown("### 📊 VULNERABILITY REPORT")
    st.components.v1.html(report_html, height=800, scrolling=True)
