// The `any`s in this file are DELIBERATE and must not be "fixed".
// The Web Speech API's `SpeechRecognition` / `SpeechRecognitionEvent` types are
// not in the TS lib and are not present in Vercel's build environment — typing
// them properly breaks the production build. See .claude/CLAUDE.md, "Build /
// TypeScript (break Vercel if violated)". Suppressed at file scope with the
// reason attached, rather than silently left as lint errors.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";

type UseSpeechOptions = {
  onResult: (transcript: string) => void;
};

export function useSpeech({ onResult }: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function toggle() {
    if (!supported) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      onResult(transcript);
    };

    recognition.onerror = (e: any) => {
      console.error("Speech error:", e.error);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }

  return { listening, supported, toggle };
}
