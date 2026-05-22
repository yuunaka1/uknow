import { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { PRESET_TOPICS } from '../utils/topicStore';
import type { TopicState } from '../utils/topicStore';
import { Plus, Download, Upload, CheckCircle, Clock, FileText, Trash2, Mic } from 'lucide-react';
import TopicWorkflow from './TopicWorkflow';

interface GoTanakaKeiProps {
  geminiApiKey: string;
  geminiModel: string;
  geminiVoice: string;
}

export default function GoTanakaKei({ geminiApiKey, geminiModel, geminiVoice }: GoTanakaKeiProps) {
  const [topics, setTopics] = useLocalStorage<TopicState[]>('uknow_gotanakakei_topics', PRESET_TOPICS as TopicState[]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const activeTopic = topics.find(t => t.id === selectedTopicId);

  const handleUpdateTopic = (id: string, updates: Partial<TopicState>) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleAddCustomTopic = () => {
    const title = window.prompt("追加するトピック名（例：学生時代の部活について）を入力してください:");
    if (!title) return;
    
    const newTopic: TopicState = {
      id: `custom_${Date.now()}`,
      title,
      isCustom: true,
      status: 'unstarted',
      rawNotesJa: '',
      organizedOutlineJa: '',
      englishScript: '',
      lastFeedback: '',
      updatedAt: Date.now()
    };
    
    setTopics(prev => [newTopic, ...prev]);
  };

  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("このカスタムトピックを削除しますか？")) {
       setTopics(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(topics));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "yuknow_gotanakakei_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
            if (window.confirm("既存のデータを上書きして復元しますか？")) {
               setTopics(parsed);
               alert("データをインポートしました。");
            }
          } else {
             alert("無効なJSONファイルです。");
          }
        } catch {
          alert("ファイルの読み込みに失敗しました。");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (activeTopic) {
    return (
      <TopicWorkflow 
        topic={activeTopic} 
        geminiApiKey={geminiApiKey} 
        geminiModel={geminiModel}
        geminiVoice={geminiVoice}
        onUpdate={(updates) => handleUpdateTopic(activeTopic.id, updates)}
        onClose={() => setSelectedTopicId(null)}
      />
    );
  }

  const getStatusBadge = (status: TopicState['status']) => {
    switch(status) {
      case 'unstarted': return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12}/> 未着手</span>;
      case 'drafted': return <span style={{ color: '#ffaa00', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12}/> メモあり</span>;
      case 'scripted': return <span style={{ color: '#00ccff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12}/> スクリプト完</span>;
      case 'practiced':
      case 'completed': return <span style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12}/> 実践済</span>;
      default: return null;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: '#00ccff' }}>
          <Mic size={20} /> Personal Topics (GoTanakaKei)
        </h2>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
           <button onClick={handleAddCustomTopic} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
             <Plus size={16}/> カスタム追加
           </button>
           <button onClick={handleImport} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
             <Upload size={16}/> Load JSON
           </button>
           <button onClick={handleExport} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
             <Download size={16}/> Save JSON
           </button>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5, fontSize: '0.9rem' }}>
        自己紹介や初対面での定番トピックを準備し、AIを相手に実践的なスピーキングの練習をします。<br/>
        日本語の壁打ち面談で内容を整理し、自然な英語スクリプトを作成。最後は本番形式の英語面接に挑みましょう！
      </p>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', alignContent: 'start' }}>
        {topics.map(topic => (
          <div 
            key={topic.id}
            onClick={() => setSelectedTopicId(topic.id)}
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: `1px solid ${topic.status === 'completed' ? 'var(--success)' : topic.status === 'scripted' ? '#00ccff' : 'var(--border-color)'}`,
              borderRadius: '8px',
              padding: '1rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            className="hover-brighten"
          >
            {topic.isCustom && (
              <button 
                onClick={(e) => handleDeleteCustom(e, topic.id)}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: '#ff3333', cursor: 'pointer', opacity: 0.5 }}
                title="Delete Custom Topic"
                aria-label="Delete Custom Topic"
              >
                <Trash2 size={16} />
              </button>
            )}
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', paddingRight: topic.isCustom ? '1.5rem' : '0' }}>
              {topic.title}
            </h3>
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-start' }}>
              {getStatusBadge(topic.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
