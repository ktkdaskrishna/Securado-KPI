import React, { useState, useRef, useEffect } from 'react';
import { aiAssistantAPI } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Bot, Send, X, Minimize2, Sparkles, User, Loader2, MessageSquarePlus, RotateCcw } from 'lucide-react';

export default function AiAssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your CRM AI Assistant. Ask me anything about your pipeline, invoices, activities, or team performance.\n\nYou can also share feedback or report issues right here." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto', 'feedback', 'crm'
  const [sessionId] = useState(() => `crm-${Date.now()}`);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await aiAssistantAPI.chat(question, sessionId, mode);
      const data = res.data;
      const msg = { role: 'assistant', text: data.answer };
      if (data.feedback_submitted) {
        msg.feedbackId = data.feedback_id;
      }
      setMessages(prev => [...prev, msg]);
      // Reset to auto mode after feedback submission
      if (data.feedback_submitted) setMode('auto');
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const switchToFeedback = () => {
    setMode('feedback');
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: "I'm ready to collect your feedback. Describe the issue, suggestion, or feature request and I'll submit it for you.\n\nTip: Include the module name (e.g., dashboard, invoices) and priority (high, medium, low) if possible."
    }]);
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', text: "Hi! I'm your CRM AI Assistant. Ask me anything about your pipeline, invoices, activities, or team performance.\n\nYou can also share feedback or report issues right here." }]);
    setMode('auto');
  };

  const quickQuestions = [
    "What's my pipeline for 2026?",
    "Which invoices are overdue?",
    "Team performance summary",
  ];

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} data-testid="ai-assistant-fab"
        className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-gradient-to-br from-[#800000] to-[#5a0000] text-white shadow-xl hover:shadow-2xl transition-all hover:scale-110 group"
        title="AI CRM Assistant & Feedback">
        <Bot className="h-6 w-6 group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[550px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
      data-testid="ai-assistant-panel">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#800000] to-[#5a0000] px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">CRM AI Assistant</p>
          <p className="text-white/60 text-[10px]">
            {mode === 'feedback' ? 'Feedback Mode' : 'Ask anything · Give feedback'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={resetChat} className="p-1 rounded-lg hover:bg-white/10" title="New chat">
            <RotateCcw className="h-3.5 w-3.5 text-white/80" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10" title="Minimize">
            <Minimize2 className="h-4 w-4 text-white/80" />
          </button>
        </div>
      </div>

      {/* Mode indicator */}
      {mode === 'feedback' && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <span className="text-[10px] font-medium text-amber-700 flex items-center gap-1">
            <MessageSquarePlus className="h-3 w-3" /> Feedback Mode
          </span>
          <button onClick={() => setMode('auto')} className="text-[10px] text-amber-600 hover:text-amber-800 underline">
            Switch to CRM
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[#800000]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-[#800000]" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-[#800000] text-white rounded-br-md' 
                : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}>
              {msg.text.split('\n').map((line, j) => {
                // Handle bold markdown
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>
                    {parts.map((part, k) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={k}>{part.slice(2, -2)}</strong>;
                      }
                      // Handle inline code
                      if (part.includes('`')) {
                        const codeParts = part.split(/(`[^`]+`)/g);
                        return codeParts.map((cp, ci) => {
                          if (cp.startsWith('`') && cp.endsWith('`')) {
                            return <code key={ci} className="bg-gray-200 px-1 rounded text-xs">{cp.slice(1, -1)}</code>;
                          }
                          return cp;
                        });
                      }
                      return part;
                    })}
                  </p>
                );
              })}
              {msg.feedbackId && (
                <Badge variant="outline" className="mt-2 text-[10px] bg-green-50 border-green-200 text-green-700">
                  Feedback submitted
                </Badge>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-[#800000]/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-[#800000] animate-pulse" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Quick Questions + Feedback button (show only at start) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {quickQuestions.map((q, i) => (
              <button key={i} onClick={() => setInput(q)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-[#800000]/20 text-[#800000] hover:bg-[#800000]/5 transition-colors">
                {q}
              </button>
            ))}
          </div>
          <button onClick={switchToFeedback} data-testid="ai-feedback-mode-btn"
            className="w-full text-[10px] px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
            <MessageSquarePlus className="h-3 w-3" /> Give Feedback or Report an Issue
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-gray-50">
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={mode === 'feedback' ? 'Describe your feedback...' : 'Ask about your CRM data...'}
            className="flex-1 h-10 text-sm rounded-xl bg-white"
            disabled={loading}
            data-testid="ai-assistant-input" />
          <Button onClick={handleSend} disabled={loading || !input.trim()}
            className="h-10 w-10 p-0 rounded-xl bg-[#800000] hover:bg-[#9a1919]"
            data-testid="ai-assistant-send">
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
