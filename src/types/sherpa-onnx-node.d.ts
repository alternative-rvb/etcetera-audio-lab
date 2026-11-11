// SECTION: Types minimaux de sherpa-onnx-node (le paquet ne fournit que des JSDoc), limités à ce que le labo utilise.

declare module "sherpa-onnx-node" {
  export interface GeneratedAudio {
    samples: Float32Array;
    sampleRate: number;
  }

  export interface OfflineTtsConfig {
    model: {
      vits?: { model: string; tokens: string; lexicon?: string; noiseScale?: number; noiseScaleW?: number; lengthScale?: number };
      numThreads?: number;
      provider?: string;
      debug?: boolean | number;
    };
    maxNumSentences?: number;
  }

  export class GenerationConfig {
    constructor(options: { phonemeCodepoints?: number[][]; sid?: number; speed?: number; silenceScale?: number });
  }

  export class OfflineTts {
    static createAsync(config: OfflineTtsConfig): Promise<OfflineTts>;
    readonly sampleRate: number;
    readonly numSpeakers: number;
    readonly lang: string;
    generateAsync(request: { text: string; sid?: number; speed?: number; enableExternalBuffer?: boolean; generationConfig?: GenerationConfig }): Promise<GeneratedAudio>;
  }

  export interface OfflineRecognizerConfig {
    featConfig?: { sampleRate: number; featureDim: number };
    modelConfig: {
      whisper?: { encoder: string; decoder: string; language?: string; task?: string; tailPaddings?: number };
      transducer?: { encoder: string; decoder: string; joiner: string };
      tokens: string;
      numThreads?: number;
      provider?: string;
      debug?: boolean | number;
      modelType?: string;
    };
  }

  export interface OfflineRecognizerResult {
    text: string;
    lang?: string;
    timestamps?: number[];
    tokens?: string[];
  }

  export class OfflineStream {
    acceptWaveform(wave: { sampleRate: number; samples: Float32Array }): void;
  }

  export class OfflineRecognizer {
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>;
    createStream(): OfflineStream;
    decodeAsync(stream: OfflineStream): Promise<void>;
    getResult(stream: OfflineStream): OfflineRecognizerResult;
  }

  export interface VadConfig {
    sileroVad: { model: string; threshold?: number; minSilenceDuration?: number; minSpeechDuration?: number; maxSpeechDuration?: number; windowSize: number };
    sampleRate: number;
    numThreads?: number;
    debug?: boolean;
  }

  export class Vad {
    constructor(config: VadConfig, bufferSizeInSeconds: number);
    acceptWaveform(samples: Float32Array): void;
    isEmpty(): boolean;
    front(enableExternalBuffer?: boolean): { start: number; samples: Float32Array };
    pop(): void;
    flush(): void;
  }
}
