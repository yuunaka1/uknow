import React, { useState } from 'react';
import { Settings, BrainCircuit, Headphones, HelpCircle, MessageSquare, Zap, GraduationCap, Mic, Coffee, Camera, Volume2, Menu, X } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/Dashboard';
import Quiz from './components/Quiz';
import ShadowingPlayer from './components/ShadowingPlayer';
import Coaching from './components/Coaching';
import GeminiLive from './components/GeminiLive';
import CompositionTrainer from './components/CompositionTrainer';
import GoTanakaKei from './components/GoTanakaKei';
import FreeTalk from './components/FreeTalk';
import Teacher from './components/Teacher';
import PhotoDescription from './components/PhotoDescription';
import PronunciationTrainer from './components/PronunciationTrainer';
import ReactMarkdown from 'react-markdown';
import readmeText from '../README.md?raw';
import packageJson from '../package.json';
import { lockVolumeStream } from './utils/audioLocker';

type View = 'dashboard' | 'settings' | 'quiz' | 'shadowing' | 'coaching' | 'gemini_live' | 'composition' | 'gotanakakei' | 'freetalk' | 'teacher' | 'photodesc' | 'tuning' | 'help';

function App() {
  const getViewFromHash = (): View => {
    const hash = window.location.hash.replace('#', '') as View;
    const validViews: View[] = ['dashboard', 'settings', 'quiz', 'shadowing', 'coaching', 'gemini_live', 'composition', 'gotanakakei', 'freetalk', 'teacher', 'photodesc', 'tuning', 'help'];
    if (hash === 'monologue' as any) return 'gemini_live'; // alias for backward comp / aesthetic
    if (hash === 'reflex' as any) return 'composition'; // alias
    return validViews.includes(hash) ? hash : 'settings';
  };

  const [view, setView] = useState<View>(getViewFromHash());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  React.useEffect(() => {
    const handleHashChange = () => setView(getViewFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  React.useEffect(() => {
    const handleFirstInteraction = () => {
      lockVolumeStream();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  React.useEffect(() => {
    const targetHash = view === 'gemini_live' ? 'monologue' : view === 'composition' ? 'reflex' : view;
    if (window.location.hash !== `#${targetHash}`) {
      window.history.replaceState(null, '', `#${targetHash}`);
    }
  }, [view]);
  
  const [googleClientId, setGoogleClientId] = useLocalStorage('uknow_google_client_id', '');
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('uknow_gemini_api_key', '');
  const [docId, setDocId] = useLocalStorage('uknow_doc_id', '');
  const [geminiModel, setGeminiModel] = useLocalStorage('uknow_gemini_model', 'gemini-3.1-flash-lite-preview');
  const [geminiVoice, setGeminiVoice] = useLocalStorage('uknow_gemini_voice', 'Aoede');
  const [theme, setTheme] = useLocalStorage('uknow_theme', 'light');

  React.useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    }
  }, [theme]);
  
  const isFlashcardConfigured = googleClientId && geminiApiKey && docId;
  const isShadowingConfigured = !!geminiApiKey;
  
  React.useEffect(() => {
    if (!window.location.hash || window.location.hash === '#settings') {
      if (isFlashcardConfigured && view === 'settings') {
        setView('dashboard');
      } else if (isShadowingConfigured && !isFlashcardConfigured && view === 'settings') {
        setView('shadowing');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: 'clamp(1.5rem, 4vw, 3rem)', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', margin: 0, zIndex: 2000, fontWeight: 600 }}>
          <BrainCircuit color="var(--brand-primary)" size={22} />
          <span className="text-gradient">yuKnow</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 'normal', fontFamily: 'monospace', marginLeft: '0.5rem', backgroundColor: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
            v{packageJson.version}
          </span>
        </h1>
        <button
          className="btn btn-ghost icon-btn"
          onClick={() => setIsMenuOpen(true)}
          style={{ zIndex: 2000 }}
          aria-label="Open Menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {isMenuOpen && (
        <div className="menu-overlay animate-fade-in">
          <div className="menu-header">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>
              <BrainCircuit color="var(--brand-primary)" size={22} />
              <span className="text-gradient">yuKnow</span>
            </h1>
            <button
              className="btn btn-ghost icon-btn"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close Menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="menu-nav">
            <button
              className={`btn menu-btn ${view === 'shadowing' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('shadowing'); setIsMenuOpen(false); }}
              disabled={!isShadowingConfigured}
            >
              <Headphones size={20} /> シャドーイング
            </button>
            <button
              className={`btn menu-btn ${view === 'coaching' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('coaching'); setIsMenuOpen(false); }}
              disabled={!isShadowingConfigured}
            >
              <MessageSquare size={20} /> レッスン音声評価
            </button>
            <button
              className={`btn menu-btn ${view === 'gemini_live' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('gemini_live'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <Zap size={20} /> 独り言スピーチ
            </button>
            <button
              className={`btn menu-btn ${view === 'composition' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('composition'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <GraduationCap size={20} /> 瞬間英作文
            </button>
            <button
              className={`btn menu-btn ${view === 'gotanakakei' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('gotanakakei'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <Mic size={20} /> 田中渓メソッド
            </button>
            <button
              className={`btn menu-btn ${view === 'freetalk' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('freetalk'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <Coffee size={20} /> AI英会話(フリートーク)
            </button>
            <button
              className={`btn menu-btn ${view === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('teacher'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <GraduationCap size={20} /> 専属AIコーチ
            </button>
            <button
              className={`btn menu-btn ${view === 'tuning' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('tuning'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <Volume2 size={20} /> 発音矯正
            </button>
            <button
              className={`btn menu-btn ${view === 'photodesc' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('photodesc'); setIsMenuOpen(false); }}
              disabled={!geminiApiKey}
            >
              <Camera size={20} /> 写真描写
            </button>
            <button
              className={`btn menu-btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('dashboard'); setIsMenuOpen(false); }}
              disabled={!isFlashcardConfigured}
            >
              <BrainCircuit size={20} /> フラッシュカード
            </button>
            <button
              className={`btn menu-btn ${view === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('settings'); setIsMenuOpen(false); }}
            >
              <Settings size={20} /> 設定
            </button>
            <button
              className={`btn menu-btn ${view === 'help' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setView('help'); setIsMenuOpen(false); }}
            >
              <HelpCircle size={20} /> ヘルプ
            </button>
          </nav>
        </div>
      )}
      
      <main 
        className="glass-panel"
        style={{ padding: 'clamp(1rem, 4vw, 2rem)', border: 'none', background: 'transparent' }}
      >
        {view === 'settings' && (
          <SettingsPanel 
            googleClientId={googleClientId}
            setGoogleClientId={setGoogleClientId}
            geminiApiKey={geminiApiKey}
            setGeminiApiKey={setGeminiApiKey}
            geminiModel={geminiModel}
            setGeminiModel={setGeminiModel}
            geminiVoice={geminiVoice}
            setGeminiVoice={setGeminiVoice}
            docId={docId}
            setDocId={setDocId}
            theme={theme}
            setTheme={setTheme}
          />
        )}
        
        {view === 'dashboard' && isFlashcardConfigured && (
          <Dashboard
            googleClientId={googleClientId}
            geminiApiKey={geminiApiKey}
            geminiModel={geminiModel}
            docId={docId}
            onStartQuiz={() => setView('quiz')}
          />
        )}

        {view === 'quiz' && (
          <Quiz onComplete={() => setView('dashboard')} />
        )}

        {view === 'shadowing' && isShadowingConfigured && (
          <ShadowingPlayer geminiApiKey={geminiApiKey} geminiModel={geminiModel} />
        )}

        {view === 'coaching' && isShadowingConfigured && (
          <Coaching geminiApiKey={geminiApiKey} geminiModel={geminiModel} />
        )}
        
        {view === 'gemini_live' && geminiApiKey && (
          <GeminiLive geminiApiKey={geminiApiKey} geminiVoice={geminiVoice} />
        )}
        
        {view === 'composition' && geminiApiKey && (
          <CompositionTrainer geminiApiKey={geminiApiKey} geminiModel={geminiModel} geminiVoice={geminiVoice} />
        )}
        
        {view === 'gotanakakei' && geminiApiKey && (
          <GoTanakaKei geminiApiKey={geminiApiKey} geminiModel={geminiModel} geminiVoice={geminiVoice} />
        )}
        
        {view === 'freetalk' && geminiApiKey && (
          <FreeTalk geminiApiKey={geminiApiKey} geminiModel={geminiModel} geminiVoice={geminiVoice} />
        )}

        {view === 'teacher' && geminiApiKey && (
          <Teacher
            googleClientId={googleClientId}
            geminiApiKey={geminiApiKey}
            geminiModel={geminiModel}
            geminiVoice={geminiVoice}
            docId={docId}
          />
        )}

        {view === 'photodesc' && geminiApiKey && (
          <PhotoDescription geminiApiKey={geminiApiKey} geminiModel={geminiModel} />
        )}
        
        {view === 'tuning' && geminiApiKey && (
          <PronunciationTrainer geminiApiKey={geminiApiKey} geminiModel={geminiModel} geminiVoice={geminiVoice} />
        )}
        
        {view === 'help' && (
          <div className="animate-fade-in" style={{ overflowX: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={24} /> ドキュメント (ヘルプ)
            </h2>
            <div className="markdown-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <ReactMarkdown 
                urlTransform={(uri) => uri.startsWith('public/') ? uri.replace('public/', '') : uri}
                components={{
                  img: ({ ...props }) => (
                    <img {...props} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', margin: '1.5rem 0' }} />
                  )
                }}
              >
                {readmeText}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
