import requests
import json
import os

def scan_repo_manifest(repo_url):
    """
    Nexus Agent Tool: Scan Repository Manifest
    
    Arguments:
    repo_url (str): The full GitHub URL (e.g., https://github.com/user/repo)
    
    Returns:
    str: A JSON formatted report of critical files and dependencies.
    """
    
    # 1. Sanitize URL to get "owner/repo"
    # Removes trailing .git and splits the URL to find the user and repo name
    try:
        clean_url = repo_url.rstrip(".git").split("github.com/")[-1]
    except IndexError:
        return json.dumps({"error": "Invalid GitHub URL format. Use https://github.com/owner/repo"})

    api_base = f"https://api.github.com/repos/{clean_url}/contents"
    
    report = {
        "target": clean_url,
        "critical_files_found": [],
        "dependencies": [],
        "scan_status": "Success"
    }

    # 2. List files via GitHub API (Fast & Lightweight)
    # This avoids cloning the entire repo, preventing 504 Timeouts.
    try:
        # Check if we have a token in env for higher rate limits (optional but good practice)
        headers = {}
        if os.environ.get('GITHUB_TOKEN'):
            headers['Authorization'] = f"token {os.environ.get('GITHUB_TOKEN')}"

        resp = requests.get(api_base, headers=headers, timeout=10)
        
        if resp.status_code == 404:
            return json.dumps({"error": "Repository not found or private."})
        elif resp.status_code != 200:
            return json.dumps({"error": f"API Error: {resp.status_code}"})
        
        files = resp.json()
        
        # 3. Hunt for 'requirements.txt' or 'package.json'
        for f in files:
            name = f['name']
            if name in ["requirements.txt", "package.json", "Pipfile", "setup.py"]:
                report["critical_files_found"].append(name)
            
            # If we find requirements.txt, fetch its content immediately
            if name == "requirements.txt":
                req_resp = requests.get(f['download_url'], timeout=10)
                # Split into lines, strip whitespace, and filter empty lines
                deps = [line.strip() for line in req_resp.text.split('\n') if line.strip() and not line.startswith('#')]
                report["dependencies"] = deps

    except Exception as e:
        return json.dumps({"error": f"Internal Agent Error: {str(e)}"})

    return json.dumps(report, indent=2)

# --- Test Execution (runs only if file is executed directly) ---
if __name__ == "__main__":
    # Test with the vulnerable repo
    test_url = "https://github.com/we45/Vulnerable-Flask-App.git"
    print(f"Running Nexus Scan on {test_url}...\n")
    print(scan_repo_manifest(test_url))