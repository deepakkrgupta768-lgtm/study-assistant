from flask import Flask, request, jsonify, render_template
import requests
import os

app = Flask(__name__)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
API_URL = "https://models.inference.ai.azure.com"
DEFAULT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = (
    "You are an AI Study Assistant. Your role is to help students learn by:\n"
    "- Answering questions clearly and thoroughly\n"
    "- Explaining complex topics in simple terms\n"
    "- Providing examples and analogies\n"
    "- Asking follow-up questions to deepen understanding\n"
    "- Suggesting study resources and techniques\n"
    "- Being encouraging and supportive\n\n"
    "Keep responses educational, accurate, and age-appropriate."
)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/models", methods=["GET"])
def list_models():
    return jsonify({"models": [DEFAULT_MODEL]})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Message is required"}), 400

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    try:
        r = requests.post(
            f"{API_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )

        if r.status_code == 200:
            reply = r.json()["choices"][0]["message"]["content"]
            if reply.strip():
                return jsonify({"reply": reply.strip()})
            return jsonify({"error": "Empty response"}), 502

        err = r.json().get("error", {}).get("message", r.text)
        if "401" in str(r.status_code) or "token" in err.lower() or "auth" in err.lower():
            return jsonify({"error": "Invalid or missing GitHub token. Set the GITHUB_TOKEN environment variable."}), 502
        return jsonify({"error": err}), 502

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot connect to GitHub Models API. Check your internet connection."}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health():
    if not GITHUB_TOKEN:
        return jsonify({"status": "error", "message": "GITHUB_TOKEN not set"}), 502
    try:
        r = requests.get(
            f"{API_URL}/models",
            headers={"Authorization": f"Bearer {GITHUB_TOKEN}"},
            timeout=10,
        )
        if r.status_code == 200:
            return jsonify({"status": "ok", "api": "github-models"})
        return jsonify({"status": "error", "message": "GitHub Models API unreachable"}), 502
    except:
        return jsonify({"status": "error", "message": "GitHub Models API unreachable"}), 502

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Study Assistant running on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
