import { useState } from 'react';
import { ArrowLeft, Edit3, Wand2, Mic, CheckCircle, FileText, ChevronRight, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { TopicState } from '../utils/topicStore';
import LiveInterviewPanel from './LiveInterviewPanel';
import { generateTopicScript, generateTopicFeedback } from '../utils/gemini';

interface TopicWorkflowProps {
  topic: TopicState;
  geminiApiKey: string;
  geminiModel: string;
  geminiVoice: string;
  onUpdate: (updated: Partial<TopicState>) => void;
  onClose: () => void;
}

export default function TopicWorkflow({ topic, geminiApiKey, geminiModel, geminiVoice, onUpdate, onClose }: TopicWorkflowProps) {
  const [activeTab, setActiveTab] = useState<'phase1' | 'phase2' | 'phase3'>('phase1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInterviewing, setIsInterviewing] = useState(false);
  
  // Phase 1
  const handleJaSessionEnd = (userTranscript: string) => {
    setIsInterviewing(false);
    if (userTranscript) {
      const newNotes = topic.rawNotesJa ? topic.rawNotesJa + '\n\n' + userTranscript : userTranscript;
      onUpdate({ rawNotesJa: newNotes, status: 'drafted' });
    }
  };

  const handleGenerateScript = async () => {
    if (!topic.rawNotesJa.trim()) {
      alert("Please provide some notes first.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await generateTopicScript(geminiApiKey, geminiModel, topic.title, topic.rawNotesJa);
      onUpdate({ 
        organizedOutlineJa: res.outline, 
        englishScript: res.script,
        status: 'scripted'
      });
      setActiveTab('phase2');
    } catch (e: any) {
      alert(`Error generating script: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Phase 3
  const handleEnPracticeEnd = async (userTranscript: string, allLogs: any[]) => {
    setIsInterviewing(false);
    if (!userTranscript) return;
    
    setIsGenerating(true);
    try {
      const fullLogStr = allLogs.map(l => `${l.sender === 'user' ? 'Me' : 'Coach'}: ${l.text}`).join('\n');
      const feedback = await generateTopicFeedback(geminiApiKey, geminiModel, topic.title, fullLogStr);
      onUpdate({
        lastFeedback: feedback,
        status: 'completed'
      });
    } catch (e: any) {
      alert(`Error generating feedback: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const jaInstruction = `あなたはプロの英語学習コーチです。
ユーザーが「${topic.title}」というテーマで英語のスピーキング練習をするための原稿を作ろうとしています。
親しみやすい口調で、このテーマに関して具体的なエピソードや考えを引き出すような鋭い質問を日本語で1つずつ投げかけてください。
1つの質問につき、ユーザーが回答するまで待ってください。十分に情報が引き出せたら「ストップして次のステップに進んでね」と伝えてください。`;

  const enInstruction = `You are a friendly language exchange partner. 
I am practicing speaking English on the topic: "${topic.title}".
Please ask me conversational questions about this topic, one at a time, and let me answer. Include brief, natural reactions to my answers. Speak at a moderate, clear pace.`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1 }}>{topic.title}</h2>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('phase1')}
          style={{ flex: 1, padding: '0.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'phase1' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'phase1' ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Phase 1: 整理・引き出し
        </button>
        <button 
          onClick={() => setActiveTab('phase2')}
          style={{ flex: 1, padding: '0.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'phase2' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'phase2' ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Phase 2: 台本スクリプト
        </button>
        <button 
          onClick={() => setActiveTab('phase3')}
          style={{ flex: 1, padding: '0.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'phase3' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'phase3' ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Phase 3: 英語実践
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
        {/* PHASE 1 */}
        {activeTab === 'phase1' && (
          <div className="animate-fade-in">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              このトピックについて話したいことを日本語で書き出してみてください。AIに「壁打ち相手」としてインタビューしてもらうこともできます。
            </p>
            
            {isInterviewing ? (
              <LiveInterviewPanel 
                geminiApiKey={geminiApiKey} 
                geminiVoice={geminiVoice}
                systemInstruction={jaInstruction} 
                onSessionEnd={handleJaSessionEnd}
                lang="ja"
              />
            ) : (
              <button 
                onClick={() => setIsInterviewing(true)}
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}
              >
                <Mic size={18} /> 日本語で音声インタビューをはじめる (壁打ち)
              </button>
            )}

            <div className="form-group">
              <label className="form-label"><Edit3 size={14}/> 日本語メモ (Raw Notes)</label>
              <textarea 
                className="form-input" 
                rows={8}
                value={topic.rawNotesJa}
                onChange={(e) => onUpdate({ rawNotesJa: e.target.value })}
                placeholder="例：小さい頃から〜が好きで...&#10;最近は仕事で〜をしていて..."
              />
            </div>

            <button 
              onClick={handleGenerateScript}
              disabled={isGenerating || !topic.rawNotesJa.trim()}
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}
            >
              {isGenerating ? 'GENERATING...' : <><Wand2 size={18}/> メモから「英語スクリプト」を自動生成する <ChevronRight size={18}/></>}
            </button>
          </div>
        )}

        {/* PHASE 2 */}
        {activeTab === 'phase2' && (
          <div className="animate-fade-in">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              生成された英語スクリプトを確認し、必要なら手直ししてください。
            </p>

            <div className="form-group">
              <label className="form-label"><FileText size={14}/> 構成案 (Outline)</label>
              <textarea 
                className="form-input" 
                rows={4}
                value={topic.organizedOutlineJa}
                onChange={(e) => onUpdate({ organizedOutlineJa: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label"><Globe size={14}/> 英語スクリプト (English Script)</label>
              <textarea 
                className="form-input" 
                rows={10}
                style={{ fontSize: '1rem', lineHeight: '1.6' }}
                value={topic.englishScript}
                onChange={(e) => onUpdate({ englishScript: e.target.value })}
              />
            </div>

            <button 
              onClick={() => setActiveTab('phase3')}
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}
            >
              次へ：スクリプトを使って英語で実践練習 <ChevronRight size={18}/>
            </button>
          </div>
        )}

        {/* PHASE 3 */}
        {activeTab === 'phase3' && (
          <div className="animate-fade-in">
            {topic.lastFeedback && (
              <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} /> 最新のフィードバック
                </h4>
                <div className="markdown-body" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                  <ReactMarkdown>{topic.lastFeedback}</ReactMarkdown>
                </div>
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              いざ本番です！ネイティブからのトピックに関する質問に英語で答える練習をしましょう。下のスクリプトを見ながら話しても構いません。
            </p>

            {isInterviewing ? (
              <LiveInterviewPanel 
                geminiApiKey={geminiApiKey} 
                geminiVoice={geminiVoice}
                systemInstruction={enInstruction} 
                onSessionEnd={handleEnPracticeEnd}
                lang="en"
              />
            ) : (
              <button 
                onClick={() => setIsInterviewing(true)}
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}
                disabled={isGenerating}
              >
                {isGenerating ? "GENERATING FEEDBACK..." : <><Mic size={18} /> スクリプトを見ながら 実践会話練習をはじめる</>}
              </button>
            )}

            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '1rem', lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', borderLeft: '4px solid var(--brand-primary)', marginBottom: '2rem' }}>
              {topic.englishScript || "※ まだスクリプトが生成されていません！ (Phase 2 で作成してください)"}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
