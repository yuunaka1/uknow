import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, Loader, AlertTriangle, Coffee, LogOut, CheckCircle } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';
import { generateFreeTalkFeedback } from '../utils/gemini';
import ReactMarkdown from 'react-markdown';

type LiveState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

export default function FreeTalk({ geminiApiKey, geminiModel, geminiVoice }: { geminiApiKey: string, geminiModel: string, geminiVoice: string }) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [errorDetails, setErrorDetails] = useState("");
  const [cefrLevel, setCefrLevel] = useLocalStorage('uknow_freetalk_cefr', 'B1');
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

      const systemPrompt = `You are an AI free-talk partner for English conversation practice. The interaction is live and open-ended.
The user's English level is roughly ${cefrLevel} on the CEFR scale. Adjust your vocabulary, speaking speed, and sentence complexity optimally for this level.
Your goal is to help me sustain the conversation and speak as much English as possible.
Proactively expand the conversation and provide topics when the conversation stalls.
Ask many helpful follow-up questions.
Act like a natural, supportive English conversation partner. DO NOT just answer neutrally; always create opportunities for me to speak.`;

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
        const msgStr = event.data instanceof Blob ? await event.data.text() : event.data;
        try {
          const payload = JSON.parse(msgStr);

          if (payload.setupComplete) {
            setAppState('listening');
            addLog("Setup complete. Say hello to start the free talk!", "system");
            
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
        const generated = await generateFreeTalkFeedback(geminiApiKey, geminiModel, fullLogStr);
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
    connecting: 'var(--warning)',
    listening: 'var(--warning)',
    processing: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    error: 'var(--error)'
  };

  const currentColor = statusColors[appState];

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', margin: 0, fontSize: '1.25rem' }}>
          <Coffee size={20} /> DIALOGUE
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>CEFR Level:</span>
            <select 
              value={cefrLevel}
              onChange={(e) => setCefrLevel(e.target.value)}
              disabled={appState !== 'idle' && appState !== 'error'}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontWeight: 'bold' }}
            >
              <option value="A1">A1 (Beginner)</option>
              <option value="A2">A2 (Elementary)</option>
              <option value="B1">B1 (Intermediate)</option>
              <option value="B2">B2 (Upper Intermediate)</option>
              <option value="C1">C1 (Advanced)</option>
              <option value="C2">C2 (Proficient)</option>
            </select>
          </div>

          {appState === 'idle' || appState === 'error' ? (
            <button 
              onClick={startSession}
              style={{ ...btnBaseStyles, color: 'var(--warning)', backgroundColor: 'var(--warning-bg)' }}
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
        <div style={{ padding: '1.5rem', marginBottom: '1rem', backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)' }}>
          <Loader className="animate-spin" size={20} />
          <span>セッションのフィードバックを生成中...</span>
        </div>
      )}

      {feedback && !isGeneratingFeedback && (
        <div style={{ padding: '1.5rem', marginBottom: '1rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', flexShrink: 0, maxHeight: '40vh', overflowY: 'auto' }}>
           <h3 style={{ margin: '0 0 1rem 0', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <CheckCircle size={20} /> セッションフィードバック
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
          <h3 style={{ fontSize: '0.9rem', color: 'var(--warning)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            DIALOGUE_STREAM_LOG
          </h3>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; WebSocketストリームを確立する準備ができました...</div>
          ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '0.5rem',
                color: log.sender === 'model' ? 'var(--warning)' : log.sender === 'user' ? 'var(--text-tertiary)' : 'var(--warning)',
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
