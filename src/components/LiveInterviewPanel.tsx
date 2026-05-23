import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, AlertTriangle, LogOut } from 'lucide-react';
import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';

type LiveState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

interface LiveInterviewPanelProps {
  geminiApiKey: string;
  geminiVoice: string;
  systemInstruction: string;
  onSessionEnd: (userTranscript: string, allLogs: LogMessage[]) => void;
  lang?: 'ja' | 'en';
}

export default function LiveInterviewPanel({ geminiApiKey, geminiVoice, systemInstruction, onSessionEnd, lang = 'ja' }: LiveInterviewPanelProps) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [errorDetails, setErrorDetails] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
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

  const startSession = async () => {
    if (!geminiApiKey) return;

    try {
      setAppState('connecting');
      setErrorDetails("");
      setLogs([]);
      playerRef.current = new AudioStreamPlayer();
      recorderRef.current = new AudioRecorder();

      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); }
        catch (err: any) { console.warn("Wake lock failed:", err); }
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        const setupMsg = {
          setup: {
            model: modelOverride,
            generationConfig: { 
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiVoice } } }
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onclose = (event) => {
        cleanup();
        if (event.code !== 1000 && event.code !== 1005) {
           setErrorDetails(`Disconnected: ${event.code}`);
           setAppState('error');
        } else {
           setAppState('idle');
        }
      };

      ws.onerror = (e) => {
        console.error("LiveInterview WebSocket Error", e);
        setAppState('error');
      };

      ws.onmessage = async (event) => {
        let msgStr = event.data instanceof Blob ? await event.data.text() : event.data;
        try {
          const payload = JSON.parse(msgStr);

          if (payload.setupComplete) {
            setAppState('listening');
            
            // Just delay start to avoid 1008 race condition
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
    }
  };

  const cleanup = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    playerRef.current?.stop();
    playerRef.current = null;
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.warn);
      wakeLockRef.current = null;
    }
  }, []);

  const stopSession = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       wsRef.current.close(1000);
    }
    wsRef.current = null;
    cleanup();
    setAppState('idle');
    
    // Aggregate user transcript
    const userText = logs.filter(l => l.sender === 'user').map(l => l.text).join('\n');
    onSessionEnd(userText, logs);
  }, [cleanup, logs, onSessionEnd]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanup();
    };
  }, [cleanup]);

  const currentColor = appState === 'speaking' ? 'var(--brand-primary)' : appState === 'listening' ? 'var(--brand-primary)' : 'var(--text-tertiary)';

  return (
    <div style={{ padding: '1rem', border: '1px solid currentColor', borderRadius: '8px', color: currentColor, marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {appState === 'idle' ? <Mic size={18} /> : appState === 'speaking' ? <Globe size={18} className="animate-pulse"/> : <div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: currentColor, animation: 'pulse 1.5s infinite'}}/>}
          Real-time Interview {lang === 'ja' ? '(日本語)' : '(English)'}
        </h4>
        
        {appState === 'idle' && (
           <button onClick={startSession} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', backgroundColor: 'var(--brand-light)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
             START INTERVIEW
           </button>
        )}
        
        {appState !== 'idle' && appState !== 'error' && (
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <span style={{ fontSize: '0.8rem' }}>{appState.toUpperCase()}...</span>
             <button onClick={stopSession} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
               <LogOut size={14} /> FINISH
             </button>
           </div>
        )}
      </div>

      {errorDetails && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}><AlertTriangle size={14} /> {errorDetails}</div>}

      <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {logs.map((log) => (
          <div key={log.id} style={{ marginBottom: '0.5rem', color: log.sender === 'model' ? currentColor : 'var(--text-tertiary)' }}>
            <span style={{ opacity: 0.7 }}>{log.sender === 'user' ? 'You: ' : 'AI: '}</span>
            {log.text}
          </div>
        ))}
      </div>
    </div>
  );
}
