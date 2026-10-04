/**
 * Web Speech API Utility for Native Mandarin (zh-CN) Pronunciation
 * and Voice Recognition / Evaluation
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private recognition: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoice();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoice();
      }
    }
  }

  private initVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Look for zh-CN voices (Mandarin mainland) or Chinese voices
    this.voice =
      voices.find((v) => v.lang === 'zh-CN' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Xiaoxiao') || v.name.includes('Yunxi'))) ||
      voices.find((v) => v.lang === 'zh-CN') ||
      voices.find((v) => v.lang.startsWith('zh')) ||
      null;
  }

  /**
   * Speak Chinese text with standard Mandarin pronunciation
   * @param text Hanzi or sentence to speak
   * @param rate playback speed (default 0.9 for learners)
   */
  speak(text: string, rate: number = 0.9): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }
      this.synth.cancel(); // Stop any pending speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = rate;
      utterance.pitch = 1.0;
      if (this.voice) {
        utterance.voice = this.voice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synth.speak(utterance);
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
