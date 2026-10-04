/**
 * Web Speech API Utility for Native Mandarin (zh-CN) Pronunciation
 * and Voice Recognition / Evaluation (Optimized for iOS Safari & Web)
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private getBestMandarinVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return null;

    return (
      voices.find(
        (v) =>
          v.lang === 'zh-CN' &&
          (v.name.includes('Google') ||
            v.name.includes('Natural') ||
            v.name.includes('Xiaoxiao') ||
            v.name.includes('Yunxi') ||
            v.name.includes('Tingting') ||
            v.name.includes('Sinji') ||
            v.name.includes('Meijia'))
      ) ||
      voices.find((v) => v.lang === 'zh-CN') ||
      voices.find((v) => v.lang === 'zh_CN') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
      null
    );
  }

  /**
   * Speak Chinese text with standard Mandarin pronunciation
   * Supports both SpeechSynthesis and iOS-optimized native audio streaming fallback
   * @param text Hanzi or sentence to speak
   * @param rate playback speed (default 0.9 for learners)
   */
  speak(text: string, rate: number = 0.9): Promise<void> {
    if (!text || !text.trim()) return Promise.resolve();

    return new Promise((resolve) => {
      // 1. Try SpeechSynthesis first if supported
      if (this.synth) {
        try {
          this.synth.cancel(); // Clear any pending speech
          if (this.synth.paused) {
            this.synth.resume();
          }

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'zh-CN';
          utterance.rate = rate;
          utterance.pitch = 1.0;

          const voice = this.getBestMandarinVoice();
          if (voice) {
            utterance.voice = voice;
          }

          let hasResolved = false;
          utterance.onend = () => {
            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }
          };

          utterance.onerror = () => {
            // If SpeechSynthesis errors (common on iOS Safari background / permissions), fallback to online native audio
            if (!hasResolved) {
              hasResolved = true;
              this.fallbackPlayOnlineAudio(text).then(resolve);
            }
          };

          this.synth.speak(utterance);

          // Safety timeout for iOS Safari where onend might not fire
          setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }
          }, 3500);

          return;
        } catch {
          // Continue to fallback
        }
      }

      // 2. Fallback to HTML5 Audio streaming
      this.fallbackPlayOnlineAudio(text).then(resolve);
    });
  }

  /**
   * Fallback online high-definition native Mandarin pronunciation (Guaranteed on iOS Safari)
   */
  private fallbackPlayOnlineAudio(text: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.src = '';
        }

        const cleanText = text.trim();
        const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&le=zh`;
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        audio.setAttribute('playsinline', 'true');

        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => resolve());
        }
      } catch {
        resolve();
      }
    });
  }

  /**
   * Check if speech recognition is supported in this browser
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

    const rec = new SpeechRecognitionClass();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      onResult(final || interim, Boolean(final));
    };

    rec.onerror = (event: any) => {
      onError(event.error);
    };

    try {
      rec.start();
    } catch (e) {
      console.warn('SpeechRecognition start error:', e);
    }

    return {
      stop: () => {
        try {
          rec.stop();
        } catch (_) {}
      },
    };
  }
}

export const speechService = new SpeechService();
