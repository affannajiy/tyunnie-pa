"use client";

import { useRef, useState, useCallback } from "react";

type UseSpeechOptions = {
  onResult: (transcript: string) => void;
  onEnd?: () => void;
};

export function useSpeech({ onResult, onEnd }: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const start = useCallback(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new (
      window.SpeechRecognition || window.webkitSpeechRecognition
    )();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      onResult(transcript);
    };

    recognition.onend = () => {
      setListening(false);
      onEnd?.();
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error("Speech error:", e.error);
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onResult, onEnd]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, supported, toggle, stop };
}
