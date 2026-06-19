import re
import html
import logging
from datetime import datetime
from flask import Flask, jsonify, render_template, request
import feedparser
import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for parsed release notes
cache = {
    "data": None,
    "last_fetched": None
}

def clean_html_to_text(html_content):
    if not html_content:
        return ""
    
    def replace_link(match):
        href = match.group(1)
        text = match.group(2)
        # Clean up inner tags (like <code>) inside link text
        text = re.sub(r'<[^>]+>', '', text)
        # Resolve relative URLs
        if href.startswith('/'):
            href = 'https://cloud.google.com' + href
        return f"{text} ({href})"
    
    # Format links to contain URL in parenthesis next to the link text
    text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', replace_link, html_content)
    
    # Format paragraph tags as newlines
    text = re.sub(r'<p[^>]*>', '\n', text)
    text = re.sub(r'</p>', '\n', text)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<li[^>]*>', '\n- ', text)
    text = re.sub(r'</li>', '', text)
    text = re.sub(r'</?[a-zA-Z0-9]+[^>]*>', '', text)  # strip all remaining tags
    
    # Unescape HTML entities
    text = html.unescape(text)
    
    # Clean up whitespace and empty lines
    lines = [line.strip() for line in text.split('\n')]
    return '\n'.join([l for l in lines if l])

def parse_entry(entry):
    summary_html = entry.get("summary", "")
    # Split content by <h3> headers to segment separate updates within the same day
    parts = re.split(r'<h3>(.*?)</h3>', summary_html)
    
    items = []
    date_str = entry.get("title", "")
    iso_date = entry.get("updated", "")
    base_link = entry.get("link", "")
    entry_id = entry.get("id", "")
    
    if len(parts) > 1:
        # Loop through matched headers and subsequent content block
        for i in range(1, len(parts), 2):
            update_type = parts[i].strip()
            content_html = parts[i+1].strip() if i+1 < len(parts) else ""
            content_text = clean_html_to_text(content_html)
            
            # Generate a unique stable ID for this sub-item
            item_idx = i // 2
            item_id = f"{entry_id}#item-{item_idx}"
            
            # Build specific link if there is a tag anchor in the feed ID or title
            anchor = date_str.replace(" ", "_").replace(",", "")
            item_link = f"https://docs.cloud.google.com/bigquery/docs/release-notes#{anchor}"
            
            items.append({
                "id": item_id,
                "date": date_str,
                "iso_date": iso_date,
                "type": update_type,
                "content_html": content_html,
                "content_text": content_text,
                "link": item_link
            })
    else:
        # Fallback if no <h3> tags exist in this release note
        content_html = summary_html.strip()
        content_text = clean_html_to_text(content_html)
        items.append({
            "id": f"{entry_id}#item-0",
            "date": date_str,
            "iso_date": iso_date,
            "type": "Update",
            "content_html": content_html,
            "content_text": content_text,
            "link": base_link
        })
    return items

def fetch_and_parse_feed():
    try:
        logger.info(f"Fetching release notes feed from {FEED_URL}")
        # Fetch xml feed over HTTP with a reasonable timeout
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse XML Atom feed
        feed = feedparser.parse(response.content)
        
        all_items = []
        for entry in feed.entries:
            all_items.extend(parse_entry(entry))
            
        logger.info(f"Successfully parsed {len(all_items)} release items.")
        return all_items
    except Exception as e:
        logger.error(f"Error fetching feed: {str(e)}")
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    global cache
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if cache["data"] is None or force_refresh:
        try:
            cache["data"] = fetch_and_parse_feed()
            cache["last_fetched"] = datetime.now().isoformat()
        except Exception as e:
            logger.error(f"Failed to refresh feed: {str(e)}")
            if cache["data"] is not None:
                # Return cached stale data but indicate error
                return jsonify({
                    "status": "warning",
                    "error": str(e),
                    "last_fetched": cache["last_fetched"],
                    "updates": cache["data"]
                }), 200
            return jsonify({
                "status": "error",
                "error": f"Failed to fetch release notes: {str(e)}"
            }), 500
            
    return jsonify({
        "status": "success",
        "last_fetched": cache["last_fetched"],
        "updates": cache["data"]
    })

if __name__ == '__main__':
    logger.info("Starting Flask application...")
    app.run(debug=True, host='127.0.0.1', port=5000)
