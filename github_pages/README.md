# Tally Copilot – Web Testing Console (GitHub Pages)

This directory contains the static, zero-dependency web frontend for the **Tally Copilot Live Testing Console**. It is built with vanilla HTML5, CSS3, and modern JavaScript, designed to be hosted directly on **GitHub Pages**.

---

## 🚀 Quick Deployment Guide

### Option 1: Host from the Repository (Recommended)
1. Push this entire repository to GitHub.
2. In your repository settings, go to **Settings** &gt; **Pages**:
   * **Source**: `Deploy from a branch`
   * **Branch**: `main`
   * **Folder**: `/github_pages`
   * Click **Save**.
3. In ~60 seconds, GitHub will publish your live website URL:  
   `https://<your-username>.github.io/<repo-name>/`

### Option 2: Deploy as a Standalone Branch
If you only want this folder on your `gh-pages` branch:
```bash
git subtree push --prefix github_pages origin gh-pages
```

---

## 🔌 Connecting to the Backend

The web console supports three connection modes:

1. **Automatic URL Parameter (`?backend=...`):**  
   When using the 1-click companion launcher (`1-Click-Run.bat` or `TallyCopilotCompanion.exe`), the browser is opened with the secure HTTPS tunnel URL pre-filled in the query string:
   ```text
   https://<your-username>.github.io/<repo-name>/?backend=https://xxxx.trycloudflare.com
   ```
   The application auto-connects instantly without the tester having to type or copy anything.

2. **Manual Backend URL:**  
   You can manually type or paste any reachable HTTPS tunnel URL or `http://localhost:8000` into the top connection bar and click **Connect & Ping**. The URL is saved in `localStorage`.

3. **"📁 Upload Tally XML" (No Backend Setup):**  
   If the tester cannot run a local backend, they can export their Day Book from TallyPrime (`Alt + E` &gt; `XML`), click **📁 Upload Tally XML**, and immediately load their live financial snapshot into Copilot.

---

## 🛠️ Testing Features in the Console

* **📊 Cash Runway:** Displays live cash balance, receivables, payables, and 7d/14d/30d Monte Carlo safe cash forecasts.
* **🔮 Predictions & Invoices:** Interactive table of open customer bills with predicted payment dates, 14-day probabilities, and risk tiers (*Prompt*, *Mild Delay*, *Deteriorating Delay*, *Critical Risk*). Each row has an inline **"⚠️ Discrepancy"** button.
* **🎯 Dynamic Priority:** Ranks debtors by collection urgency score and suggests message tones (*Friendly*, *Professional*, *Firm*).
* **💬 WhatsApp Dispatch & Tracking:** Live message preview and text editor.
  * **"🟢 Send via WhatsApp Web"**: Opens `https://wa.me/<phone>` click-to-chat directly and logs status as `pushed_whatsapp_web`.
  * **"🔵 Mark as Pushed"**: Confirms dispatch via mobile or CRM.
  * **"⚪ Skip"**: Records dismissal.
* **⚡ Live Auto-Sync:** Checkbox on the top bar to silently poll Tally every 30 seconds for new vouchers.
* **📑 Final Audit Report:** Live scorecard of session metrics and 1-click download buttons for `tally_copilot_verification_report.json` and human-readable `.txt`.

---

## 💻 Local Offline Testing

To test this frontend locally without deploying to GitHub:

```bash
cd github_pages
python -m http.server 8080
```
Then open `http://localhost:8080` in your web browser.
