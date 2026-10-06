/**
 * Native Mandarin (zh-CN) Speech & Audio Service
 * (Engineered for 100% Reliability on iPhone iOS Safari with Silent Switch Bypassed, Android & PC)
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private isUnlocked: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private activeRecognition: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
      this.initAutoUnlock();
    }
  }

  /**
   * Unlock iOS Safari Web Audio on first user interaction
   * Plays a 1-sample silent buffer to unlock the hardware audio pipeline (bypasses Silent Switch)
   */
  private initAutoUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlockAudio();
    };

    ['touchstart', 'touchend', 'click', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { passive: true });
    });
  }

  public unlockAudio() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx) {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        if (!this.isUnlocked) {
          this.isUnlocked = true;
          // Play silent buffer to activate hardware speaker route on iOS
          const buffer = this.audioCtx.createBuffer(1, 1, 22050);
          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
        }
      }

      if (this.synth && this.synth.paused) {
        this.synth.resume();
      }
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  }

  /**
   * Stop any currently playing audio before starting a new one
   */
  public stop() {
    try {
      if (this.currentSource) {
        this.currentSource.stop();
        this.currentSource.disconnect();
        this.currentSource = null;
      }
      if (this.currentAudioElement) {
        this.currentAudioElement.pause();
        this.currentAudioElement.src = '';
        this.currentAudioElement = null;
      }
      if (this.synth && (this.synth.speaking || this.synth.pending)) {
        this.synth.cancel();
      }
    } catch {}
  }

  /**
   * Speak Chinese text with native Mandarin pronunciation
   * Primary: Web Audio API via /api/tts (Works on iPhone EVEN in Silent/Vibrate Mode, zero double-playing)
   * Secondary: HTML5 Audio
   * Tertiary: Native SpeechSynthesis (Offline fallback)
   */
  async speak(text: string, rate: number = 0.88): Promise<void> {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // Stop previous audio so sounds never overlap
    this.stop();

    // Ensure audio hardware is active
    this.unlockAudio();

    // 1. Primary: Web Audio API (Plays through speaker even if iPhone is on Silent Mode)
    if (this.audioCtx) {
      try {
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        let buffer = this.audioBufferCache.get(cleanText);

        if (!buffer) {
          const res = await fetch(`/api/tts?text=${encodeURIComponent(cleanText)}`);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            // Safari decodeAudioData requires a sliced copy
            const clonedBuffer = arrayBuffer.slice(0);
            buffer = await new Promise<AudioBuffer>((resDecode, rejDecode) => {
              this.audioCtx!.decodeAudioData(clonedBuffer, resDecode, rejDecode);
            });
            this.audioBufferCache.set(cleanText, buffer);
          }
        }

        if (buffer) {
          return new Promise((resolve) => {
            const source = this.audioCtx!.createBufferSource();
            this.currentSource = source;
            source.buffer = buffer!;
            source.playbackRate.value = rate;
            source.connect(this.audioCtx!.destination);

            source.onended = () => {
              if (this.currentSource === source) {
                this.currentSource = null;
              }
              resolve();
            };

            source.start(0);

            // Safety timeout
            setTimeout(() => {
              if (this.currentSource === source) {
                this.currentSource = null;
              }
              resolve();
            }, 4000);
          });
        }
      } catch (err) {
        console.warn('Web Audio playback error, trying HTML5 Audio fallback:', err);
      }
    }

    // 2. Secondary: HTML5 Audio Element
    try {
      const audio = new Audio(`/api/tts?text=${encodeURIComponent(cleanText)}`);
      this.currentAudioElement = audio;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.playbackRate = rate;

      return new Promise((resolve) => {
        let isDone = false;
        const finish = () => {
          if (!isDone) {
            isDone = true;
            this.currentAudioElement = null;
            resolve();
          }
        };

        audio.onended = finish;
        audio.onerror = () => {
          this.fallbackSpeechSynthesis(cleanText, rate).then(finish);
        };

        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => {
            this.fallbackSpeechSynthesis(cleanText, rate).then(finish);
          });
        }

        setTimeout(finish, 4000);
      });
    } catch {
      // Fall through to SpeechSynthesis
    }

    // 3. Tertiary: Local SpeechSynthesis
    return this.fallbackSpeechSynthesis(cleanText, rate);
  }

  /**
   * Fallback to device SpeechSynthesis when offline
   */
  private fallbackSpeechSynthesis(text: string, rate: number = 0.88): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }

      try {
        if (this.synth.paused) {
          this.synth.resume();
        }
        if (this.synth.speaking) {
          this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = rate;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices() || [];
        const zhVoice =
          voices.find(
            (v) =>
              v.lang.replace('_', '-').toLowerCase() === 'zh-cn' &&
              (v.name.includes('Tingting') ||
                v.name.includes('Siri') ||
                v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Xiaoxiao'))
          ) ||
          voices.find((v) => v.lang.replace('_', '-').toLowerCase() === 'zh-cn') ||
          voices.find((v) => v.lang.toLowerCase().startsWith('zh'));

        if (zhVoice) {
          utterance.voice = zhVoice;
        }

        let isDone = false;
        const done = () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        };

        utterance.onend = done;
        utterance.onerror = done;

        (window as any)._lastChineseUtterance = utterance;
        this.synth.speak(utterance);

        setTimeout(done, 3000);
      } catch {
        resolve();
      }
    });
  }

  /**
   * Check if Web Speech Recognition is supported
   */
  isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Start recording user speech to evaluate Mandarin pronunciation
   * Handles repeated recordings cleanly without InvalidStateError
   */
  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: any) => void
  ): { stop: () => void } {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      onError(new Error('Trình duyệt không hỗ trợ nhận diện giọng nói Web Speech.'));
      return { stop: () => {} };
    }

    // Always abort any previous active recognition session before creating a new one
    if (this.activeRecognition) {
      try {
        this.activeRecognition.abort();
      } catch {}
      this.activeRecognition = null;
    }

    try {
      const rec = new SpeechRecognitionClass();
      this.activeRecognition = rec;
      rec.lang = 'zh-CN';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const transcript = (finalTranscript || interimTranscript).trim();
        if (transcript) {
          onResult(transcript, !!finalTranscript);
        }
      };

      rec.onerror = (event: any) => {
        if (this.activeRecognition === rec) {
          this.activeRecognition = null;
        }
        onError(event);
      };

      rec.onend = () => {
        if (this.activeRecognition === rec) {
          this.activeRecognition = null;
        }
      };

      rec.start();

      return {
        stop: () => {
          try {
            rec.abort();
          } catch {}
          if (this.activeRecognition === rec) {
            this.activeRecognition = null;
          }
        },
      };
    } catch (e) {
      if (this.activeRecognition) {
        this.activeRecognition = null;
      }
      onError(e);
      return { stop: () => {} };
    }
  }
}

export const speechService = new SpeechService();
export default speechService;
