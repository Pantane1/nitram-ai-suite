
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService, decodeBase64, encodeBase64, decodeAudioData } from '../../services/geminiService';

interface VoiceModuleProps {
  addLog: (method: string, status: 'pending' | 'success' | 'error', duration?: number) => void;
}

const VoiceModule: React.FC<VoiceModuleProps> = ({ addLog }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const gemini = useRef(new GeminiService());
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (inputCtxRef.current) inputCtxRef.current.close();
    if (outputCtxRef.current) outputCtxRef.current.close();
    setIsActive(false);
    addLog('gemini.liveSession', 'success');
  };

  const startSession = async () => {
    setIsActive(true);
    addLog('gemini.liveSession', 'pending');

    inputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const outputNode = outputCtxRef.current.createGain();
    outputNode.connect(outputCtxRef.current.destination);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    sessionRef.current = await gemini.current.connectLive({
      onopen: () => {
        const source = inputCtxRef.current!.createMediaStreamSource(stream);
        const scriptProcessor = inputCtxRef.current!.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const l = inputData.length;
          const int16 = new Int16Array(l);
          for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
          
          if (sessionRef.current) {
            sessionRef.current.sendRealtimeInput({
              media: {
                data: encodeBase64(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          }
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(inputCtxRef.current!.destination);
      },
      onmessage: async (msg: any) => {
        const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audioBase64) {
          const ctx = outputCtxRef.current!;
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          const buffer = await decodeAudioData(decodeBase64(audioBase64), ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(outputNode);
          source.addEventListener('ended', () => sourcesRef.current.delete(source));
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          sourcesRef.current.add(source);
        }

        if (msg.serverContent?.interrupted) {
          sourcesRef.current.forEach(s => s.stop());
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        }
      },
      onerror: () => addLog('gemini.liveSession', 'error'),
      onclose: () => setIsActive(false)
    });
  };

  useEffect(() => {
    return () => {
      if (isActive) stopSession();
    };
  }, [isActive]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 space-y-12">
      <div className="relative">
        {/* Animated Rings */}
        {isActive && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 border-2 border-blue-500 rounded-full animate-ping opacity-20"></div>
            <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-ping opacity-10 [animation-delay:0.5s]"></div>
          </div>
        )}
        
        <button 
          onClick={isActive ? stopSession : startSession}
          className={`w-32 h-32 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all relative z-10 ${
            isActive ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          <i className={`fas ${isActive ? 'fa-stop' : 'fa-microphone'} text-white`}></i>
        </button>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold">{isActive ? 'Nitram is Listening...' : 'Click to Start Conversation'}</h3>
        <p className="text-neutral-500 max-w-sm">Low-latency audio connection powered by Gemini 2.5 Flash Native Audio.</p>
      </div>

      <div className="w-full max-w-lg bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-40 overflow-y-auto">
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Live Status</p>
        <div className="space-y-2">
          {isActive ? (
            <div className="flex items-center gap-3 text-green-500 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Session connected
            </div>
          ) : (
            <div className="text-neutral-600 text-sm">Waiting for connection...</div>
          )}
          <div className="text-neutral-400 text-xs leading-relaxed italic">
            "You can ask me to write a story, explain physics, or just chat. My voice is human-like and responds in real-time."
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceModule;
