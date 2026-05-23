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

  return (
    <div className="glass-panel" style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
      <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PlayCircle size={24} /> シャドーイング プレイヤー
        </h2>
        <p style={{ margin: '0.5rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
          シャドーイング練習用のオーディオプレイヤーです。
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="btn btn-secondary" style={{ display: 'inline-flex' }}>
          <Upload size={18} /> 音声ファイルを読み込む
          <input 
            type="file" 
            accept="audio/*, audio/mp3, audio/mpeg, audio/mp4, audio/wav, audio/x-m4a, .mp3, .m4a, .wav"
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
        </label>
        {file && <span style={{ marginLeft: '1rem', opacity: 0.8 }}>読込済: {file.name}</span>}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            <button className="btn btn-primary" onClick={togglePlay}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? '一時停止' : '再生'}
            </button>
            <button className="btn btn-secondary" onClick={stopAudio}>
              <Square size={18} /> 停止
            </button>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />

            <select 
              value={targetLoops} 
              onChange={handleLoopTargetChange}
              className="btn btn-secondary"
              style={{ appearance: 'none', textAlign: 'center', opacity: targetLoops === 0 ? 0.6 : 1 }}
            >
              <option value={0}>リピート: オフ</option>
              <option value={-1}>リピート: 無限</option>
              <option value={5}>リピート: 5</option>
              <option value={10}>リピート: 10</option>
              <option value={20}>リピート: 20</option>
              <option value={30}>リピート: 30</option>
            </select>

            {targetLoops > 0 && (
              <span style={{ fontSize: '1rem', color: 'var(--brand-primary)', fontWeight: '500' }}>
                [{remainingLoops} / {targetLoops}]
              </span>
            )}

            <select 
              value={playbackRate} 
              onChange={changeSpeed}
              className="btn btn-secondary"
              style={{ appearance: 'none', textAlign: 'center' }}
            >
              <option value={0.75}>0.75x 速度</option>
              <option value={0.80}>0.80x 速度</option>
              <option value={0.85}>0.85x 速度</option>
              <option value={0.90}>0.90x 速度</option>
              <option value={0.95}>0.95x 速度</option>
              <option value={1.00}>1.00x 速度</option>
              <option value={1.05}>1.05x 速度</option>
              <option value={1.10}>1.10x 速度</option>
              <option value={1.15}>1.15x 速度</option>
              <option value={1.20}>1.20x 速度</option>
              <option value={1.25}>1.25x 速度</option>
            </select>
          </div>

          {/* A-B Repeat Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>A-B リピート:</span>
            <button className="btn btn-secondary" onClick={markA}>
              [A] {aPoint !== null ? formatTime(aPoint) : 'マーク'}
            </button>
            <button className="btn btn-secondary" onClick={markB} disabled={aPoint === null}>
              [B] {bPoint !== null ? formatTime(bPoint) : 'マーク'}
            </button>
            {isAbRepeat && (
              <button className="btn btn-ghost" onClick={clearAB}>
                <XCircle size={18} /> クリア
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recording Section */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-color)' }}>
        <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>// 音声シャドーイング</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={toggleAutoRecord} 
            className={`btn ${autoRecord ? 'btn-primary' : 'btn-secondary'}`}
          >
            {autoRecord ? <Mic size={18} /> : <MicOff size={18} />}
            {autoRecord ? '自動録音: オン' : '自動録音: オフ'}
          </button>
          
          <button 
            onClick={() => setKeepAwake(!keepAwake)} 
            className={`btn ${keepAwake ? 'btn-primary' : 'btn-secondary'}`}
          >
            {keepAwake ? <MonitorSmartphone size={18} /> : <MonitorOff size={18} />}
            {keepAwake ? 'スリープ防止: オン' : 'スリープ防止: オフ'}
          </button>
          
          {isRecording && <span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }} className="animate-pulse">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--error)' }} />
            録音中...
          </span>}
        </div>

        {recordedUrl && !isRecording && (
          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>録音データ:</span>
            <audio src={recordedUrl} controls style={{ height: '36px' }} />
            
            {geminiApiKey && (
              <>
                <button 
                  onClick={handleTranscribe} 
                  className="btn btn-secondary"
                  disabled={isTranscribing || isEvaluating}
                >
                  <FileText size={18} />
                  {isTranscribing ? '文字起こし中...' : '文字起こし'}
                </button>
                <button 
                  onClick={handleEvaluate} 
                  className="btn btn-secondary"
                  style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
                  disabled={isEvaluating || isTranscribing}
                >
                  <Bot size={18} />
                  {isEvaluating ? '評価中...' : '評価する！'}
                </button>
              </>
            )}
          </div>
        )}

        {transcription && (
          <div style={{ marginTop: '1rem', padding: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: 'var(--brand-light)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem' }}>// 文字起こし結果:</span>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {transcription}
            </p>
          </div>
        )}

        {evaluation && (
          <div style={{ marginTop: '1rem', padding: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: '4px', overflowX: 'auto' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem', color: 'var(--warning)' }}>// 評価結果:</span>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text-primary)fff' }}>
              {evaluation}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
