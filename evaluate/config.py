"""
Ragas設定ファイル
RAG評価フレームワークの設定を集中管理します
"""

from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)

# 評価メトリクス
EVALUATION_METRICS = [
    faithfulness,           # 生成された回答が提供されたコンテキストに基づいているか
    answer_relevancy,       # 回答が質問に関連しているか
    context_precision,      # 検索されたコンテキストの適合率（正しい順序か）
    context_recall,         # 検索されたコンテキストの再現率（正解を含んでいるか）
]

# LLM設定
LLM_MODEL = "gemini-2.0-flash-lite" # 最新の軽量高速モデル
EMBEDDINGS_MODEL = "models/text-embedding-004"

# データセット設定
DATASET_CONFIG = {
    "description": "Cosense/Scrapbox RAG System Evaluation Dataset",
    "version": "1.0",
}
