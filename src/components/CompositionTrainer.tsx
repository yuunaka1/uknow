import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, AlertTriangle, GraduationCap, LogOut, Trash2, X, Loader } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';
import { generateReflexFeedback } from '../utils/gemini';
import ReactMarkdown from 'react-markdown';

type LiveState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';
type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

const GRAMMAR_THEMES = [
  { value: '', label: '指定なし' },
  { value: 'Sentences & 5 Basic Sentence Patterns', label: '文・基本5文型' },
  { value: 'Parts of Speech', label: '品詞' },
  { value: 'Phrases, Clauses & Sentence Types', label: '句と節・文の種類' },
  { value: 'Verbs', label: '動詞' },
  { value: 'Present & Past Continuous Tense', label: '現在進行形・過去進行形' },
  { value: 'Future & Future Continuous Tense', label: '未来形・未来進行形' },
  { value: 'Perfect Tense', label: '完了形' },
  { value: 'Interrogative Sentences', label: '疑問文' },
  { value: 'Imperative Sentences', label: '命令文' },
  { value: '"There is/are" Structure', label: 'There is/are 構文' },
  { value: 'Modal Verbs', label: '助動詞' },
  { value: 'Active & Passive Voice', label: '能動態・受動態' },
  { value: 'Infinitives', label: '不定詞' },
  { value: 'Gerunds', label: '動名詞' },
  { value: 'Present & Past Participles', label: '現在分詞・過去分詞' },
  { value: 'Subjunctive Mood / Conditionals', label: '仮定法' },
  { value: 'Relative Clauses', label: '関係詞' },
  { value: 'Prepositions', label: '前置詞' },
  { value: 'Conjunctions', label: '接続詞' },
  { value: 'That-clauses & Wh-clauses', label: 'that節・wh節' },
  { value: 'Adjectives', label: '形容詞' },
  { value: 'Adverbs', label: '副詞' },
  { value: 'Nouns', label: '名詞' },
  { value: 'Pronouns', label: '代名詞' },
  { value: 'Articles', label: '冠詞' },
  { value: 'Comparisons', label: '比較' }
];

export default function CompositionTrainer({ geminiApiKey, geminiModel, geminiVoice }: { geminiApiKey: string, geminiModel: string, geminiVoice: string }) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useLocalStorage<LogMessage[]>('uknow_composition_logs', []);
  const [errorDetails, setErrorDetails] = useState("");
  const [trainingLevel, setTrainingLevel] = useLocalStorage<CEFRLevel>('uknow_composition_level', 'B1');
  const [grammarTheme, setGrammarTheme] = useLocalStorage('uknow_composition_grammar', '');
  const [sessionFeedback, setSessionFeedback] = useState<string>('');
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const sessionStartAfterIdRef = useRef<string | null>(null);

  const modelOverride = "models/gemini-3.1-flash-live-preview";

  const addLog = useCallback((text: string, sender: 'user' | 'model' | 'system', isStream: boolean = false) => {
    setLogs(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === sender && last.isStream) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = { ...last, text: last.text + text, isStream };
        return newLogs;
      }
      const arr = [...prev, { id: Math.random().toString(), text, sender, isStream }];
      return arr.slice(-150);
    });
  }, [setLogs]);

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
  }, [setLogs]);

  const clearLogs = () => {
    if (window.confirm("Clear Session Logs?")) setLogs([]);
  };

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
      setSessionFeedback("");
      sessionStartAfterIdRef.current = logs.length > 0 ? logs[logs.length - 1].id : null;
      playerRef.current = new AudioStreamPlayer();
      recorderRef.current = new AudioRecorder();

      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          addLog("Screen wake lock acquired.", "system");
        } catch (err: any) {
          console.warn("Wake lock failed:", err);
        }
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog(`Connected to Trainer API (Level: ${trainingLevel}${grammarTheme ? `, Theme: ${grammarTheme}` : ''})`, "system");
        
        const themeInstruction = grammarTheme ? `
CRITICAL THEME INSTRUCTION:
Focus the Japanese sentences and expected English translations heavily on the following grammar theme: "${grammarTheme}".
Ensure the sentences naturally require using this grammar structure. In your feedback, briefly advise whether the user successfully used this target grammar.` : '';

        const systemPrompt = `You are a continuous English composition trainer. The current difficulty level is CEFR ${trainingLevel}.${themeInstruction}
Reflex Training Loop:
1. Provide a Japanese sentence for the user to translate. 
   CRITICAL: ONLY say the Japanese sentence itself. Do NOT add conversational fillers like "How do you say...", "Translate this...", or "Here is the next one:". Just output the bare Japanese sentence.
2. Wait for the user to say the English translation.
3. Provide concise verbal feedback.
  - Praise what they did well.
  - Correct unnatural phrasing or grammar.
  - Provide a native alternative.
  - Speak your explanations in Japanese, but pronounce the English examples clearly in English.
  - CRITICAL RECUPERATION STEP: If the user's translation was incorrect or unnatural, first provide the correct English sentence, and then explicitely prompt the user to repeat the correct sentence aloud (e.g., "リピートしてみましょう: [Correct Sentence]"). You MUST wait for their repetition before moving to the next sentence.
4. Immediately output the next Japanese sentence to translate.
   CRITICAL: If the user's previous translation was incorrect or unnatural, the NEXT Japanese sentence MUST test the exact same grammar pattern or phrase they struggled with, using a slightly different context (adaptive learning).
   CRITICAL: If the user translated perfectly, you MUST shift to a COMPLETELY DIFFERENT context, vocabulary, and topic for the next sentence. Do not linger on similar phrases or situations. Ensure a wide variety of expressions are practiced.
   CRITICAL: ONLY say the Japanese sentence. Do NOT say anything else.
Do not break this loop. Keep feedback practical and short. Speak naturally.`;

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
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                silenceDurationMs: 1200
              }
            }
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onclose = (event) => {
        stopSession();
        if (event.code !== 1000) {
           let detail = "";
           if (event.code === 1007) detail = "(1007: Unsupported Payload/Model Mismatch.)";
           addLog(`Disconnected (${event.code}) ${detail}`, "system");
           setErrorDetails(`Disconnect code: ${event.code} ${detail}`);
           setAppState('error');
        } else {
           addLog("Session ended gracefully.", "system");
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        setAppState('error');
        addLog("WebSocket Error occurred.", "system");
      };

      ws.onmessage = async (event) => {
        let msgStr = "";
        if (event.data instanceof Blob) {
           msgStr = await event.data.text();
        } else {
           msgStr = event.data;
        }

        try {
          const payload = JSON.parse(msgStr);

          if (payload.setupComplete) {
            setAppState('listening');
            addLog(`Training session started at level ${trainingLevel}. Listening...`, "system");
            
            // Delay start to avoid 1008 race condition
            setTimeout(async () => {
              if (wsRef.current?.readyState !== WebSocket.OPEN) return;
              await recorderRef.current?.start((base64pcm) => {
                 if (wsRef.current?.readyState === WebSocket.OPEN) {
                   const audioMessage = {
                     realtimeInput: {
                       audio: { mimeType: "audio/pcm;rate=16000", data: base64pcm }
                     }
                   };
                   wsRef.current.send(JSON.stringify(audioMessage));
                 }
              });
            }, 500);
          }

          if (payload.serverContent) {
             const content = payload.serverContent;
             
             if (content.interrupted) {
                addLog("Interrupted by user.", "system");
                playerRef.current?.stop();
                finalizeStream('model');
                finalizeStream('user');
                setAppState('listening');
             }

             if (content.modelTurn) {
                finalizeStream('user');
                if (content.modelTurn.parts) {
                   for (const part of content.modelTurn.parts) {
                     if (part.text) {
                        addLog(part.text, "model", true);
                     }
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

  const stopSession = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    
    playerRef.current?.stop();
    playerRef.current = null;
    
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.warn);
      wakeLockRef.current = null;
    }
    
    setAppState(prev => {
      if (prev !== 'idle' && prev !== 'error') {
         // trigger feedback generation
         setTimeout(() => triggerFeedbackGeneration(), 100);
         return 'idle';
      }
      return prev;
    });
  }, []);

  const triggerFeedbackGeneration = () => {
    // Cannot access latest state directly in closure smoothly, so we use logs from outside dependency
    // but React guarantees state if we use a ref or just rely on the effect. Let's do it directly.
  };

  const generateFeedback = useCallback(async (recentLogs: LogMessage[]) => {
    setIsGeneratingFeedback(true);
    setSessionFeedback('');
    try {
      const logsStr = recentLogs.map(l => `${l.sender === 'user' ? 'Me' : 'Coach'}: ${l.text}`).join('\n');
      const feedback = await generateReflexFeedback(geminiApiKey, geminiModel, logsStr, trainingLevel, grammarTheme);
      setSessionFeedback(feedback);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [geminiApiKey, geminiModel]);

  // A more robust way to trigger feedback capturing the latest logs at stop
  const performStop = () => {
     stopSession();
     
     const startIndex = sessionStartAfterIdRef.current 
        ? logs.findIndex(l => l.id === sessionStartAfterIdRef.current) + 1
        : 0;
     const validStartIndex = startIndex > 0 ? startIndex : 0;
     
     const recentLogs = logs.slice(validStartIndex);
     if (recentLogs.filter(l => l.sender === 'user').length > 0) {
        generateFeedback(recentLogs);
     }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

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
    connecting: 'var(--warning)',
    listening: 'var(--brand-primary)',
    processing: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    error: 'var(--error)'
  };

  const currentColor = statusColors[appState];

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', margin: 0, fontSize: '1.25rem' }}>
          <GraduationCap size={20} /> REFLEX
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={trainingLevel}
            onChange={(e) => setTrainingLevel(e.target.value as CEFRLevel)}
            disabled={appState !== 'idle' && appState !== 'error'}
            style={{ 
              padding: '0.4rem 0.5rem', 
              borderRadius: '4px', 
              backgroundColor: 'var(--brand-light)',
              color: 'var(--brand-primary)',
              border: '1px solid var(--brand-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: (appState === 'idle' || appState === 'error') ? 'pointer' : 'not-allowed'
            }}
          >
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => (
              <option key={level} value={level} style={{ backgroundColor: 'var(--bg-primary)' }}>CEFR: {level}</option>
            ))}
          </select>
          
          <select
            value={grammarTheme}
            onChange={(e) => setGrammarTheme(e.target.value)}
            disabled={appState !== 'idle' && appState !== 'error'}
            style={{ 
              padding: '0.4rem 0.5rem', 
              borderRadius: '4px', 
              backgroundColor: 'var(--brand-light)',
              color: 'var(--brand-primary)',
              border: '1px solid var(--brand-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: (appState === 'idle' || appState === 'error') ? 'pointer' : 'not-allowed',
              maxWidth: '90px',
              textOverflow: 'ellipsis'
            }}
          >
            {GRAMMAR_THEMES.map(theme => (
              <option key={theme.value} value={theme.value} style={{ backgroundColor: 'var(--bg-primary)' }}>{theme.label}</option>
            ))}
          </select>

          {appState === 'idle' || appState === 'error' ? (
            <button 
              onClick={startSession}
              style={{ ...btnBaseStyles, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-light)' }}
            >
              <Mic size={16} /> START
            </button>
          ) : (
            <button 
              onClick={performStop}
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
        <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'var(--brand-light)', border: '1px solid var(--brand-primary)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)' }}>
          <Loader size={16} className="animate-spin" />
          GENERATING SESSION FEEDBACK...
        </div>
      )}

      {sessionFeedback && !isGeneratingFeedback && (
        <div className="animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', position: 'relative' }}>
          <button 
            onClick={() => setSessionFeedback('')}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', opacity: 0.7 }}
          >
            <X size={18} />
          </button>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Session Feedback
          </h4>
          <div className="markdown-body" style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <ReactMarkdown>{sessionFeedback}</ReactMarkdown>
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        fontFamily: "'Fira Code', monospace",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', zIndex: 10 }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--brand-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            TRAINING_STREAM_LOG
          </h3>
          {logs.length > 0 && (
            <button 
              onClick={clearLogs}
              style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
            >
              <Trash2 size={12} /> CLEAR
            </button>
          )}
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Select a level and START to begin...</div>
          ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '0.5rem',
                color: log.sender === 'model' ? 'var(--brand-primary)' : log.sender === 'user' ? 'var(--text-tertiary)' : 'var(--brand-primary)',
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
