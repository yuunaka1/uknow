import { useState, useEffect, useCallback } from 'react';
import { getDueCards, updateCardResult } from '../utils/db';
import type { SRItem } from '../utils/db';
import { Check, X, Loader2, Volume2 } from 'lucide-react';

export default function Quiz({ onComplete }: { onComplete: () => void }) {
  const [cards, setCards] = useState<SRItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCards = async () => {
    let due = await getDueCards();
    // Shuffle and pick up to 50 for this session
    due = due.sort(() => 0.5 - Math.random()).slice(0, 50);
    setCards(due);
    setLoading(false);
  };

  useEffect(() => {
    loadCards();
  }, []);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // キャンセルしてキューを空にしてから即再生
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; 
      utterance.rate = 0.9; // 少しゆっくりめに発音し学習しやすくする
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // UseEffect for automatic pronunciation when the card changes
  useEffect(() => {
    if (!loading && cards.length > 0 && currentIndex < cards.length && !showAnswer) {
      speak(cards[currentIndex].vocab.term);
    }
  }, [currentIndex, loading, cards, showAnswer, speak]);

  if (loading) {
     return <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-pulse" size={40} color="var(--brand-primary)" /></div>;
  }

  if (cards.length === 0) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>すべて完了しました！</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '2rem' }}>現在復習する単語はありません。</p>
        <button className="btn btn-primary" onClick={onComplete}>ダッシュボードに戻る</button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const isFinished = currentIndex >= cards.length;

  if (isFinished) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>セッション完了！ 🎉</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '2rem' }}>{cards.length} 件のアイテムを復習しました。</p>
        <button className="btn btn-primary" onClick={onComplete}>終了</button>
      </div>
    );
  }

  const handleScore = async (score: number) => {
    await updateCardResult(currentCard.vocab.id, score);
    setShowAnswer(false);
    setCurrentIndex(prev => prev + 1);
  };

  const blankedExample = currentCard.vocab.exampleSentence 
      ? currentCard.vocab.exampleSentence.replace(new RegExp(currentCard.vocab.term, 'gi'), '_____')
      : null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
        <span>復習中</span>
        <span>{currentIndex + 1} / {cards.length}</span>
      </div>

      <div className="glass-panel" style={{ minHeight: '350px', padding: '2.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* Progress Bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, height: '4px', background: 'var(--brand-primary)', width: `${((currentIndex) / cards.length) * 100}%`, transition: 'width 0.3s' }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          
          <span style={{ padding: '0.2rem 0.6rem', background: 'var(--brand-light)', color: 'var(--brand-primary)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, marginBottom: '1.5rem', textTransform: 'uppercase' }}>
            {currentCard.vocab.partOfSpeech || '単語'}
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '2.5rem', margin: 0 }}>{currentCard.vocab.term}</h2>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => speak(currentCard.vocab.term)}
              title="発音を聞く"
              aria-label="発音を聞く"
            >
              <Volume2 size={24} color="var(--brand-primary)" />
            </button>
          </div>
          
          {blankedExample && !showAnswer && (
             <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>"{blankedExample}"</p>
          )}

          {showAnswer && (
            <div className="animate-fade-in" style={{ marginTop: '2rem', width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--success)', marginBottom: '1rem' }}>{currentCard.vocab.meaning}</h3>
              {currentCard.vocab.exampleSentence && (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>"{currentCard.vocab.exampleSentence}"</p>
                    <button 
                       className="btn btn-secondary" 
                       style={{ padding: '0.4rem', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                       onClick={() => speak(currentCard.vocab.exampleSentence)}
                       title="例文を聞く"
                       aria-label="例文を聞く"
                     >
                       <Volume2 size={18} color="var(--text-secondary)" />
                     </button>
                 </div>
              )}
            </div>
          )}

        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          {!showAnswer ? (
            <button className="btn btn-primary" onClick={() => setShowAnswer(true)} style={{ width: '100%' }}>
              答えを表示
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => handleScore(1)} style={{ flex: 1, borderColor: 'var(--error)' }}>
                <X color="var(--error)" size={18} style={{ marginRight: '0.5rem' }}/> もう一度 (Again)
              </button>
              <button className="btn btn-secondary" onClick={() => handleScore(4)} style={{ flex: 1, borderColor: 'var(--success)', color: 'var(--success)' }}>
                <Check size={18} style={{ marginRight: '0.5rem' }}/> できた (Good)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
