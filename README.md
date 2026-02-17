# 🛡️ Nexus: Proactive DevSecOps AI Agent

![Status](https://img.shields.io/badge/Status-Active-success)
![AI Model](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blue)
![Platform](https://img.shields.io/badge/Stack-Streamlit%20%7C%20Python-orange)
![License](https://img.shields.io/badge/License-MIT-green)

> **"Security shouldn't be a bottleneck. It should be autonomous."**

## 🚀 Overview

**Nexus** is an autonomous AI security engineer designed to bridge the gap between "Detection" and "Remediation."

Traditional DevSecOps pipelines are reactive—they flood developers with generic vulnerability tickets weeks after code is written. Nexus flips the script. It is an agentic system that **proactively audits** code repositories, **correlates** findings with live CVE intelligence, and **generates** instant, drop-in code patches.

This project was built as a **Capstone for the Google AI Agents Intensive**, demonstrating the use of Agentic Workflows, Custom Tooling, and the Gemini 2.5 Flash model.

## 📸 Demo & Screenshots

**[👉 Click Here to Try the Live Demo](https://nexus-agent.streamlit.app)**

### The Architecture
![Architecture Diagram](https://via.placeholder.com/800x400?text=Upload+Your+Architecture+Screenshot+Here)
*Nexus uses a multi-step reasoning loop: Fetch Manifest -> Scan Intelligence -> Correlate -> Generate Report.*

### The Output (Automated Remediation)
![Report Screenshot](https://via.placeholder.com/800x400?text=Upload+Screenshot+of+Nexus+Report+Here)
*Nexus generating a precise patch for a Flask SQL Injection vulnerability.*

## ✨ Key Capabilities

* **🕵️ Autonomous Auditing:** Bypasses standard context windows by using a custom Python tool (`nexus_agent_logic.py`) to surgically extract dependency manifests via the GitHub API.
* **🧠 Intelligent Correlation:** Uses **Google Gemini 2.5** to cross-reference raw version numbers (e.g., `Flask==0.12`) against a knowledge base of CVEs and Exploit-DB data.
* **🛠️ Instant Remediation:** Doesn't just find the bug—it writes the fix. The `RemediationAgent` generates JSON-formatted patches ready for implementation.
* **📊 Executive Reporting:** Outputs a fully responsive, Tailwind CSS-styled HTML dashboard for security teams.

## 🏗️ Technical Architecture

This project moves beyond simple "chatbots" by implementing a **Tool-Use Architecture**:

1.  **User Input:** Accepts a GitHub Repository URL.
2.  **Tool Execution:** The `Scan_Repo_Manifest` tool fires. Instead of cloning the massive repo (which causes timeouts), it hits the GitHub API to fetch only critical files (`requirements.txt`, `package.json`).
3.  **Reasoning Loop:**
    * *Intel Agent:* Identifies outdated packages.
    * *Context Agent:* Retrieves vulnerability data for those specific versions.
    * *Coder Agent:* Writes the remediation patch.
4.  **Final Generation:** Streamlit renders the structured output into a clean UI.

## 💻 Tech Stack

* **Orchestration:** Python 3.10
* **Frontend:** Streamlit Community Cloud
* **LLM Powerhouse:** Google Gemini 2.5 Flash (via `google-generativeai` SDK)
* **Security Tools:** Custom GitHub API Scanner, `python-dotenv` for secret management.

## ⚙️ Installation & Local Run

Want to run Nexus on your own machine?

**1. Clone the Repository**
```bash
git clone [https://github.com/YOUR_USERNAME/nexus-agent.git](https://github.com/YOUR_USERNAME/nexus-agent.git)
cd nexus-agent# Nexus
