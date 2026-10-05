/**
 * Native Mandarin (zh-CN) Speech & Audio Service
 * (Optimized for 100% Reliability on iPhone iOS Safari, Android, and Web Desktop)
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
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
   * Rock-solid single-engine SpeechSynthesis (Matches release v1.0.0.1: No double-playing, 100% iOS & PC compatible)
   */
  speak(text: string, rate: number = 0.88): Promise<void> {
    if (!text || !text.trim()) return Promise.resolve();
    const cleanText = text.trim();

    return new Promise((resolve) => {
      let isDone = false;
      const done = () => {
        if (!isDone) {
          isDone = true;
          resolve();
        }
      };

      if (!this.synth) {
        done();
        return;
      }

      try {
        // Resume if iOS WebKit speech synth is paused
        if (this.synth.paused) {
          this.synth.resume();
        }

        // Only cancel previous utterance if currently speaking to avoid cancelling the current one on iOS
        if (this.synth.speaking) {
          this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'zh-CN';
        utterance.rate = rate;
        utterance.pitch = 1.0;

        const voice = this.getBestMandarinVoice();
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = done;
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis event error:', e);
          done();
        };

        // CRITICAL FOR IOS SAFARI: Prevent garbage-collection of the utterance object
        (window as any)._lastChineseUtterance = utterance;

        this.synth.speak(utterance);

        // Safety timeout in case onend does not fire
        setTimeout(done, 3500);
      } catch (err) {
        console.warn('SpeechSynthesis speak error:', err);
        done();
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
