import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_API_KEY = "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"

@app.route('/api/chat', methods=['POST'])
def chat():
    if not GROQ_API_KEY:
        return jsonify({'error': 'GROQ_API_KEY not set in environment'}), 500
    data = request.get_json()
    messages = data.get('messages')
    model = data.get('model', 'llama3-8b-8192')
    payload = {
        'model': model,
        'messages': messages,
        'stream': False
    }
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    try:
        response = requests.post(GROQ_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.RequestException as e:
        return jsonify({'error': str(e), 'details': getattr(e.response, 'text', None)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003, debug=True)
