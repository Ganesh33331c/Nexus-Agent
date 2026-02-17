import requests
import json

def scan_repo_manifest(repo_url):
    """
    Nexus Agent Tool: Public Repo Scanner (Unblocked)
    """
    
    # 1. Sanitize URL to get "owner/repo"
    try:
        clean_url = repo_url.rstrip(".git").split("github.com/")[-1]
    except IndexError:
        return json.dumps({"error": "Invalid GitHub URL format."})

    api_base = f"https://api.github.com/repos/{clean_url}/contents"
    
    report = {
        "target": clean_url,
        "critical_files_found": [],
        "dependencies": [],
        "scan_status": "Success"
    }

    # 2. THE FIX: Pretend to be a Browser (User-Agent)
    # This header prevents GitHub from blocking the script
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/vnd.github.v3+json"
    }

    # 3. List files via GitHub API
    try:
        # Note: We are NOT using the token here to avoid 403 errors. 
        # Public repos do not require tokens.
        resp = requests.get(api_base, headers=headers, timeout=10)
        
        if resp.status_code != 200:
            return json.dumps({"error": f"GitHub API Error: {resp.status_code} - {resp.text}"})
        
        files = resp.json()
        
        # 4. Hunt for 'requirements.txt'
        for f in files:
            name = f['name']
            if name in ["requirements.txt", "package.json", "Pipfile", "setup.py"]:
                report["critical_files_found"].append(name)
            
            # Fetch content of requirements.txt
            if name == "requirements.txt":
                # Use the raw download URL
                download_url = f['download_url']
                req_resp = requests.get(download_url, headers=headers, timeout=10)
                
                # Split into lines and clean up
                deps = [line.strip() for line in req_resp.text.split('\n') if line.strip() and not line.startswith('#')]
                report["dependencies"] = deps

    except Exception as e:
        return json.dumps({"error": f"Internal Agent Error: {str(e)}"})

    return json.dumps(report, indent=2)
