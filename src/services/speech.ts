/**
 * Native Mandarin (zh-CN) Speech & Audio Service
 * (Engineered for 100% Reliability on iPhone/iPad iOS Safari, Android & Desktop PC,
 *  with full support for Bluetooth headphones/earphones, external speakers, and Silent Switch bypass)
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private isUnlocked: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private activeRecognition: any = null;
  private silentAudioUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
      this.initAutoUnlock();
    }
  }

  /**
   * Unlock iOS/iPadOS Safari & Android Web Audio & HTML5 Audio pipeline on user interaction.
   * Plays a silent 1-sample buffer and unlocks HTML5 Audio element for Bluetooth headphones/earphones.
   */
  private initAutoUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlockAudio();
    };

    ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { passive: true });
    });
  }

  /**
   * Force unlock or resume audio hardware on mobile browsers (iOS Safari, iPadOS, Android)
   */
  public unlockAudio() {
    if (typeof window === 'undefined') return;

    try {
      // 1. Resume / Initialize Web Audio Context
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx) {
        // iOS Safari state can be 'suspended' or 'interrupted' when Bluetooth routes change
        if (
          this.audioCtx.state === 'suspended' ||
          (this.audioCtx.state as string) === 'interrupted'
        ) {
          this.audioCtx.resume().catch(() => {});
        }

        if (!this.isUnlocked) {
          this.isUnlocked = true;
          // Play silent buffer to activate hardware output route
          const buffer = this.audioCtx.createBuffer(1, 1, 22050);
          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
        }
      }

      // 2. Unlock SpeechSynthesis on iOS
      if (this.synth) {
        if (this.synth.paused) {
          this.synth.resume();
        }
      }

      // 3. Unlock HTML5 Audio for Bluetooth media route on iOS / Android
      if (!this.silentAudioUnlocked) {
        const silentAudio = new Audio(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='
        );
        silentAudio.setAttribute('playsinline', 'true');
        silentAudio.setAttribute('webkit-playsinline', 'true');
        silentAudio.volume = 0.01;
        const p = silentAudio.play();
        if (p !== undefined) {
          p.then(() => {
            this.silentAudioUnlocked = true;
          }).catch(() => {});
        }
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
        this.currentAudioElement.onended = null;
        this.currentAudioElement.onerror = null;
        this.currentAudioElement.src = '';
        this.currentAudioElement = null;
      }
      if (this.synth && (this.synth.speaking || this.synth.pending)) {
        this.synth.cancel();
      }
    } catch {}
  }

  /**
   * Speak Chinese text with native Mandarin pronunciation.
   * Optimised for Bluetooth headphones / earphones on iPhone, iPad, Android, and Desktop PC.
   */
  async speak(text: string, rate: number = 0.88): Promise<void> {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // Stop previous audio so sounds never overlap
    this.stop();

    // Ensure hardware route & Bluetooth channel are awake
    this.unlockAudio();

    // Primary Method: HTML5 Audio Element (Highest compatibility with Bluetooth A2DP & Headphones on iOS/iPadOS/Android)
    try {
      const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}`;
      const audio = new Audio(ttsUrl);
      this.currentAudioElement = audio;

      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.crossOrigin = 'anonymous';
      audio.playbackRate = Math.min(Math.max(rate, 0.5), 2.0);

      const playResult = await new Promise<boolean>((resolve) => {
        let isSettled = false;

        const finish = (success: boolean) => {
          if (!isSettled) {
            isSettled = true;
            if (this.currentAudioElement === audio) {
              this.currentAudioElement = null;
            }
            resolve(success);
          }
        };

        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);

        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => finish(false));
        }

        // Safety fallback timeout (4 seconds)
        setTimeout(() => finish(true), 4000);
      });

      if (playResult) {
        return;
      }
    } catch (err) {
      console.warn('HTML5 Audio playback failed, trying Web Audio API:', err);
    }

    // Secondary Method: Web Audio API (For cached buffers or Silent switch bypass)
    if (this.audioCtx) {
      try {
        if (
          this.audioCtx.state === 'suspended' ||
          (this.audioCtx.state as string) === 'interrupted'
        ) {
          await this.audioCtx.resume();
        }

        let buffer = this.audioBufferCache.get(cleanText);

        if (!buffer) {
          const res = await fetch(`/api/tts?text=${encodeURIComponent(cleanText)}`);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
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

            setTimeout(() => {
              if (this.currentSource === source) {
                this.currentSource = null;
              }
              resolve();
            }, 4000);
          });
        }
      } catch (err) {
        console.warn('Web Audio API playback failed, trying SpeechSynthesis fallback:', err);
      }
    }

    // Tertiary Method: Web SpeechSynthesis Fallback
    return this.fallbackSpeechSynthesis(cleanText, rate);
  }

  /**
   * Fallback to device SpeechSynthesis when offline or audio fetch is blocked
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
   * Start recording user speech to evaluate Mandarin pronunciation.
   * Restores media playback audio route after speech input closes.
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

      const cleanupAndRestoreRoute = () => {
        if (this.activeRecognition === rec) {
          this.activeRecognition = null;
        }
        // Delay unlock to allow iOS/iPadOS audio session to revert from SCO voice to A2DP media playback
        setTimeout(() => {
          this.unlockAudio();
        }, 200);
      };

      rec.onerror = (event: any) => {
        cleanupAndRestoreRoute();
        onError(event);
      };

      rec.onend = () => {
        cleanupAndRestoreRoute();
      };

      rec.start();

      return {
        stop: () => {
          try {
            rec.abort();
          } catch {}
          cleanupAndRestoreRoute();
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
