import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Square, Mic, MicOff, PlayCircle, XCircle, FileText, Bot, MonitorOff, MonitorSmartphone } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { transcribeAudioWithGemini, evaluateShadowingWithGemini } from '../utils/gemini';
import { sliceAudioFileToWav } from '../utils/audioEncoder';

export default function ShadowingPlayer({ geminiApiKey, geminiModel }: { geminiApiKey?: string, geminiModel: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  
  const [aPoint, setAPoint] = useState<number | null>(null);
  const [bPoint, setBPoint] = useState<number | null>(null);
  const [isAbRepeat, setIsAbRepeat] = useState<boolean>(false);
  const [targetLoops, setTargetLoops] = useState<number>(0);
  const [remainingLoops, setRemainingLoops] = useState<number>(0);
  
  const [isRecording, setIsRecording] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [keepAwake, setKeepAwake] = useLocalStorage('uknow_keep_awake', false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  
  const [shadowStartTime, setShadowStartTime] = useState<number>(0);
  const [shadowEndTime, setShadowEndTime] = useState<number>(0);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        }
      } catch (err) {
        console.error("Wake Lock error:", err);
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release().catch(console.error);
        wakeLockRef.current = null;
      }
    };

    if (isPlaying && keepAwake) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isPlaying, keepAwake]);

  // Load cached audio file on mount
  useEffect(() => {
    const loadCachedAudio = async () => {
      try {
        const cachedFile = await get<File>('uknow_shadowing_audio_file');
        if (cachedFile) {
          setFile(cachedFile);
          const url = URL.createObjectURL(cachedFile);
          setAudioUrl(url);
        }
      } catch (err) {
        console.error("Failed to load cached audio:", err);
      }
    };
    loadCachedAudio();
  }, []);

  // Audio Playback Controls
  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
      audioRef.current.pause();
      stopRecording();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (autoRecord) {
        await startRecording();
      }
      
      playTimeoutRef.current = window.setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.error("Play error:", e));
        }
      }, 1500);
    }
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    if (playTimeoutRef.current) {
      window.clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    const endTime = audioRef.current.currentTime;
    audioRef.current.pause();
    // 確実に先頭に戻す
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    stopRecording(endTime);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    setCurrentTime(current);
    
    if (isAbRepeat && aPoint !== null && bPoint !== null) {
      if (current >= bPoint) {
        if (targetLoops === 0) {
          stopAudio();
          audioRef.current.currentTime = aPoint;
          return;
        }
        if (targetLoops > 0) {
          if (remainingLoops <= 1) {
            stopAudio();
            setRemainingLoops(targetLoops);
            audioRef.current.currentTime = aPoint;
            return;
          }
          setRemainingLoops(prev => prev - 1);
        }
        audioRef.current.currentTime = aPoint;
      }
    }
  };

  const handleEnded = () => {
    if (!audioRef.current) return;
    if (targetLoops === 0) {
      stopAudio();
      return;
    }
    if (targetLoops > 0) {
      if (remainingLoops <= 1) {
        stopAudio();
        setRemainingLoops(targetLoops);
        return;
      }
      setRemainingLoops(prev => prev - 1);
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // A-B Repeat Controls
  const markA = () => setAPoint(currentTime);
  const markB = () => {
    if (aPoint !== null && currentTime > aPoint) {
      setBPoint(currentTime);
      setIsAbRepeat(true);
    }
  };
  const clearAB = () => {
    setAPoint(null);
    setBPoint(null);
    setIsAbRepeat(false);
  };

  // Speed Control
  const changeSpeed = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = Number(e.target.value);
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current.preservesPitch = false;
      // @ts-expect-error Vendor prefix for Firefox
      audioRef.current.mozPreservesPitch = false;
      // @ts-expect-error Vendor prefix for Safari
      audioRef.current.webkitPreservesPitch = false;
    }
  };

  const handleLoopTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setTargetLoops(val);
    setRemainingLoops(val);
  };

  // File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
      clearAB();

      try {
        await set('uknow_shadowing_audio_file', selectedFile);
      } catch (err) {
        console.error('Failed to cache audio file:', err);
      }
    }
  };

  // Recording Controls
  const startRecording = async () => {
    if (isRecording) return;
    if (audioRef.current) {
      setShadowStartTime(audioRef.current.currentTime);
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const actualType = audioChunksRef.current[0]?.type || '';
        const mimeType = actualType || (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedUrl(url);
        setRecordedBlob(audioBlob);
        setTranscription(null);
        setEvaluation(null);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed", err);
      alert("マイクへのアクセスが許可されていません。");
      setAutoRecord(false);
    }
  };

  const stopRecording = (forcedEndTime?: number) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const eTime = forcedEndTime !== undefined ? forcedEndTime : (audioRef.current?.currentTime || 0);
      setShadowEndTime(eTime);
      mediaRecorderRef.current.stop();
    }
  };

  const toggleAutoRecord = () => {
    const nextAuto = !autoRecord;
    setAutoRecord(nextAuto);
    if (nextAuto && isPlaying && !isRecording) {
      startRecording();
    } else if (!nextAuto && isRecording) {
      stopRecording();
    }
  };

  const handleTranscribe = async () => {
    if (!recordedBlob || !geminiApiKey) return;
    setIsTranscribing(true);
    setTranscription(null);
    try {
      const result = await transcribeAudioWithGemini(geminiApiKey, recordedBlob, geminiModel);
      setTranscription(result);
    } catch (err) {
      console.error(err);
      alert("文字起こしに失敗しました。APIキーが正しく設定されているか確認してください。");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleEvaluate = async () => {
    if (!file || !recordedBlob || !geminiApiKey) return;
    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const sourceWav = await sliceAudioFileToWav(file, shadowStartTime, shadowEndTime);
      const result = await evaluateShadowingWithGemini(geminiApiKey, sourceWav, recordedBlob, geminiModel);
      setEvaluation(result);
    } catch (err) {
      console.error(err);
      alert("評価中にエラーが発生しました。ファイルが長すぎる場合などに失敗することがあります。");
    } finally {
      setIsEvaluating(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  const btnStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: 'var(--brand-primary)',
    border: '1px solid var(--brand-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
  };

  return (
    <div className="glass-panel" style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
      <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PlayCircle size={24} /> ShadowTerm Web
        </h2>
        <p style={{ margin: '0.5rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
          Standalone audio player for shadowing practice.
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ ...btnStyle, display: 'inline-flex' }}>
          <Upload size={18} /> Load Audio File
          <input 
            type="file" 
            accept="audio/*, audio/mp3, audio/mpeg, audio/mp4, audio/wav, audio/x-m4a, .mp3, .m4a, .wav"
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
        </label>
        {file && <span style={{ marginLeft: '1rem', opacity: 0.8 }}>Loaded: {file.name}</span>}
      </div>

      {audioUrl && (
        <div style={{ backgroundColor: 'var(--brand-light)', padding: 'clamp(0.5rem, 2vw, 1rem)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
          <audio 
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onEnded={handleEnded}
          />

          {/* Time & Seek Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ minWidth: '40px' }}>{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min={0} 
              max={duration} 
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              style={{ flex: 1, accentColor: 'var(--brand-primary)' }}
            />
            <span style={{ minWidth: '40px' }}>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <button onClick={togglePlay} style={{ ...btnStyle, backgroundColor: 'var(--brand-light)' }}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            <button onClick={stopAudio} style={btnStyle}>
              <Square size={18} /> STOP
            </button>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />

            <select 
              value={targetLoops} 
              onChange={handleLoopTargetChange}
              style={{ ...btnStyle, backgroundColor: 'var(--bg-primary)', appearance: 'none', textAlign: 'center', opacity: targetLoops === 0 ? 0.5 : 1 }}
            >
              <option value={0} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>REPEAT: OFF</option>
              <option value={-1} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>REPEAT: INF</option>
              <option value={5} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>REPEAT: 5</option>
              <option value={10} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>REPEAT: 10</option>
              <option value={20} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>REPEAT: 20</option>
              <option value={30} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>REPEAT: 30</option>
            </select>

            {targetLoops > 0 && (
              <span style={{ fontSize: '1rem', color: 'var(--brand-primary)', fontWeight: 'bold' }}>
                [{remainingLoops} / {targetLoops}]
              </span>
            )}

            <select 
              value={playbackRate} 
              onChange={changeSpeed}
              style={{ ...btnStyle, backgroundColor: 'var(--bg-primary)', appearance: 'none', textAlign: 'center' }}
            >
              <option value={0.75} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>0.75x SPD</option>
              <option value={0.80} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>0.80x SPD</option>
              <option value={0.85} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>0.85x SPD</option>
              <option value={0.90} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>0.90x SPD</option>
              <option value={0.95} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>0.95x SPD</option>
              <option value={1.00} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>1.00x SPD</option>
              <option value={1.05} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>1.05x SPD</option>
              <option value={1.10} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>1.10x SPD</option>
              <option value={1.15} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>1.15x SPD</option>
              <option value={1.20} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>1.20x SPD</option>
              <option value={1.25} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--brand-primary)' }}>1.25x SPD</option>
            </select>
          </div>

          {/* A-B Repeat Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', flexWrap: 'wrap', padding: 'clamp(0.5rem, 2vw, 1rem)', backgroundColor: 'var(--bg-primary)', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>A-B REPEAT:</span>
            <button onClick={markA} style={btnStyle}>
              [A] {aPoint !== null ? formatTime(aPoint) : 'MARK'}
            </button>
            <button onClick={markB} disabled={aPoint === null} style={{ ...btnStyle, opacity: aPoint === null ? 0.3 : 1 }}>
              [B] {bPoint !== null ? formatTime(bPoint) : 'MARK'}
            </button>
            {isAbRepeat && (
              <button onClick={clearAB} style={btnStyle}>
                <XCircle size={18} /> CLEAR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recording Section */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-color)' }}>
        <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>// Audio Shadowing</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={toggleAutoRecord} 
            style={{ ...btnStyle, backgroundColor: autoRecord ? 'var(--brand-light)' : 'transparent' }}
          >
            {autoRecord ? <Mic size={18} /> : <MicOff size={18} />}
            {autoRecord ? 'AUTO REC: ON' : 'AUTO REC: OFF'}
          </button>
          
          <button 
            onClick={() => setKeepAwake(!keepAwake)} 
            style={{ ...btnStyle, backgroundColor: keepAwake ? 'var(--brand-light)' : 'transparent' }}
          >
            {keepAwake ? <MonitorSmartphone size={18} /> : <MonitorOff size={18} />}
            {keepAwake ? 'WAKE LOCK: ON' : 'WAKE LOCK: OFF'}
          </button>
          
          {isRecording && <span style={{ color: 'var(--error)', animation: 'pulse 1.5s infinite' }}>● Recording</span>}
        </div>

        {recordedUrl && !isRecording && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Recorded VCE:</span>
            <audio src={recordedUrl} controls style={{ height: '32px' }} />
            
            {geminiApiKey && (
              <>
                <button 
                  onClick={handleTranscribe} 
                  style={{ ...btnStyle, opacity: isTranscribing ? 0.5 : 1 }} 
                  disabled={isTranscribing || isEvaluating}
                >
                  <FileText size={18} />
                  {isTranscribing ? 'TRANSCRIBING...' : 'TRANSCRIBE'}
                </button>
                <button 
                  onClick={handleEvaluate} 
                  style={{ ...btnStyle, opacity: isEvaluating ? 0.5 : 1, borderColor: 'var(--warning)', color: 'var(--warning)' }}
                  disabled={isEvaluating || isTranscribing}
                >
                  <Bot size={18} />
                  {isEvaluating ? 'EVALUATING...' : 'EVALUATE !'}
                </button>
              </>
            )}
          </div>
        )}

        {transcription && (
          <div style={{ marginTop: '1rem', padding: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: 'var(--brand-light)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem' }}>// TRANSCRIPTION RESULT:</span>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {transcription}
            </p>
          </div>
        )}

        {evaluation && (
          <div style={{ marginTop: '1rem', padding: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: '4px', overflowX: 'auto' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem', color: 'var(--warning)' }}>// EVALUATION RESULT:</span>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text-primary)fff' }}>
              {evaluation}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
