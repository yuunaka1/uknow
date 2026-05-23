import React, { useState } from 'react';
import { Upload, Mic2, AlertTriangle, FileAudio, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeLessonAudioWithGemini } from '../utils/gemini';

const MAX_FILE_SIZE_MB = 20;

export default function Coaching({ geminiApiKey, geminiModel }: { geminiApiKey?: string, geminiModel: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setErrorMsg(null);
    setReport(null);
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please compress your audio to MP3.`);
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleAnalyze = async () => {
    if (!file || !geminiApiKey) return;
    
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const result = await analyzeLessonAudioWithGemini(geminiApiKey, file, geminiModel);
      setReport(result);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to analyze audio. The file might be too large or invalid format.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `yuknow_coaching_${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--brand-primary)' }}>
        <Mic2 size={24} /> LESSON COACHING
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Upload your online English lesson recording. Gemini AI will analyze your speaking and provide practical, direct coaching feedback.
        (Max {MAX_FILE_SIZE_MB}MB. We recommend converting 25-minute lessons to MP3).
      </p>

      {/* Upload Section */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '1rem',
        padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: '4px',
        backgroundColor: 'var(--bg-secondary)', marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--brand-primary)',
            border: '1px solid var(--brand-primary)', borderRadius: '4px', cursor: 'pointer',
            fontWeight: 'bold', letterSpacing: '1px'
          }}>
            <Upload size={18} />
            SELECT AUDIO
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
          </label>
          
          {file && (
            <span style={{ color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileAudio size={18} /> {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </span>
          )}
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <AlertTriangle size={16} /> {errorMsg}
          </div>
        )}

        {file && !isAnalyzing && !report && (
          <button 
            onClick={handleAnalyze}
            style={{
              marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--brand-primary)', color: 'var(--bg-primary)',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
              letterSpacing: '1.5px', boxShadow: '0 0 10px var(--brand-light)'
            }}
          >
            START ANALYSIS
          </button>
        )}
      </div>

      {isAnalyzing && (
        <div style={{ 
          padding: '3rem 1rem', textAlign: 'center', 
          border: '1px solid var(--border-color)', borderRadius: '4px',
          fontFamily: "'Fira Code', monospace", color: 'var(--brand-primary)'
        }}>
          <div style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>&gt; Initializing AI Models...</div>
          <div style={{ color: 'var(--text-tertiary)' }}>&gt; Uploading audio stream to Gemini...</div>
          <div style={{ color: 'var(--text-tertiary)' }}>&gt; Processing voice vectors and transcribing...</div>
          <div style={{ marginTop: '1rem', display: 'inline-block' }} className="blink">_</div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--border-color)' }}>This may take 1-2 minutes depending on file size.</p>
        </div>
      )}

      {report && (
        <div style={{
          padding: '2rem', backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--bg-secondary)', borderRadius: '4px'
        }}>
          <h3 style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>&gt; COACHING_REPORT.LOG</span>
            <button 
              onClick={handleDownload} 
              style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--brand-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
              title="Download as Markdown"
            >
              <Download size={14} /> EXPORT
            </button>
          </h3>
          <div className="markdown-body" style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      )}

    </div>
  );
}
