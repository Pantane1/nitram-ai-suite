
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { GeminiService } from '../../services/geminiService';

interface ChatModuleProps {
  addLog: (method: string, status: 'pending' | 'success' | 'error', duration?: number) => void;
}

const ChatModule: React.FC<ChatModuleProps> = ({ addLog }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I can help you with complex reasoning and searching for real-time information. What would you like to know?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gemini = useRef(new GeminiService());

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    
    const startTime = Date.now();
    addLog('gemini.chatWithGrounding', 'pending');

    try {
      const result = await gemini.current.chatWithGrounding(input);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        sources: result.sources,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMsg]);
      addLog('gemini.chatWithGrounding', 'success', Date.now() - startTime);
    } catch (error) {
      console.error(error);
      addLog('gemini.chatWithGrounding', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-6">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-600' : 'bg-neutral-800'}`}>
              <i className={`fas ${msg.role === 'user' ? 'fa-user' : 'fa-robot'} text-xs`}></i>
            </div>
            <div className={`max-w-[80%] space-y-3 ${msg.role === 'user' ? 'items-end' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-neutral-800 text-neutral-200 rounded-tl-none'}`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.sources.map((src, i) => (
                    <a 
                      key={i} 
                      href={src.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 bg-neutral-900 border border-neutral-700 rounded-full text-neutral-400 hover:text-blue-400 hover:border-blue-400 transition-all flex items-center gap-1"
                    >
                      <i className="fas fa-link text-[8px]"></i>
                      {src.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 shrink-0"></div>
            <div className="px-4 py-3 rounded-2xl bg-neutral-800 w-32"></div>
          </div>
        )}
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:border-blue-600 transition-all text-sm"
          />
          <button 
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-blue-500 transition-colors"
          >
            <i className="fas fa-paper-plane text-sm"></i>
          </button>
        </form>
        <p className="text-[10px] text-neutral-600 text-center mt-3 tracking-wide">
          Powered by Gemini 3 Pro with Live Google Search
        </p>
      </div>
    </div>
  );
};

export default ChatModule;
