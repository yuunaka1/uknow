import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Mic, Play, Square, RefreshCcw, Loader, AlertTriangle, FileText, ImageIcon } from 'lucide-react';
import { evaluatePhotoDescriptionWithGemini, generateToeicImagePrompt } from '../utils/gemini';
import ReactMarkdown from 'react-markdown';

type PracticePhase = 'idle' | 'prep' | 'speaking' | 'evaluating' | 'result' | 'error';

export default function PhotoDescription({ geminiApiKey, geminiModel }: { geminiApiKey: string, geminiModel: string }) {
  const [phase, setPhase] = useState<PracticePhase>('idle');
  const [currentPhoto, setCurrentPhoto] = useState({ url: '', title: '' });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultMarkdown, setResultMarkdown] = useState("");
  
  // Audio state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer reference
  const timerRef = useRef<number | null>(null);

  const generateNewPhoto = useCallback(async () => {
    if (!geminiApiKey) return;
    setIsGeneratingImage(true);
    setErrorMsg('');
    try {
      // 1. Ask Gemini to come up with a creative TOEIC scene prompt
      const prompt = await generateToeicImagePrompt(geminiApiKey, geminiModel);
      
      // 2. Fetch the image from Pollinations AI using the generated prompt
      const encodedPrompt = encodeURIComponent(prompt);
      const cacheBuster = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true&seed=${cacheBuster}`;
      
      setCurrentPhoto({ url, title: prompt });
      setPhase('idle');
      setResultMarkdown("");
    } catch (e: any) {
      console.error(e);
      setErrorMsg("画像の生成に失敗しました: " + e.message);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [geminiApiKey, geminiModel]);

  // Generate initial photo on mount
  useEffect(() => {
    let mounted = true;
    if (mounted && !currentPhoto.url && !isGeneratingImage) {
      generateNewPhoto();
    }
    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPhoto.url, generateNewPhoto, isGeneratingImage]);

  const startPrep = () => {
    setPhase('prep');
    setTimeLeft(45); // 45 seconds prep
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          startSpeaking();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startSpeaking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await processEvaluation(audioBlob);
      };

      mediaRecorder.start();
      setPhase('speaking');
      setTimeLeft(45); // 45 seconds speak

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            stopSpeaking();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (e: any) {
      console.error(e);
      setErrorMsg("マイクへのアクセスが拒否されたか、エラーが発生しました。");
      setPhase('error');
    }
  };

  const stopTimer = () => {
     if (timerRef.current) clearInterval(timerRef.current);
  }

  const stopSpeaking = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const processEvaluation = async (audioBlob: Blob) => {
    setPhase('evaluating');
    try {
      // Fetch the generated AI image to get a blob for Gemini Multimodal API evaluation
      // Using an empty cors object or just fetching again usually works with pollinations because it allows cors
      const imgResponse = await fetch(currentPhoto.url);
      const imgBlob = await imgResponse.blob();

      const evaluation = await evaluatePhotoDescriptionWithGemini(
        geminiApiKey,
        imgBlob,
        audioBlob,
        geminiModel
      );
      
      setResultMarkdown(evaluation);
      setPhase('result');

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "評価中にエラーが発生しました。");
      setPhase('error');
    }
  };
  
  const resetPractice = () => {
    stopTimer();
    if (streamRef.current) {
       streamRef.current.getTracks().forEach(t => t.stop());
    }
    setPhase('idle');
    setResultMarkdown("");
    setTimeLeft(0);
  };

  // UI Setup
  const mainColor = phase === 'speaking' ? 'var(--error)' : phase === 'prep' ? 'var(--warning)' : 'var(--brand-primary)';
  const progressPercent = phase === 'prep' || phase === 'speaking' ? (timeLeft / 45) * 100 : 0;

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', margin: 0, fontSize: '1.25rem' }}>
          <Camera size={20} /> 写真描写
        </h2>
        
        {phase === 'result' && (
           <button 
             onClick={generateNewPhoto}
             className="btn btn-secondary"
             style={{ fontSize: '0.85rem' }}
             disabled={isGeneratingImage}
           >
             {isGeneratingImage ? <Loader size={16} className="animate-spin" /> : <ImageIcon size={16} />} 
             {isGeneratingImage ? ' 生成中...' : ' 次の写真'}
           </button>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: '4px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', flexDirection: 'row' }}>
        
        {/* Left Side: Photo Display & Controls */}
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ 
            width: '100%', 
            aspectRatio: '4/3', 
            backgroundColor: 'var(--bg-primary)',
            border: `2px solid ${phase === 'idle' || phase === 'result' ? 'var(--border-color)' : mainColor}`,
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: `0 0 15px ${(phase === 'prep' || phase === 'speaking') ? mainColor + '44' : 'transparent'}`
          }}>
            {isGeneratingImage || !currentPhoto.url ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--brand-primary)' }}>
                <Loader size={36} className="animate-spin" style={{ marginBottom: '1rem' }} />
                <span>AIが新しい画像を生成しています...</span>
              </div>
            ) : (
              <img 
                src={currentPhoto.url} 
                alt="TOEIC Scene" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onLoad={() => console.log('Image loaded')}
              />
            )}
          </div>
          
          {/* Timer Display */}
          {(phase === 'prep' || phase === 'speaking') && (
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)', border: `1px solid ${mainColor}`, borderRadius: '8px', padding: '1rem',
              color: 'white',
              boxShadow: `0 0 15px ${mainColor}22`
            }}>
               <div style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px', color: mainColor, marginBottom: '0.5rem' }}>
                 {phase === 'prep' ? '準備時間' : '解答時間'}
               </div>
               <div style={{ fontSize: '3rem', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </div>
               <div style={{ width: '80%', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: mainColor, transition: 'width 1s linear' }} />
               </div>
            </div>
          )}
          
          {/* Controls Below Photo */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            {phase === 'idle' && (
              <>
                <button className="btn btn-primary" onClick={startPrep} disabled={isGeneratingImage || !currentPhoto.url} style={{ padding: '0.75rem 2rem' }}>
                  <Play size={18} /> 練習を開始
                </button>
                <button className="btn btn-secondary" onClick={generateNewPhoto} disabled={isGeneratingImage} title="別の写真を生成" aria-label="別の写真を生成">
                  <RefreshCcw size={18} className={isGeneratingImage ? "animate-spin" : ""} />
                </button>
              </>
            )}
            
            {phase === 'prep' && (
              <button className="btn btn-primary" onClick={() => { if (timerRef.current) clearInterval(timerRef.current); startSpeaking(); }} style={{ padding: '0.75rem 2rem', backgroundColor: 'var(--brand-primary)', color: 'black' }}>
                <Mic size={18} /> スキップして解答開始
              </button>
            )}
            
            {phase === 'speaking' && (
              <button className="btn btn-secondary" onClick={() => { if (timerRef.current) clearInterval(timerRef.current); stopSpeaking(); }} style={{ padding: '0.75rem 2rem', color: 'var(--error)', borderColor: 'var(--error)' }}>
                <Square size={18} /> 解答を終了
              </button>
            )}

            {(phase === 'prep' || phase === 'speaking' || phase === 'error' || phase === 'result') && (
              <button className="btn btn-secondary" onClick={resetPractice} title="中止/リセット">
                <RefreshCcw size={18} /> 中止
              </button>
            )}
          </div>

          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            <p><strong>ルール:</strong> 準備時間として45秒、その後、写真について話す解答時間が45秒与えられます。</p>
            {phase === 'evaluating' && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', padding: '1rem', backgroundColor: 'var(--brand-light)', borderRadius: '4px' }}>
                 <Loader size={18} className="animate-spin" /> Geminiで解答を分析中...
               </div>
            )}
          </div>
        </div>

        {/* Right Side: Evaluation Results */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            flex: 1, 
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px', 
            padding: '1.5rem',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 250px)'
          }}>
            {!resultMarkdown && phase !== 'result' && (
               <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-tertiary)', opacity: 0.5 }}>
                 <FileText size={48} style={{ marginBottom: '1rem' }} />
                 <p>ここにフィードバックが表示されます。</p>
                 {currentPhoto.title && phase === 'idle' && !isGeneratingImage && (
                    <div style={{ marginTop: '2rem', fontSize: '0.8rem', fontStyle: 'italic', maxWidth: '80%', textAlign: 'center' }}>
                       (コンテキスト用のAI生成プロンプト: "{currentPhoto.title}")
                    </div>
                 )}
               </div>
            )}
            {resultMarkdown && (
              <div className="markdown-body" style={{ fontSize: '0.9rem' }}>
                <ReactMarkdown>{resultMarkdown}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
