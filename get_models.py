import os
from google import genai

# クライアントの初期化
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# モデル一覧の取得
print("利用可能なモデル一覧:")
for model in client.models.list():
    print(f"- {model.name}")
