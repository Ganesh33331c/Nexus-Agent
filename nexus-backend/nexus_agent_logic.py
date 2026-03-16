import os
import json
import requests
import tempfile
import shutil
import re
from git import Repo # Make sure GitPython is in requirements.txt
import google.generativeai as genai
from pydantic import BaseModel, Field
from typing import List

# ─── 1. STRICT JSON SCHEMAS (PYDANTIC) ───
class Vulnerability(BaseModel):
    title: str = Field(description="The name of the vulnerability")
    severity: str = Field(description="Must be exactly: Critical, High, Medium, or Low")
    file_path: str = Field(description="The file where the vulnerability was found")
    poc: str = Field(description="Proof of concept or code snippet showing the flaw")
    remediation: str = Field(description="Actionable steps or code to fix the issue")

class ScanReport(BaseModel):
    scan_status: str = Field(description="Overall status, e.g., 'Completed', 'Failed'")
    critical_count: int = Field(description="Total number of critical/high vulnerabilities")
    vulnerabilities: List[Vulnerability]


# ─── 2. REPOSITORY CLONING ───
def clone_repository(repo_url):
    """Clones the repository to a temporary directory for SAST scanning."""
    temp_dir = tempfile.mkdtemp()
    try:
        Repo.clone_from(repo_url, temp_dir)
        return temp_dir
    except Exception as e:
        return None

def cleanup(repo_path):
    """Deletes the temporary repository files after scanning."""
    if repo_path and os.path.exists(repo_path):
        shutil.rmtree(repo_path, ignore_errors=True)


# ─── 3. SAST SCANNER (Regex Engine) ───
def run_sast(repo_path):
    """Scans local cloned files for hardcoded secrets and bad practices."""
    if not repo_path:
        return "SAST Scan Failed: Repository not cloned."
    
    findings = []
    # Common dangerous patterns (e.g., disabled SSL, exposed keys)
    patterns = {
        "Disabled SSL Verification": r"verify\s*=\s*False",
        "Hardcoded Secret Key": r"SECRET_KEY\s*=\s*['\"][a-zA-Z0-9_]+['\"]",
        "Debug Mode Enabled": r"debug\s*=\s*True",
        "Exposed API Key": r"api_key\s*=\s*['\"][a-zA-Z0-9_\-]+['\"]"
    }

    for root, dirs, files in os.walk(repo_path):
        # Ignore .git folder
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if file.endswith('.py') or file.endswith('.js') or file.endswith('.env'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            for vulnerability, regex in patterns.items():
                                if re.search(regex, line):
                                    relative_path = os.path.relpath(file_path, repo_path)
                                    findings.append(f"[{vulnerability}] Found in {relative_path} on line {i+1}: {line.strip()}")
                except Exception:
                    continue
                    
    return json.dumps(findings) if findings else "No SAST vulnerabilities found."


# ─── 4. SCA SCANNER (Your Deep Scan Logic) ───
def run_sca(repo_url):
    """
    Nexus Agent Tool: Smart Deep Scan via GitHub API
    """
    try:
        clean_url = repo_url.rstrip("/").rstrip(".git").split("github.com/")[-1]
    except:
        return json.dumps({"error": "Invalid URL format."})

    api_base = f"https://api.github.com/repos/{clean_url}/contents"
    
    headers = {"Accept": "application/vnd.github.v3+json"}
    token = os.environ.get('GITHUB_TOKEN')
    
    if token:
        headers['Authorization'] = f"token {token}"

    report = {
        "target": clean_url,
        "critical_files_found": [],
        "dependencies": [],
        "scan_status": "Success", 
        "debug_log": [] 
    }

    def fetch_file_content(download_url):
        try:
            resp = requests.get(download_url, headers=headers, timeout=10)
            return [line.strip() for line in resp.text.split('\n') if line.strip() and not line.startswith('#')]
        except:
            return []

    try:
        resp = requests.get(api_base, headers=headers, timeout=10)
        if resp.status_code != 200:
            return json.dumps({"error": f"GitHub API Error: {resp.status_code}"})
        
        root_files = resp.json()
        report["debug_log"].append(f"Scanned Root: Found {len(root_files)} files")
        
        found_manifest = False
        for f in root_files:
            if f['name'] == "requirements.txt":
                report["critical_files_found"].append("requirements.txt (Root)")
                report["dependencies"] = fetch_file_content(f['download_url'])
                found_manifest = True
                break
        
        if not found_manifest:
            report["debug_log"].append("Manifest not found in root. Scanning subfolders...")
            subfolders = [f for f in root_files if f['type'] == 'dir']
            
            for folder in subfolders:
                folder_url = f"{api_base}/{folder['name']}"
                sub_resp = requests.get(folder_url, headers=headers, timeout=10)
                
                if sub_resp.status_code == 200:
                    sub_files = sub_resp.json()
                    for sub_f in sub_files:
                        if sub_f['name'] == "requirements.txt":
                            report["critical_files_found"].append(f"requirements.txt ({folder['name']}/)")
                            report["dependencies"] = fetch_file_content(sub_f['download_url'])
                            found_manifest = True
                            break
                if found_manifest:
                    break

    except Exception as e:
        return json.dumps({"error": f"Crash: {str(e)}"})

    return json.dumps(report, indent=2)


# ─── 5. DETERMINISTIC AI ANALYSIS ENGINE ───
def analyze_with_ai(sast_results, sca_results, repo_url):
    """Feeds scan data to Gemini and forces a strict JSON Pydantic return."""
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
    
    # Initialize the model with STRICT parameters
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.0, # Zero creativity, purely deterministic
            response_mime_type="application/json",
            response_schema=ScanReport # Force adherence to our Pydantic schema
        )
    )

    prompt = f"""
    You are an expert DevSecOps AI Agent. Analyze the following security scan results for the repository: {repo_url}
    
    === SAST RESULTS (Code Flaws) ===
    {sast_results}
    
    === SCA RESULTS (Dependency Flaws) ===
    {sca_results}
    
    Task: Extract all vulnerabilities. Combine identical vulnerabilities into a single entry if they occur in the same file or module. 
    Count the total number of Critical and High vulnerabilities for the 'critical_count' field.
    Return the final output STRICTLY matching the requested JSON schema. Do not include markdown formatting.
    """
    
    try:
        response = model.generate_content(prompt)
        # Convert the guaranteed JSON string into a Python dictionary
        return json.loads(response.text)
    except Exception as e:
        # Fallback error JSON if AI fails
        return {
            "scan_status": f"AI Engine Failed: {str(e)}",
            "critical_count": 0,
            "vulnerabilities": []
        }
