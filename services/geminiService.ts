
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { MODELS } from "../constants";

// Helper for encoding/decoding as required by Live API
export const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  // Refresh instance to pick up latest API keys (useful for Veo selection)
  public static refresh() {
    return new GeminiService();
  }

  async chatWithGrounding(message: string, history: any[] = []) {
    const response = await this.ai.models.generateContent({
      model: MODELS.CHAT,
      contents: message,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri || '',
      title: chunk.web?.title || 'Source'
    })).filter((s: any) => s.uri) || [];

    return {
      text: response.text || "No response received.",
      sources
    };
  }

  async generateImage(prompt: string, isPro: boolean = false) {
    const model = isPro ? MODELS.VISION_PRO : MODELS.VISION_FAST;
    const response = await this.ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    return imageUrl;
  }

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16' = '16:9') {
    let operation = await this.ai.models.generateVideos({
      model: MODELS.MOTION,
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      operation = await this.ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async getMapGrounding(query: string, lat?: number, lng?: number) {
    const toolConfig = lat && lng ? {
      retrievalConfig: {
        latLng: { latitude: lat, longitude: lng }
      }
    } : undefined;

    const response = await this.ai.models.generateContent({
      model: MODELS.MAPS,
      contents: query,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig
      }
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      uri: chunk.maps?.uri || chunk.web?.uri || '',
      title: chunk.maps?.title || chunk.web?.title || 'Location'
    })).filter((s: any) => s.uri) || [];

    return {
      text: response.text || "",
      sources
    };
  }

  connectLive(callbacks: any) {
    return this.ai.live.connect({
      model: MODELS.VOICE,
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
        },
        systemInstruction: 'You are a helpful and charismatic AI assistant named Nitram. Keep responses concise for natural conversation.'
      }
    });
  }
}
