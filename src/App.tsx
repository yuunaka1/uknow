import React, { useState } from 'react';
import { Settings, BrainCircuit, Headphones, HelpCircle, MessageSquare, Zap, GraduationCap, Mic, Coffee, Camera, Volume2 } from 'lucide-react';
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
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: 'clamp(1rem, 4vw, 2rem)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', margin: 0 }}>
          <BrainCircuit color="var(--brand-primary)" />
          <span className="text-gradient">// yuKnow</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 'normal', fontFamily: 'monospace', marginLeft: '0.5rem' }}>
            v{packageJson.version}
          </span>
        </h1>
        <nav style={{ display: 'flex', gap: 'clamp(0.25rem, 2vw, 0.5rem)', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${view === 'shadowing' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('shadowing')}
            disabled={!isShadowingConfigured}
          >
            <Headphones size={18} /> Shadowing
          </button>
          <button 
            className={`btn ${view === 'coaching' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('coaching')}
            disabled={!isShadowingConfigured}
          >
            <MessageSquare size={18} /> Coaching
          </button>
          <button 
            className={`btn ${view === 'gemini_live' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('gemini_live')}
            disabled={!geminiApiKey}
          >
            <Zap size={18} /> Monologue
          </button>
          <button 
            className={`btn ${view === 'composition' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('composition')}
            disabled={!geminiApiKey}
          >
            <GraduationCap size={18} /> Reflex
          </button>
          <button 
            className={`btn ${view === 'gotanakakei' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('gotanakakei')}
            disabled={!geminiApiKey}
          >
            <Mic size={18} /> GoTanakaKei
          </button>
          <button 
            className={`btn ${view === 'freetalk' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('freetalk')}
            disabled={!geminiApiKey}
          >
            <Coffee size={18} /> Dialogue
          </button>
          <button
            className={`btn ${view === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('teacher')}
            disabled={!geminiApiKey}
          >
            <GraduationCap size={18} /> Teacher
          </button>
          <button 
            className={`btn ${view === 'tuning' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('tuning')}
            disabled={!geminiApiKey}
          >
            <Volume2 size={18} /> Tuning
          </button>
          <button 
            className={`btn ${view === 'photodesc' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('photodesc')}
            disabled={!geminiApiKey}
          >
            <Camera size={18} /> Describe
          </button>
          <button 
            className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('dashboard')}
            disabled={!isFlashcardConfigured}
          >
            <BrainCircuit size={18} /> Flashcards
          </button>
          <button 
            className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('settings')}
          >
            <Settings size={18} /> Settings
          </button>
          <button 
            className={`btn ${view === 'help' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('help')}
          >
            <HelpCircle size={18} /> Help
          </button>
        </nav>
      </header>
      
      <main 
        className={view === 'shadowing' ? '' : 'glass-panel'} 
        style={view === 'shadowing' ? {} : { padding: 'clamp(1rem, 4vw, 2rem)' }}
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
              <HelpCircle size={24} /> Documentation
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
