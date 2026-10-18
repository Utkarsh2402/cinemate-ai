import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, Wrench } from 'lucide-react';
import { api } from '../api';

interface AIChatDrawerProps {
  currentCity: string;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  tools?: string[];
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ currentCity }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: "👋 Hi! I'm CineMate AI. Ask me anything about movies, theater showtimes, ticket prices, or movie recommendations across the web!",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const msg = textToSend || input;
    if (!msg.trim()) return;

    const userMessage: ChatMessage = { sender: 'user', text: msg };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const res = await api.chatAI(msg, historyPayload, currentCity);

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
    'Find Hindi comedies under ₹300',
  ];

  return (
    <>
      {/* Floating Toggle Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-200 hover:scale-105 active:scale-95 transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>Ask CineMate AI</span>
        </button>
      )}

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm sm:max-w-md h-[550px] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  CineMate AI Assistant
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">
                    Online
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Natural language movie concierge</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs font-bold transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl p-3 leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-rose-600 text-white font-medium rounded-tr-sm shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-tl-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[10px] text-rose-600 font-semibold">
                      <Wrench className="w-3 h-3" />
                      <span>Invoked: {m.tools.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                </div>
                <div className="bg-white rounded-2xl p-3 text-slate-400 text-xs flex items-center gap-1.5 border border-slate-200 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto text-[10px]">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSend(qp)}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 whitespace-nowrap transition-colors"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="Ask anything about movies or seats..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
            />
            <button
              disabled={isLoading || !input.trim()}
              onClick={() => handleSend()}
              className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
