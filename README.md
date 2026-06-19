# BigQuery Release Pulse

BigQuery Release Pulse is a modern local dashboard built with **Python Flask** (backend) and **Vanilla HTML, CSS, and JavaScript** (frontend). It fetches, parses, and cleans the official Google Cloud BigQuery release notes XML feed, presenting them in an interactive chronological stream. It includes a built-in character-aware **Tweet Composer** to customize and publish updates directly to X (formerly Twitter) with a single click.

---

## 🌟 Features

*   **Granular Timeline Feed**: Google consolidated release notes feeds often group multiple separate announcements under one date. This tracker splits them by subcategories (Features, Changes, Announcements, Issues, Deprecations) into separate cards.
*   **Search and Filters**: Filter updates by category badges or search via keywords across the release date, title, and body.
*   **In-Memory Server-Side Cache**: Fetches feed contents once and caches them to speed up subsequent requests. Allows manual bypass using a "Refresh" button with an animated spinner.
*   **Tweet Draft Composer**: 
    *   Generates structured drafts from selected cards using emojis, badges, and section anchors.
    *   Tracks character limits with a live **SVG Progress Ring** indicator.
    *   Allows adding/removing tags dynamically using click-to-toggle hashtags chips.
    *   Integrates with X Web Intent to post.
*   **Sleek Glassmorphic Design**: Responsive sidebar grid layout styled with custom dark/light modes and shimmering skeleton cards during initial API requests.

---

## 📂 Project Directory Structure

```text
├── .venv/                      # Python virtual environment (ignored in git)
├── templates/
│   └── index.html              # HTML templates
├── static/
│   ├── css/
│   │   └── style.css           # Premium dark/light stylesheets
│   └── js/
│       └── main.js             # Client-side routing, timers, and state logic
├── app.py                      # Flask server, cache manager, and HTML/XML parsers
├── requirements.txt            # Python dependency pins (Flask, requests, feedparser)
├── .gitignore                  # Git exclude directives
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Python 3.8+** installed on your system.

### 1. Installation & Environment Setup
Open a terminal in the project root directory and run the following commands:

*   **Initialize the Virtual Environment**:
    ```bash
    python -m venv .venv
    ```

*   **Activate the Environment**:
    *   *Windows PowerShell*:
        ```powershell
        .venv\Scripts\Activate.ps1
        ```
    *   *Windows Command Prompt*:
        ```cmd
        .venv\Scripts\activate.bat
        ```
    *   *macOS/Linux*:
        ```bash
        source .venv/bin/activate
        ```

*   **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

### 2. Start the Server
With your virtual environment active, launch the Flask backend:
```bash
python app.py
```

### 3. Open the Dashboard
Navigate to the local server URL in your browser:
🔗 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🛠️ Architecture & Flow Overview

```text
  [Browser UI] <---(JSON)--- [Flask API] <---(XML)--- [Google Cloud RSS]
        |                       |
(Select Card)           (Cache in Memory)
        |                       |
(Open Tweet Intent)     (Parse & Reformat HTML)
```

1.  **Ingestion & Parsing**: Flask fetches the raw XML Atom feed, matches heading patterns `<h3>(.*?)</h3>` using regex, and partitions data into categories. Relative anchor tags are transformed to absolute GCP URLs.
2.  **State & Filtering**: Client JavaScript caches responses in memory, applies tag selections, and renders dates dynamically as sticky headers.
3.  **Composing & Sharing**: Card selection fills the tweet template, runs length checks, and redirects to X Web Intents.
