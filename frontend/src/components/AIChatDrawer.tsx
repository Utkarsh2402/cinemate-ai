import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, Wrench } from 'lucide-react';
import { api } from '../api';

interface AIChatDrawerProps {
  currentCity: string;
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  tools?: string[];
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ currentCity }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: `Hello! I'm your CineMate AI concierge for ${currentCity}. Ask me about movie showtimes, open seats, or recommendations!`,
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const msg = textToSend || input;
    if (!msg.trim() || isLoading) return;

    const userMessage: Message = { sender: 'user', text: msg };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender,
        content: m.text,
      }));
      const res = await api.chatAI(msg, history, currentCity);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: res.reply,
          tools: res.tools_called,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: "I couldn't process your request right now, but feel free to browse the catalog!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'What showtimes are playing today?',
    'Check seat availability for Dune',
    'Find Hindi comedies under 300',
  ];

  return (
    <>
      {/* Floating Toggle Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-bold text-xs shadow-glow-red hover:scale-105 active:scale-95 transition-all"
        >
          <Sparkles className="w-4 h-4 animate-spin text-amber-200" style={{ animationDuration: '4s' }} />
          <span>Ask CineMate AI</span>
        </button>
      )}

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm sm:max-w-md h-[550px] glass-panel rounded-3xl border border-rose-500/30 shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  CineMate AI Assistant
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                    Online
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Natural language tool calling assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl p-3 leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-rose-600 text-white font-medium rounded-tr-sm'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center gap-1 text-[10px] text-cyan-400 font-semibold">
                      <Wrench className="w-3 h-3" />
                      <span>Invoked: {m.tools.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                </div>
                <div className="bg-slate-900 rounded-2xl p-3 text-slate-400 text-xs flex items-center gap-1.5 border border-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800 flex gap-1.5 overflow-x-auto text-[10px]">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSend(qp)}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Ask anything about movies or seats..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <button
              disabled={isLoading || !input.trim()}
              onClick={() => handleSend()}
              className="w-8 h-8 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white flex items-center justify-center transition-colors shadow-glow-red"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
