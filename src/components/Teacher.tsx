import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, Loader, AlertTriangle, LogOut, BookOpen, Clock, FileText } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { fetchGoogleDocText } from '../utils/googleDocs';
import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';

// --- Types ---
type LessonDuration = 10 | 20 | 30;
type LiveState = 'setup' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'evaluating' | 'error';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

interface TeacherProps {
  googleClientId: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiVoice: string;
  docId: string;
}

export default function Teacher({ googleClientId, geminiApiKey, geminiModel, geminiVoice, docId }: TeacherProps) {
  // App state
  const [appState, setAppState] = useState<LiveState>('setup');
  const [duration, setDuration] = useState<LessonDuration>(10);
  const [errorDetails, setErrorDetails] = useState("");

  // Storage and Auth
  const { token, isReady, login } = useGoogleAuth(googleClientId);
  const [studentMemory, setStudentMemory] = useLocalStorage<string>('uknow_teacher_memory', '');
  const [logs, setLogs] = useState<LogMessage[]>([]); // We don't need to persist logs forever, just for eval

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);

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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startLesson = async () => {
    if (!geminiApiKey) {
      setErrorDetails("Gemini API Key is missing.");
      return;
    }
    if (!token) {
        login();
        return;
    }
    if (!docId) {
        setErrorDetails("Document ID is missing. Configure it in Settings.");
        return;
    }

    try {
      setAppState('connecting');
      setErrorDetails("");
      setLogs([]); // clear logs for new lesson

      addLog("Fetching your notes from Google Docs...", "system");
      const docText = await fetchGoogleDocText(docId, token);
      if (!docText) throw new Error("Document is empty or could not be accessed.");
      addLog("Notes fetched successfully.", "system");

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

      ws.onopen = () => {
        addLog(`Connected to Teacher API`, "system");

        const systemPrompt = `You are a friendly, bright, smart, and encouraging English tutor.
You will be giving a ${duration}-minute English lesson to a student.

Here are the student's study notes from Google Docs:
<notes>
${docText.substring(0, 5000)} // Limiting size just in case
</notes>

Here is what you know about the student's level and previous weaknesses:
<student_profile>
${studentMemory || 'No previous data. Assume intermediate level initially.'}
</student_profile>

Instructions:
1. Greet the student brightly and kindly.
2. Propose a short lesson plan based on their notes (e.g., practicing a specific grammar point, vocabulary, or doing a roleplay).
3. Lead the lesson step by step. Ask questions, wait for their answer, and provide gentle, helpful corrections.
4. Keep track of the time. The lesson should last approximately ${duration} minutes. Wrap up gracefully when time is up.
5. Speak naturally, do not sound like a robot. Be conversational and highly supportive.`;

        const setupMsg = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
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
        handleEndSession(false);
        if (event.code !== 1000) {
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
            addLog("Lesson started! Teacher is listening...", "system");

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
      addLog(`Failed to start lesson: ${e.message}`, "system");
    }
  };

  const handleEndSession = async (manualEnd: boolean = true) => {
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

    if (manualEnd && logs.length > 2) {
       await evaluateSession();
    } else {
       setAppState('setup');
    }
  };

  const evaluateSession = async () => {
     setAppState('evaluating');
     try {
         // Gather full transcript
         const transcript = logs.map(l => `${l.sender.toUpperCase()}: ${l.text}`).join('\n');

         const prompt = `Based on the following English lesson transcript, evaluate the student's current English level and identify their specific weaknesses (grammar, pronunciation, vocabulary, fluency, etc.). Provide a concise summary that can be saved as a profile for future lessons.
Keep it under 300 words.

<transcript>
${transcript}
</transcript>`;

         const { GoogleGenerativeAI } = await import('@google/generative-ai');
         const genAI = new GoogleGenerativeAI(geminiApiKey);
         const model = genAI.getGenerativeModel({ model: geminiModel }); // use the standard model for text eval

         const result = await model.generateContent(prompt);
         const text = result.response.text();

         if (text) {
             setStudentMemory(text);
         }
     } catch (e) {
         console.error("Evaluation failed", e);
     } finally {
         setAppState('setup');
     }
  };


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
    setup: '#aaa',
    connecting: '#ffaa00',
    listening: '#00ff41',
    processing: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    evaluating: '#a855f7',
    error: '#ff3333'
  };

  const currentColor = statusColors[appState];

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem' }}>
          <BookOpen size={20} className="text-gradient" /> AI TEACHER
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {appState === 'setup' || appState === 'error' ? (
            <button
              onClick={startLesson}
              style={{ ...btnBaseStyles, color: 'var(--brand-primary)', backgroundColor: 'var(--bg-secondary)' }}
              disabled={!token && !isReady}
            >
              <Mic size={16} /> START LESSON
            </button>
          ) : appState === 'evaluating' ? (
             <span style={{ fontSize: '0.875rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader size={16} className="animate-spin"/> Evaluating...
             </span>
          ) : (
            <button
              onClick={() => handleEndSession(true)}
              style={{ ...btnBaseStyles, color: '#ff3333', backgroundColor: 'rgba(255, 51, 51, 0.1)' }}
            >
              <LogOut size={16} /> END LESSON
            </button>
          )}

          {appState !== 'setup' && appState !== 'evaluating' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold',
                color: currentColor, backgroundColor: 'rgba(0,0,0,0.4)',
                padding: '0.4rem 0.75rem', borderRadius: '4px',
                border: `1px solid ${currentColor}22`, fontSize: '0.85rem'
              }}>
                {(appState === 'connecting' || appState === 'processing') && <Loader size={14} className="animate-spin" />}
                {appState === 'error' && <AlertTriangle size={14} />}
                {appState === 'listening' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentColor, boxShadow: `0 0 8px ${currentColor}`, animation: 'pulse 1.5s infinite' }}></div>}
                {appState === 'speaking' && <Globe size={14} className="animate-pulse" />}
                <span style={{ letterSpacing: '1px' }}>{appState.toUpperCase()}</span>
              </div>
          )}
        </div>
      </div>

      {errorDetails && (
         <div style={{ padding: '1rem', marginBottom: '1rem', color: '#ff3333', backgroundColor: 'rgba(255,0,0,0.1)', border: '1px solid #ff3333', borderRadius: '4px' }}>
            <AlertTriangle size={18} style={{ marginBottom: '0.5rem' }}/> {errorDetails}
         </div>
      )}

      {appState === 'setup' ? (
         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem', flex: 1 }}>
             <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
                 <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>
                     <Clock size={18}/> Lesson Duration
                 </h3>
                 <div style={{ display: 'flex', gap: '1rem' }}>
                    {[10, 20, 30].map(mins => (
                        <button
                            key={mins}
                            onClick={() => setDuration(mins as LessonDuration)}
                            className={`btn ${duration === mins ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {mins} Minutes
                        </button>
                    ))}
                 </div>
             </div>

             <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', margin: 0 }}>
                     <FileText size={18}/> Student Profile Memory
                 </h3>
                 {studentMemory ? (
                     <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', flex: 1, overflowY: 'auto' }}>
                         {studentMemory}
                     </div>
                 ) : (
                     <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                         No previous evaluation found. Take a lesson to build your profile!
                     </p>
                 )}
             </div>
         </div>
      ) : (
        <div style={{
            flex: 1,
            backgroundColor: '#111',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.filter(l => l.sender !== 'system').length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                    The lesson is starting...
                </div>
            ) : (
            logs.map((log) => {
                if (log.sender === 'system') return null; // hide system logs for cleaner UI
                const isUser = log.sender === 'user';
                return (
                    <div
                        key={log.id}
                        style={{
                            alignSelf: isUser ? 'flex-end' : 'flex-start',
                            backgroundColor: isUser ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                            color: isUser ? '#fff' : 'var(--text-primary)',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            borderBottomRightRadius: isUser ? '0' : '12px',
                            borderBottomLeftRadius: isUser ? '12px' : '0',
                            maxWidth: '80%',
                            fontSize: '0.95rem',
                            lineHeight: 1.5
                        }}
                    >
                        {log.text}
                    </div>
                );
            })
            )}
            <div ref={logEndRef} />
            </div>
        </div>
      )}
    </div>
  );
}
