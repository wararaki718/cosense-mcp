"""
Ragas RAG評価スクリプト

Cosense/Scrapbox RAGシステムの出力品質を評価します
評価項目:
  - Faithfulness: 生成回答がコンテキストに基づいているか
  - Answer Relevancy: 回答が質問に関連しているか
  - Context Relevancy: 検索コンテキストが質問に関連しているか
  - Context Precision: 検索コンテキストの精度

使用方法:
  python -m evaluate.run --dataset evaluate/datasets/test_dataset.json
  python -m evaluate.run --dataset evaluate/datasets/test_dataset.json --output results.json
"""

import os
import json
import argparse
import logging
import sys
from typing import Optional
from pathlib import Path

import dotenv
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from ragas import evaluate
from datasets import Dataset

# インポートパスの解決
import sys
from pathlib import Path
current_dir = Path(__file__).parent.absolute()
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

try:
    from config import EVALUATION_METRICS, LLM_MODEL, EMBEDDINGS_MODEL
except ImportError as e:
    logger.error(f"Failed to import config: {e}")
    # フォールバック（念のため）
    try:
        from .config import EVALUATION_METRICS, LLM_MODEL, EMBEDDINGS_MODEL
    except (ImportError, ValueError):
        from evaluate.config import EVALUATION_METRICS, LLM_MODEL, EMBEDDINGS_MODEL

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 環境変数の読み込み
dotenv.load_dotenv()


def load_test_dataset(dataset_path: str) -> dict:
    """
    テストデータセットをJSONファイルから読み込みます
    
    Args:
        dataset_path: テストデータセットのファイルパス
        
    Returns:
        データセット辞書
        
    Raises:
        FileNotFoundError: ファイルが見つからない場合
        json.JSONDecodeError: JSONのデコードエラー
    """
    path = Path(dataset_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")
    
    logger.info(f"Loading dataset from {dataset_path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        dataset_dict = json.load(f)
    
    # データセットの検証
    required_keys = {'questions', 'ground_truths', 'contexts', 'answer'}
    if not all(key in dataset_dict for key in required_keys):
        raise ValueError(
            f"Dataset must contain keys: {required_keys}. "
            f"Found: {set(dataset_dict.keys())}"
        )
    
    logger.info(f"Loaded dataset with {len(dataset_dict['questions'])} samples")
    return dataset_dict


def prepare_ragas_dataset(dataset_dict: dict) -> Dataset:
    """
    Ragas評価用のデータセットを準備します
    """
    # データセット構造の確認と変換
    samples = []
    
    for i in range(len(dataset_dict['questions'])):
        g_truth = dataset_dict['ground_truths'][i] if 'ground_truths' in dataset_dict else dataset_dict['ground_truth'][i]
        
        sample = {
            'question': dataset_dict['questions'][i],
            'ground_truth': g_truth,
            'contexts': [dataset_dict['contexts'][i]]
                if isinstance(dataset_dict['contexts'][i], str)
                else dataset_dict['contexts'][i],
            'answer': dataset_dict['answer'][i],
        }
        samples.append(sample)
    
    dataset = Dataset.from_dict({
        'question': [s['question'] for s in samples],
        'ground_truth': [s['ground_truth'] for s in samples],
        'contexts': [s['contexts'] for s in samples],
        'answer': [s['answer'] for s in samples],
    })
    
    logger.info(f"Prepared Ragas dataset with {len(dataset)} samples")
    return dataset


def initialize_models():
    """
    評価用のLLMとEmbeddingsを初期化します
    """
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable not set. "
            "Please configure it in .env file."
        )
    
    logger.info(f"Initializing LLM: {LLM_MODEL}")
    llm = ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        api_key=api_key,
    )
    
    logger.info(f"Initializing Embeddings: {EMBEDDINGS_MODEL}")
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBEDDINGS_MODEL,
        google_api_key=api_key,
    )
    
    return llm, embeddings


def evaluate_rag_system(
    dataset: Dataset,
    llm: ChatGoogleGenerativeAI,
    embeddings: GoogleGenerativeAIEmbeddings,
    output_path: Optional[str] = None,
) -> dict:
    """
    RAGシステムを評価します
    """
    logger.info("Starting RAG evaluation...")
    
    # Ragasで評価を実行
    results = evaluate(
        dataset=dataset,
        metrics=EVALUATION_METRICS,
        llm=llm,
        embeddings=embeddings,
    )
    
    logger.info("RAG evaluation completed")
    
    # 結果のサマリー
    summary = {
        'total_samples': len(dataset),
        'metrics': {},
    }
    
    # Resultオブジェクトまたは辞書からスコアを取得
    if hasattr(results, 'scores'):
        # Ragas 0.1.x Result object
        summary['details'] = results.to_dict()
        for metric_name, score in results.items():
            summary['metrics'][metric_name] = {
                'mean': score,
            }
    elif isinstance(results, dict):
        summary['details'] = results
        for metric_name, scores in results.items():
            if isinstance(scores, list):
                avg_score = sum(scores) / len(scores) if scores else 0
                summary['metrics'][metric_name] = {
                    'mean': avg_score,
                    'scores': scores,
                }
            else:
                summary['metrics'][metric_name] = {
                    'mean': scores,
                }
    
    # 結果をログ出力
    logger.info("Evaluation Results:")
    for metric_name, metric_data in summary['metrics'].items():
        logger.info(f"  {metric_name}: {metric_data['mean']:.4f}")
    
    # 結果をファイルに保存
    if output_path:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Results saved to {output_path}")
    
    return summary


def main():
    """メイン処理"""
    parser = argparse.ArgumentParser(
        description='Evaluate Cosense/Scrapbox RAG System using Ragas'
    )
    parser.add_argument(
        '--dataset',
        type=str,
        required=True,
        help='Path to test dataset JSON file',
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Path to save evaluation results (optional)',
    )
    
    args = parser.parse_args()
    
    try:
        # データセットの読み込み
        dataset_dict = load_test_dataset(args.dataset)
        
        # Ragas用データセットの準備
        dataset = prepare_ragas_dataset(dataset_dict)
        
        # モデルの初期化
        llm, embeddings = initialize_models()
        
        # RAG評価の実行
        results = evaluate_rag_system(dataset, llm, embeddings, args.output)
        
        # 標準出力に結果を表示
        print("\n" + "="*50)
        print("RAG Evaluation Results")
        print("="*50)
        print(json.dumps(results['metrics'], indent=2))
        
    except FileNotFoundError as e:
        logger.error(f"File error: {e}")
        sys.exit(1)
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
