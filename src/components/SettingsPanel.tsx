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
  
  return (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem' }}>Settings & API Configuration</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Configure your private APIs to enable uKnow. Your keys are stored locally in your browser.
      </p>
      

      <div className="form-group">
        <label className="form-label" htmlFor="theme">
          Theme
        </label>
        <select
          id="theme"
          className="form-input"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          <option value="light">Light (Default)</option>
          <option value="dark">Dark</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Select your preferred application theme.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiApiKey">
          Gemini API Key
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
          Get this from Google AI Studio.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiModel">
          Gemini Model
        </label>
        <select 
          id="geminiModel"
          className="form-input" 
          value={geminiModel}
          onChange={(e) => setGeminiModel(e.target.value)}
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview (Fast / Default)</option>
          <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Premium)</option>
          <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
          <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Select the Gemini model you want to use for the AI features.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="geminiVoice">
          Gemini Voice
        </label>
        <select 
          id="geminiVoice"
          className="form-input" 
          value={geminiVoice}
          onChange={(e) => setGeminiVoice(e.target.value)}
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          <option value="Aoede">Aoede</option>
          <option value="Callirrhoe">Callirrhoe</option>
          <option value="Charon">Charon</option>
          <option value="Fenrir">Fenrir</option>
          <option value="Kore">Kore</option>
          <option value="Leda">Leda</option>
          <option value="Orus">Orus</option>
          <option value="Puck">Puck</option>
          <option value="Zephyr">Zephyr</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Select the voice used in Gemini Live modes (Monologue, Reflex, GoTanakaKei).
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="docId">
          Google Docs Document ID
        </label>
        <input 
          id="docId"
          className="form-input" 
          type="text" 
          placeholder="e.g. 1BxiMvs0XRY..."
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          The ID component from your Google Docs URL: https://docs.google.com/document/d/&lt;b&gt;[DOC_ID]&lt;/b&gt;/edit
        </p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="googleClientId">
          Google Client ID (OAuth 2.0)
        </label>
        <input 
          id="googleClientId"
          className="form-input" 
          type="text" 
          placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
          value={googleClientId}
          onChange={(e) => setGoogleClientId(e.target.value)}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
          Required to read your private Google Docs securely.
        </p>
      </div>
      
      {geminiApiKey && !googleClientId && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '4px', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--success)' }}>
          <strong>Shadowing Ready!</strong> You can now use the Shadowing feature.
        </div>
      )}
      
      {googleClientId && geminiApiKey && docId && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '4px', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--success)' }}>
          <strong>All Systems Ready!</strong> You can now use both Flashcards and Shadowing.
        </div>
      )}
    </div>
  );
}
