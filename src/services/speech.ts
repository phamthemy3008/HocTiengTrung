/**
 * Native Mandarin (zh-CN) Speech & Audio Service
 * (Optimized for 100% Reliability on iPhone iOS Safari, Android, and Web Desktop)
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    try {
      this.cachedVoices = this.synth.getVoices() || [];
    } catch {
      this.cachedVoices = [];
    }
  }

  private getBestMandarinVoice(): SpeechSynthesisVoice | null {
    if (!this.cachedVoices || this.cachedVoices.length === 0) {
      this.loadVoices();
    }
    const voices = this.cachedVoices;
    if (!voices || voices.length === 0) return null;

    // Prefer high quality native Chinese voices on iOS / Chrome / Edge
    return (
      voices.find(
        (v) =>
          v.lang.replace('_', '-').toLowerCase() === 'zh-cn' &&
          (v.name.includes('Tingting') ||
            v.name.includes('Ting-Ting') ||
            v.name.includes('Sinji') ||
            v.name.includes('Sin-ji') ||
            v.name.includes('Meijia') ||
            v.name.includes('Mei-Jia') ||
            v.name.includes('Siri') ||
            v.name.includes('Natural') ||
            v.name.includes('Xiaoxiao') ||
            v.name.includes('Yunxi') ||
            v.name.includes('Google') ||
            v.name.includes('Premium'))
      ) ||
      voices.find((v) => v.lang.replace('_', '-').toLowerCase() === 'zh-cn') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
      null
    );
  }

  /**
   * Speak Chinese text with native Mandarin pronunciation
   * Synchronous execution within user gesture for iOS Safari compatibility
   */
  speak(text: string, rate: number = 0.88): Promise<void> {
    if (!text || !text.trim()) return Promise.resolve();
    const cleanText = text.trim();

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // 1. Primary: Native SpeechSynthesis (Fastest, zero network delay, native iOS Siri/TingTing voice)
      if (this.synth) {
        try {
          if (this.synth.paused) {
            this.synth.resume();
          }
          this.synth.cancel();

          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'zh-CN';
          utterance.rate = rate;
          utterance.pitch = 1.0;

          const voice = this.getBestMandarinVoice();
          if (voice) {
            utterance.voice = voice;
          }

          utterance.onend = () => done();
          utterance.onerror = () => {
            // Fallback to online audio if SpeechSynthesis fails
            this.playOnlineAudio(cleanText).then(done);
          };

          // Store on window to prevent iOS Safari garbage collection bug
          (window as any)._lastChineseUtterance = utterance;

          this.synth.speak(utterance);

          // Timeout safety in case onend does not fire on older iOS
          setTimeout(() => {
            if (this.synth && this.synth.speaking) {
              this.synth.resume();
            }
            done();
          }, 3500);

          return;
        } catch {
          // Fall through to online audio
        }
      }

      // 2. Secondary: Online HD Audio Stream
      this.playOnlineAudio(cleanText).then(done);
    });
  }

  /**
   * Online High Definition Mandarin Audio Stream fallback
   */
  private playOnlineAudio(text: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.src = '';
        }

        const urls = [
          `/api/tts?text=${encodeURIComponent(text)}`,
          `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`,
        ];

        let urlIndex = 0;
        const audio = new Audio();
        this.currentAudio = audio;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');

        const tryNextUrl = () => {
          if (urlIndex < urls.length) {
            audio.src = urls[urlIndex++];
            const p = audio.play();
            if (p !== undefined) {
              p.catch(() => tryNextUrl());
            }
          } else {
            resolve();
          }
        };

        audio.onended = () => resolve();
        audio.onerror = () => tryNextUrl();

        tryNextUrl();
        setTimeout(resolve, 4000);
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

    try {
      const rec = new SpeechRecognitionClass();
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
        onError(event);
      };

      rec.start();

      return {
        stop: () => {
          try {
            rec.stop();
          } catch {}
        },
      };
    } catch (e) {
      onError(e);
      return { stop: () => {} };
    }
  }
}

export const speechService = new SpeechService();
export default speechService;
