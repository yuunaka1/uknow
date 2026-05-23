import { useState, useEffect } from 'react';
import { RefreshCw, Play, Loader2 } from 'lucide-react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { fetchGoogleDocText } from '../utils/googleDocs';
import { parseVocabularyWithGemini } from '../utils/gemini';
import { getDueCards, addCards } from '../utils/db';
import type { SRItem } from '../utils/db';

interface DashboardProps {
  googleClientId: string;
  geminiApiKey: string;
  geminiModel: string;
  docId: string;
  onStartQuiz: () => void;
}

export default function Dashboard({ googleClientId, geminiApiKey, geminiModel, docId, onStartQuiz }: DashboardProps) {
  const { token, isReady, login, logout } = useGoogleAuth(googleClientId);
  const [syncing, setSyncing] = useState(false);
  const [dueCards, setDueCards] = useState<SRItem[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDueCards();
  }, []);

  const loadDueCards = async () => {
    const cards = await getDueCards();
    setDueCards(cards);
  };

  const handleSync = async () => {
    if (!token) {
        login();
        return;
    }
    setSyncing(true);
    setSyncMessage("ドキュメントのテキストを取得中...");
    try {
      const text = await fetchGoogleDocText(docId, token);
      if (!text) throw new Error("ドキュメントが空です。");
      
      setSyncMessage(`${geminiModel} で語彙を解析中...`);
      const items = await parseVocabularyWithGemini(geminiApiKey, text, geminiModel);
      
      if (items.length > 0) {
        const addedCount = await addCards(items);
        setSyncMessage(`正常に ${items.length} 件のアイテムを解析しました。 ${addedCount} 枚の新しいカードが追加されました。`);
        await loadDueCards();
      } else {
        setSyncMessage("ドキュメント内に語彙が見つかりませんでした。");
      }
    } catch (err: any) {
      console.error(err);
      setSyncMessage(`エラー: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 10000);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>フラッシュカード</h2>
        <div>
          {!token ? (
            <button 
              className="btn btn-primary" 
              onClick={login} 
              disabled={!isReady}
            >
              Googleでログイン
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>接続済み</span>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
                切断
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} className={syncing ? 'animate-pulse' : ''} /> 語彙の同期
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Google Docsから最新のノートをインポートし、Geminiを使ってフラッシュカードに変換します。
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? <><Loader2 className="animate-pulse" size={18}/> 同期中...</> : 'AI同期を開始'}
            </button>
            {syncMessage && (
                <span style={{ fontSize: '0.875rem', color: syncMessage.includes('エラー') ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {syncMessage}
                </span>
            )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Play size={20} /> 今日の復習
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {dueCards.length > 0 
            ? `今日は ${dueCards.length} 枚のカードの復習が必要です。`
            : "復習するカードはまだありません。まずは語彙の同期を試してください。"}
        </p>
        <button 
           className="btn btn-primary" 
           disabled={dueCards.length === 0}
           onClick={onStartQuiz}
        >
          クイズセッションを開始
        </button>
      </div>
    </div>
  );
}
