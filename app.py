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

# --- 2. CUSTOM CSS (The "Aurora Glass" Look) ---
st.markdown("""
<style>
    /* IMPORT GOOGLE FONTS */
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');

    /* BACKGROUND IMAGE & GRADIENT */
    .stApp {
        background: url("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop");
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
    }

    /* GLASSMORPHISM CARD (The Main Container) */
    .glass-container {
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 3rem;
        margin-bottom: 2rem;
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    }

    /* TITLE STYLING */
    .main-title {
        font-family: 'Poppins', sans-serif;
        font-size: 3.5rem;
        font-weight: 800;
        color: #ffffff;
        text-shadow: 0 4px 10px rgba(0,0,0,0.3);
        line-height: 1.2;
        margin-bottom: 0.5rem;
    }

    /* "BUILT BY" BADGE */
    .creator-badge {
        display: inline-block;
        background: linear-gradient(90deg, #00C9FF 0%, #92FE9D 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-family: 'Poppins', sans-serif;
        font-size: 1.2rem;
        font-weight: 700;
        letter-spacing: 1px;
        margin-bottom: 2rem;
        border: 2px solid #00C9FF;
        padding: 5px 15px;
        border-radius: 50px;
    }

    /* INPUT FIELD STYLING */
    .stTextInput>div>div>input {
        background-color: rgba(255, 255, 255, 0.9);
        color: #1a1a1a;
        border-radius: 12px;
        border: none;
        padding: 15px;
        font-size: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    /* BUTTON STYLING (Gradient) */
    .stButton>button {
        width: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.8rem 2rem;
        border-radius: 12px;
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
        font-size: 1.1rem;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .stButton>button:hover {
        transform: scale(1.02);
        box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }

    /* HIDE DEFAULT STREAMLIT MENU */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
</style>
""", unsafe_allow_html=True)

# --- 3. UI LAYOUT ---

# Centered Layout using Columns
col1, col2, col3 = st.columns([1, 6, 1])

with col2:
    # START GLASS CONTAINER
    st.markdown('<div class="glass-container">', unsafe_allow_html=True)
    
    # Title Section
    st.markdown('<h1 class="main-title">NEXUS AGENT</h1>', unsafe_allow_html=True)
    st.markdown('<div class="creator-badge">⚡ Created by Ganesh | Powered by Gemini 2.5</div>', unsafe_allow_html=True)
    
    st.markdown("""
    <p style='color: #f0f0f0; font-size: 1.1rem; margin-bottom: 2rem;'>
        <b>Enterprise DevSecOps Scanner.</b> Enter a GitHub repository URL below to initiate an autonomous vulnerability audit.
    </p>
    """, unsafe_allow_html=True)

    # Input Form
    with st.form("scan_form"):
        repo_url = st.text_input(
            "Target Repository URL", 
            placeholder="https://github.com/we45/Vulnerable-Flask-App"
        )
        
        st.markdown("<br>", unsafe_allow_html=True) # Spacer
        
        submit_col1, submit_col2 = st.columns([1, 1])
        with submit_col2:
            scan_btn = st.form_submit_button("🚀 Launch Security Audit")

    st.markdown('</div>', unsafe_allow_html=True)
    # END GLASS CONTAINER

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
        st.error("❌ System Error: API Key missing in Secrets.")
        st.stop()
        
    # Results Area (Outside the glass card for cleanliness)
    st.markdown("---")
    
    with st.status("🕵️ **Nexus is investigating target...**", expanded=True) as status:
        
        # STEP 1: SCAN
        st.write("📡 Establishing secure connection to GitHub...")
        scan_data = nexus_agent_logic.scan_repo_manifest(repo_url)
        
        # DEBUG (Hidden)
        with st.expander("🛠️ View Raw Diagnostic Data", expanded=False):
            st.code(scan_data, language='json')
            
        st.write("🧠 Cross-referencing dependencies with CVE Database...")
        
        # STEP 2: REASONING
        try:
            # Model Auto-Select
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            if 'models/gemini-1.5-flash' in available_models:
                model_name = 'gemini-1.5-flash'
            else:
                model_name = 'gemini-pro'
            
            model = genai.GenerativeModel(model_name)
            
            prompt = f"""
            You are Nexus, an elite DevSecOps AI built by Ganesh.
            Analyze this repository scan: {scan_data}
            
            Task:
            1. Identify critical vulnerabilities in the dependencies.
            2. Explain *why* they are dangerous.
            3. Provide exact 'pip install' remediation commands.
            4. Output a professional HTML report using Tailwind CSS. 
            5. Use a 'Light Mode' clean corporate style for the report.
            """
            
            response = model.generate_content(prompt)
            report_html = response.text
            
            if "```html" in report_html:
                report_html = report_html.replace("```html", "").replace("```", "")
            
            status.update(label="✅ **Mission Complete. Report Generated.**", state="complete", expanded=False)
            
        except Exception as e:
            st.error(f"AI Core Malfunction: {e}")
            st.stop()

    # DISPLAY REPORT
    st.markdown("### 📊 Final Audit Report")
    st.components.v1.html(report_html, height=800, scrolling=True)
