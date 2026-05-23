import { useState } from 'react';

interface SettingsPanelProps {
  googleClientId: string;
  setGoogleClientId: (val: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (val: string) => void;
  geminiModel: string;
  setGeminiModel: (val: string) => void;
  geminiVoice: string;
  setGeminiVoice: (val: string) => void;
  docId: string;
  setDocId: (val: string) => void;
  theme: string;
  setTheme: (val: string) => void;
}

export default function SettingsPanel({
  googleClientId, setGoogleClientId,
  geminiApiKey, setGeminiApiKey,
  geminiModel, setGeminiModel,
  geminiVoice, setGeminiVoice,
  docId, setDocId,
  theme, setTheme
}: SettingsPanelProps) {

  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [sampleError, setSampleError] = useState("");

  const playSample = async () => {
    if (!geminiApiKey) {
      setSampleError("APIキーを入力してください。");
      return;
    }
    setIsPlayingSample(true);
    setSampleError("");
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const synthesisModel = 'gemini-2.5-flash-preview-tts';
      const model = genAI.getGenerativeModel({ model: synthesisModel });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Please say: "Hello! My name is ${geminiVoice}. I am happy to help you practice English today." Keep it short.` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: geminiVoice
              }
            }
          }
        } as any
      });

      const response = await result.response;
      const part = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.startsWith('audio')
      );

      if (part && part.inlineData) {
        const audioUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        const audio = new Audio(audioUrl);
        await audio.play();
      } else {
        throw new Error("音声データが返されませんでした。モデルがAUDIO出力をサポートしているか確認してください。");
      }
    } catch (e: any) {
      console.error(e);
      setSampleError(`サンプル再生エラー: ${e.message || e}`);
    } finally {
      setIsPlayingSample(false);
    }
  };
  
  return (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem' }}>設定とAPI構成</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        uKnowを有効にするには、プライベートAPIを設定してください。キーはブラウザにローカル保存されます。
      </p>
      

      <div className="form-group">
        <label className="form-label" htmlFor="theme">
          テーマ
        </label>
        <select
          id="theme"
          className="form-input"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          <option value="light">ライト (デフォルト)</option>
          <option value="dark">ダーク</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          お好みのアプリケーションテーマを選択してください。
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiApiKey">
          Gemini APIキー
        </label>
        <input 
          id="geminiApiKey"
          className="form-input" 
          type="password" 
          placeholder="AIzaSy..."
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Google AI Studioから取得してください。
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiModel">
          Gemini モデル
        </label>
        <select 
          id="geminiModel"
          className="form-input" 
          value={geminiModel}
          onChange={(e) => setGeminiModel(e.target.value)}
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          <option value="gemini-3.5-flash">gemini-3.5-flash (標準 / デフォルト)</option>
          <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (高速)</option>
          <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (プレミアム)</option>
          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
          <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          AI機能に使用するGeminiモデルを選択してください。
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiVoice">
          Gemini 音声
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select 
            id="geminiVoice"
            className="form-input" 
            value={geminiVoice}
            onChange={(e) => setGeminiVoice(e.target.value)}
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', flex: 1, margin: 0 }}
          >
            <option value="Achernar">Achernar (やわらかい)</option>
            <option value="Achird">Achird (友好的な)</option>
            <option value="Algenib">Algenib (ガラガラ声の)</option>
            <option value="Algieba">Algieba (なめらかな)</option>
            <option value="Alnilam">Alnilam (しっかりした)</option>
            <option value="Aoede">Aoede (さわやかな)</option>
            <option value="Autonoe">Autonoe (明るい)</option>
            <option value="Callirrhoe">Callirrhoe (気さくな)</option>
            <option value="Charon">Charon (情報豊富な)</option>
            <option value="Despina">Despina (なめらかな)</option>
            <option value="Enceladus">Enceladus (かすれた)</option>
            <option value="Erinome">Erinome (明瞭な)</option>
            <option value="Fenrir">Fenrir (興奮しやすい)</option>
            <option value="Gacrux">Gacrux (成熟した)</option>
            <option value="Iapetus">Iapetus (明瞭な)</option>
            <option value="Kore">Kore (しっかりした)</option>
            <option value="Laomedeia">Laomedeia (陽気な)</option>
            <option value="Leda">Leda (若々しい)</option>
            <option value="Orus">Orus (しっかりした)</option>
            <option value="Puck">Puck (陽気な)</option>
            <option value="Pulcherrima">Pulcherrima (積極的な)</option>
            <option value="Rasalgethi">Rasalgethi (情報豊富な)</option>
            <option value="Sadachbia">Sadachbia (活発な)</option>
            <option value="Sadaltager">Sadaltager (聡明な)</option>
            <option value="Schedar">Schedar (落ち着いた)</option>
            <option value="Sulafat">Sulafat (温かい)</option>
            <option value="Umbriel">Umbriel (気さくな)</option>
            <option value="Vindemiatrix">Vindemiatrix (優しい)</option>
            <option value="Zephyr">Zephyr (明るい)</option>
            <option value="Zubenelgenubi">Zubenelgenubi (ざっくばらんな)</option>
          </select>
          <button
            type="button"
            onClick={playSample}
            disabled={isPlayingSample || !geminiApiKey}
            className="btn btn-secondary"
            style={{ 
              height: '42px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              margin: 0
            }}
          >
            {isPlayingSample ? '再生中...' : '🔊 サンプル再生'}
          </button>
        </div>
        {sampleError && (
          <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.5rem', marginInline: 0 }}>{sampleError}</p>
        )}
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Gemini Liveモード (独り言スピーチ、瞬間英作文、田中渓メソッド) で使用する音声を選択してください。
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="docId">
          Google Docs ドキュメントID
        </label>
        <input 
          id="docId"
          className="form-input" 
          type="text" 
          placeholder="例: 1BxiMvs0XRY..."
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Google DocsのURLのID部分です: https://docs.google.com/document/d/&lt;b&gt;[DOC_ID]&lt;/b&gt;/edit
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="googleClientId">
          Google クライアントID (OAuth 2.0)
        </label>
        <input 
          id="googleClientId"
          className="form-input" 
          type="text" 
          placeholder="例: 123456789-abc.apps.googleusercontent.com"
          value={googleClientId}
          onChange={(e) => setGoogleClientId(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          プライベートなGoogle Docsを安全に読み取るために必要です。
        </p>
      </div>
      
      {geminiApiKey && !googleClientId && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '4px', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--success)' }}>
          <strong>シャドーイングの準備完了！</strong> シャドーイング機能が使えるようになりました。
        </div>
      )}
      
      {googleClientId && geminiApiKey && docId && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '4px', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--success)' }}>
          <strong>すべての準備完了！</strong> フラッシュカードとシャドーイングの両方が使えるようになりました。
        </div>
      )}
    </div>
  );
}
