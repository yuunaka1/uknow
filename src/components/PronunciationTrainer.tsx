import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, Loader, AlertTriangle, LogOut, CheckCircle, Volume2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';
import { generatePronunciationFeedback } from '../utils/gemini';
import ReactMarkdown from 'react-markdown';

type LiveState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

const PRONUNCIATION_THEMES = [
  { id: 'r_l', label: 'R / L' },
  { id: 'b_v', label: 'B / V' },
  { id: 'th', label: 'TH (θ / ð)' },
  { id: 's_sh', label: 'S / SH (s / ʃ)' },
  { id: 'f_h', label: 'F / H' },
  { id: 'word_stress', label: 'Word Stress (単語のアクセント)' },
  { id: 'sentence_rhythm', label: 'Sentence Rhythm (文のリズム)' },
  { id: 'intonation', label: 'Intonation (イントネーション)' },
  { id: 'final_consonants', label: 'Final Consonants (語末の子音)' },
  { id: 'linking', label: 'Linking (リンキング / 音の連結)' },
  { id: 'vowel_length', label: 'Vowel Length (短母音・長母音)' },
  { id: 'schwa', label: 'Schwa (シュワー / 曖昧母音)' }
];

export default function PronunciationTrainer({ geminiApiKey, geminiModel, geminiVoice }: { geminiApiKey: string, geminiModel: string, geminiVoice: string }) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [errorDetails, setErrorDetails] = useState("");
  const [selectedTheme, setSelectedTheme] = useLocalStorage('uknow_pronunciation_theme', 'r_l');
  const [feedback, setFeedback] = useState<string>('');
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  const modelOverride = "models/gemini-3.1-flash-live-preview";

  const addLog = useCallback((text: string, sender: 'user' | 'model' | 'system', isStream: boolean = false) => {
    setLogs(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === sender && last.isStream) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = { ...last, text: last.text + text, isStream };
        return newLogs;
      }
      return [...prev, { id: Math.random().toString(), text, sender, isStream }];
    });
  }, []);

  const finalizeStream = useCallback((sender: 'user' | 'model') => {
    setLogs(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === sender && last.isStream) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = { ...last, isStream: false };
        return newLogs;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startSession = async () => {
    if (!geminiApiKey) {
      addLog("API Key missing.", "system");
      return;
    }

    try {
      setAppState('connecting');
      setErrorDetails("");
      setLogs([]);
      setFeedback('');
      playerRef.current = new AudioStreamPlayer();
      recorderRef.current = new AudioRecorder();

      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          console.warn("Wake lock failed:", err);
        }
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      const themeLabel = PRONUNCIATION_THEMES.find(t => t.id === selectedTheme)?.label || selectedTheme;

      const systemPrompt = `You are an expert AI pronunciation coach. The interaction is live and turn-based.
The user wants to practice the English pronunciation theme: "${themeLabel}".
All your instructions and feedback MUST be in Japanese (日本語).
However, the practice sentences you provide MUST be in English.

Workflow:
1. Provide a short, practical English sentence focused on the theme "${themeLabel}". Wait for the user to read it aloud.
2. Listen to the user's pronunciation carefully.
3. Evaluate the user's pronunciation of that sentence immediately. Give short, specific, and actionable feedback in Japanese. (e.g. "Rの発音が少しLに聞こえました。舌を巻かずに...").
4. If the pronunciation needs work, ask the user to retry the same sentence. If it was good, praise them briefly and provide the next English sentence.

Keep your feedback very concise and strictly focused on pronunciation. Do not give long explanations. Guide the user step by step.`;

      ws.onopen = () => {
        addLog(`Connected to Multimodal Live API (${modelOverride})`, "system");
        const setupMsg = {
          setup: {
            model: modelOverride,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: geminiVoice
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onclose = (event) => {
        handleStopSession();
        if (event.code !== 1000 && event.code !== 1005) {
           setErrorDetails(`Disconnect code: ${event.code}`);
           setAppState('error');
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        setAppState('error');
        addLog("WebSocket Error occurred.", "system");
      };

      ws.onmessage = async (event) => {
        let msgStr = event.data instanceof Blob ? await event.data.text() : event.data;
        try {
          const payload = JSON.parse(msgStr);

          if (payload.setupComplete) {
            setAppState('listening');
            addLog(`Setup complete. Theme: ${themeLabel}. Say "Hello" or "Start" to begin!`, "system");
            
            setTimeout(async () => {
              if (wsRef.current?.readyState !== WebSocket.OPEN) return;
              await recorderRef.current?.start((base64pcm) => {
                 if (wsRef.current?.readyState === WebSocket.OPEN) {
                   wsRef.current.send(JSON.stringify({
                     realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64pcm } }
                   }));
                 }
              });
            }, 500);
          }

          if (payload.serverContent) {
             const content = payload.serverContent;
             
             if (content.interrupted) {
                playerRef.current?.stop();
                finalizeStream('model');
                finalizeStream('user');
                setAppState('listening');
             }

             if (content.modelTurn) {
                finalizeStream('user');
                if (content.modelTurn.parts) {
                   for (const part of content.modelTurn.parts) {
                     if (part.text) addLog(part.text, "model", true);
                     if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                        setAppState('speaking');
                        await playerRef.current?.playPcmData(part.inlineData.data);
                     }
                   }
                }
             }

             if (content.inputTranscription && content.inputTranscription.text) {
                addLog(content.inputTranscription.text, "user", true);
             }
             
             if (content.outputTranscription && content.outputTranscription.text) {
                addLog(content.outputTranscription.text, "model", true);
             }
             
             if (content.turnComplete) {
                setAppState('listening');
                finalizeStream('model');
             }
          }
        } catch (e) {
          console.error("Message Parsing Error:", e);
        }
      };

    } catch (e: any) {
      console.error(e);
      setAppState('error');
      setErrorDetails(e.message);
      addLog(`Failed to start session: ${e.message}`, "system");
    }
  };

  const handleStopSession = useCallback(async () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    playerRef.current?.stop();
    playerRef.current = null;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000);
    }
    wsRef.current = null;
    
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.warn);
      wakeLockRef.current = null;
    }
    
    setAppState(prev => (prev !== 'idle' && prev !== 'error' ? 'idle' : prev));
  }, []);

  const stopAndGenerateFeedback = async () => {
    await handleStopSession();
    
    const userAndModelLogs = logs.filter(l => l.sender !== 'system');
    if (userAndModelLogs.length > 2) {
      setIsGeneratingFeedback(true);
      try {
        const fullLogStr = userAndModelLogs.map(l => `${l.sender === 'user' ? 'User' : 'AI'}: ${l.text}`).join('\n');
        const themeLabel = PRONUNCIATION_THEMES.find(t => t.id === selectedTheme)?.label || selectedTheme;
        const generated = await generatePronunciationFeedback(geminiApiKey, geminiModel, fullLogStr, themeLabel);
        setFeedback(generated);
      } catch (err: any) {
        console.error(err);
        setFeedback("Failed to generate feedback for this session.");
      } finally {
        setIsGeneratingFeedback(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      handleStopSession();
    };
  }, [handleStopSession]);

  const btnBaseStyles = {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    border: '1px solid currentColor',
    transition: 'all 0.2s',
  };

  const statusColors = {
    idle: 'var(--text-tertiary)',
    connecting: 'var(--brand-primary)',
    listening: 'var(--brand-primary)',
    processing: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    error: 'var(--error)'
  };

  const currentColor = statusColors[appState];

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', margin: 0, fontSize: '1.25rem' }}>
          <Volume2 size={20} /> TUNING
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Theme:</span>
            <select 
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              disabled={appState !== 'idle' && appState !== 'error'}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontWeight: 'bold' }}
            >
              {PRONUNCIATION_THEMES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {appState === 'idle' || appState === 'error' ? (
            <button 
              onClick={startSession}
              style={{ ...btnBaseStyles, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-light)' }}
            >
              <Mic size={16} /> START
            </button>
          ) : (
            <button 
              onClick={stopAndGenerateFeedback}
              style={{ ...btnBaseStyles, color: 'var(--error)', backgroundColor: 'var(--error-bg)' }}
            >
              <LogOut size={16} /> END
            </button>
          )}

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontWeight: 'bold', 
            color: currentColor,
            backgroundColor: 'var(--bg-secondary)',
            padding: '0.4rem 0.75rem',
            borderRadius: '4px',
            border: `1px solid ${currentColor}22`,
            fontSize: '0.85rem'
          }}>
            {(appState === 'connecting' || appState === 'processing') && <Loader size={14} className="animate-spin" />}
            {appState === 'error' && <AlertTriangle size={14} />}
            {appState === 'listening' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentColor, boxShadow: `0 0 8px ${currentColor}`, animation: 'pulse 1.5s infinite' }}></div>}
            {appState === 'speaking' && <Globe size={14} className="animate-pulse" />}
            
            <span style={{ letterSpacing: '1px' }}>{appState.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {errorDetails && (
         <div style={{ padding: '1rem', marginBottom: '1rem', color: 'var(--error)', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: '4px' }}>
            <AlertTriangle size={18} style={{ marginBottom: '0.5rem' }}/>
            <br />
            {errorDetails}
         </div>
      )}

      {isGeneratingFeedback && (
        <div style={{ padding: '1.5rem', marginBottom: '1rem', backgroundColor: 'var(--brand-light)', border: '1px solid var(--brand-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)' }}>
          <Loader className="animate-spin" size={20} />
          <span>Generating session feedback...</span>
        </div>
      )}

      {feedback && !isGeneratingFeedback && (
        <div style={{ padding: '1.5rem', marginBottom: '1rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', flexShrink: 0, maxHeight: '40vh', overflowY: 'auto' }}>
           <h3 style={{ margin: '0 0 1rem 0', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <CheckCircle size={20} /> Session Feedback
           </h3>
           <div className="markdown-body" style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
             <ReactMarkdown>{feedback}</ReactMarkdown>
           </div>
        </div>
      )}

      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        fontFamily: "'Fira Code', monospace",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--brand-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            TUNING_STREAM_LOG
          </h3>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Ready to establish WebSocket stream...</div>
          ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '0.5rem',
                color: log.sender === 'model' ? 'var(--brand-primary)' : log.sender === 'user' ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontStyle: log.sender === 'system' ? 'italic' : 'normal',
                opacity: log.sender === 'system' ? 0.7 : 1,
              }}
            >
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {log.sender === 'user' ? '> ' : log.sender === 'model' ? '< ' : '* '}
                {log.text}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
