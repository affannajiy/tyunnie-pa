declare module "*.css";

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

declare let SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

declare let webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};
