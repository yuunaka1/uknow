import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, Loader, AlertTriangle, Zap, LogOut, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// --- Types ---
type LiveState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';

// --- Component ---
export default function GeminiLive({ geminiApiKey, geminiVoice }: { geminiApiKey: string, geminiVoice: string }) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useLocalStorage<LogMessage[]>('uknow_geminilive_logs', []);
  const [errorDetails, setErrorDetails] = useState("");

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
    if (window.confirm("Clear Live session logs?")) setLogs([]);
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
      playerRef.current = new AudioStreamPlayer();
      recorderRef.current = new AudioRecorder();

      // Request Screen Wake Lock to prevent screen sleep
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          addLog("Screen wake lock acquired.", "system");
        } catch (err: any) {
          console.warn("Wake lock failed:", err);
        }
      }

      // 1. Establish WebSocket
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog(`Connected to Multimodal Live API (${modelOverride})`, "system");
        
        // 2. Send Setup Message
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
              parts: [{
                text: "You are a real-time bilingual interpreter. If the user speaks Japanese, translate it into natural spoken English. If the user speaks English, translate it into natural spoken Japanese. Speak only the exact translation. Do not answer questions, do not add filler words, and do not converse. Just echo the translated text in the target language."
              }]
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onclose = (event) => {
        stopSession();
        if (event.code !== 1000) { // Disconnected abnormally
           let detail = "";
           if (event.code === 1007) detail = "(1007: Unsupported Payload/Model Mismatch. Check if the model supports Live API.)";
           addLog(`Disconnected from API (${event.code}) ${detail}`, "system");
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
        // Blob to JSON parsing if necessary, Gemini WS sometimes returns string or Blob.
        let msgStr = "";
        if (event.data instanceof Blob) {
           msgStr = await event.data.text();
        } else {
           msgStr = event.data;
        }

        try {
          const payload = JSON.parse(msgStr);

          // Handle Setup Complete
          if (payload.setupComplete) {
            setAppState('listening');
            addLog("Setup complete. Starting microphone...", "system");
            
            // Delay start to avoid 1008 race condition
            setTimeout(async () => {
              if (wsRef.current?.readyState !== WebSocket.OPEN) return;
              // Start recording and streaming!
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

          // Handle Server Content (Responses)
          if (payload.serverContent) {
             const content = payload.serverContent;
             
             // Interrupt event
             if (content.interrupted) {
                addLog("Interrupted by user.", "system");
                playerRef.current?.stop();
                finalizeStream('model');
                finalizeStream('user');
                setAppState('listening');
             }

             // Model turn payload
             if (content.modelTurn) {
                finalizeStream('user'); // User's turn naturally ends when model starts answering
                if (content.modelTurn.parts) {
                   for (const part of content.modelTurn.parts) {
                     if (part.text) {
                        addLog(part.text, "model", true);
                     }
                     if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                        // Play audio
                        setAppState('speaking');
                        await playerRef.current?.playPcmData(part.inlineData.data);
                     }
                   }
                }
             }

             // Transcriptions
             if (content.inputTranscription && content.inputTranscription.text) {
                // User's voice transcription chunks
                addLog(content.inputTranscription.text, "user", true);
             }
             
             if (content.outputTranscription && content.outputTranscription.text) {
                // Model's voice transcription chunks
                addLog(content.outputTranscription.text, "model", true);
             }
             
             // Turn complete
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
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Release Screen Wake Lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.warn);
      wakeLockRef.current = null;
    }
    
    setAppState(prev => (prev !== 'idle' && prev !== 'error' ? 'idle' : prev));
  }, []);

  // Clean up on unmount
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', margin: 0, fontSize: '1.25rem' }}>
          <Zap size={20} /> MONOLOGUE MODE
        </h2>

        {/* Control Panel Inline */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {appState === 'idle' || appState === 'error' ? (
            <button 
              onClick={startSession}
              style={{ ...btnBaseStyles, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-light)' }}
            >
              <Mic size={16} /> START
            </button>
          ) : (
            <button 
              onClick={stopSession}
              style={{ ...btnBaseStyles, color: 'var(--error)', backgroundColor: 'var(--error-bg)' }}
            >
              <LogOut size={16} /> END
            </button>
          )}

          {/* State Indicator */}
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
         <div style={{ padding: '1rem', marginBottom: '2rem', color: 'var(--error)', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: '4px' }}>
            <AlertTriangle size={18} style={{ marginBottom: '0.5rem' }}/>
            <br />
            {errorDetails}
         </div>
      )}

      {/* Terminal Log */}
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
          <h3 style={{ fontSize: '0.9rem', color: 'var(--border-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            WS_LIVE_STREAM_LOG
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
            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Ready to establish WebSocket stream...</div>
          ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '0.5rem',
                color: log.sender === 'model' ? 'var(--brand-primary)' : log.sender === 'user' ? 'var(--text-tertiary)' : 'var(--border-color)',
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
