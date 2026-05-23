// --- Audio Output Player (24kHz PCM) ---
export class AudioStreamPlayer {
  audioContext: AudioContext;
  nextStartTime: number;

  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.nextStartTime = this.audioContext.currentTime;
  }

  async playPcmData(base64Pcm: string, sampleRate = 24000) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, sampleRate);
    audioBuffer.copyToChannel(float32Array, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.05; 
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  stop() {
    this.audioContext.close();
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.nextStartTime = this.audioContext.currentTime;
  }
}

// --- Audio Input Recorder (16kHz PCM) ---
export class AudioRecorder {
  audioContext: AudioContext | null = null;
  mediaStreamSrc: MediaStreamAudioSourceNode | null = null;
  processor: ScriptProcessorNode | null = null;
  stream: MediaStream | null = null;
  gainNode: GainNode | null = null;

  async start(onPcmChunk: (base64: string) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    this.mediaStreamSrc = this.audioContext.createMediaStreamSource(this.stream);
    
    // ScriptProcessor is deprecated but works uniformly across browsers for raw PCM capture
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    
    // Prevent mic echo
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;

    this.mediaStreamSrc.connect(this.processor);
    this.processor.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      // Ensure Float32 is within [-1, 1] then convert to 16-bit PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
         binary += String.fromCharCode(bytes[i]);
      }
      const chunk = btoa(binary);
      onPcmChunk(chunk);
    };
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.mediaStreamSrc) {
      this.mediaStreamSrc.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
  }
}
