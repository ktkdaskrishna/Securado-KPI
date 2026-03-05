import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiAssistantAPI } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Bot, Send, Minimize2, Sparkles, User, Loader2, MessageSquarePlus, RotateCcw, Mic, MicOff, Paperclip, X, Download, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const CHART_COLORS = ['#800000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

function InlineChart({ chartData }) {
  if (!chartData) return null;
  const { type, title, data } = chartData;
  return (
    <div className="mt-2 p-2 bg-white rounded-lg border">
      {title && <p className="text-[10px] font-semibold text-gray-600 mb-1">{title}</p>}
      <div className="h-32">
        <ResponsiveContainer>
          {type === 'pie' ? (
            <PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} label={({ name, percent }) => `${name.substring(0, 8)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={8}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie><Tooltip formatter={(v) => v.toLocaleString()} /></PieChart>
          ) : type === 'line' ? (
            <LineChart data={data}><XAxis dataKey="name" fontSize={8} /><YAxis fontSize={8} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#800000" strokeWidth={2} dot={{ r: 2 }} /></LineChart>
          ) : (
            <BarChart data={data}><XAxis dataKey="name" fontSize={8} /><YAxis fontSize={8} /><Tooltip /><Bar dataKey="value" fill="#800000" radius={[2, 2, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar></BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function parseChartFromText(text) {
  const chartMatch = text.match(/```chart\s*\n?([\s\S]*?)\n?```/);
  if (!chartMatch) return { cleanText: text, chart: null };
  try {
    const chart = JSON.parse(chartMatch[1]);
    const cleanText = text.replace(/```chart\s*\n?[\s\S]*?\n?```/, '').trim();
    return { cleanText, chart };
  } catch { return { cleanText: text, chart: null }; }
}

const FEEDBACK_KEYWORDS = ['feedback', 'bug', 'issue', 'report', 'suggestion', 'broken', 'not working', 'wrong', 'error', 'fix', 'problem'];
function detect_feedback_intent_client(text) {
  const q = (text || '').toLowerCase();
  return FEEDBACK_KEYWORDS.some(kw => q.includes(kw));
}

export default function AiAssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your CRM AI Assistant. Ask me anything about your pipeline, invoices, activities, or performance.\n\nYou can also share feedback (with screenshots) or use voice input." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('auto');
  // Stable session per browser — persists across page reloads for conversation memory
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('ai_session_id');
    if (stored) return stored;
    const newId = `crm-${Date.now()}`;
    localStorage.setItem('ai_session_id', newId);
    return newId;
  });
  const [recording, setRecording] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question || '(attachment)', attachmentCount: attachments.length }]);
    setLoading(true);

    try {
      let data;
      if (attachments.length > 0 && (mode === 'feedback' || detect_feedback_intent_client(question))) {
        // Has attachments — submit as feedback with attachments
        const res = await aiAssistantAPI.submitFeedbackWithAttachment(question, sessionId, attachments);
        data = res.data;
      } else {
        const res = await aiAssistantAPI.chat(question, sessionId, mode);
        data = res.data;
      }
      const { cleanText, chart } = parseChartFromText(data.answer);
      const msg = { role: 'assistant', text: cleanText, chart };
      if (data.feedback_submitted) msg.feedbackId = data.feedback_id;
      setMessages(prev => [...prev, msg]);
      if (data.feedback_submitted) { setMode('auto'); setAttachments([]); }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally { setLoading(false); }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return;
        setLoading(true);
        setMessages(prev => [...prev, { role: 'user', text: '(voice message)', isVoice: true }]);
        try {
          const res = await aiAssistantAPI.transcribeVoice(blob);
          const transcribed = res.data?.text || '';
          if (transcribed) {
            setMessages(prev => { const updated = [...prev]; updated[updated.length - 1].text = transcribed; return updated; });
            const chatRes = await aiAssistantAPI.chat(transcribed, sessionId, mode);
            const { cleanText, chart } = parseChartFromText(chatRes.data.answer);
            const msg = { role: 'assistant', text: cleanText, chart };
            if (chatRes.data.feedback_submitted) msg.feedbackId = chatRes.data.feedback_id;
            setMessages(prev => [...prev, msg]);
          } else {
            setMessages(prev => [...prev, { role: 'assistant', text: "I couldn't understand the audio. Please try again or type your question." }]);
          }
        } catch { setMessages(prev => [...prev, { role: 'assistant', text: 'Voice transcription failed. Please try typing.' }]); }
        finally { setLoading(false); }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch { setMessages(prev => [...prev, { role: 'assistant', text: 'Microphone access denied. Please allow microphone access in your browser.' }]); }
  }, [sessionId, mode]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  const switchToFeedback = () => {
    setMode('feedback');
    setMessages(prev => [...prev, { role: 'assistant', text: "I'm ready to collect your feedback. Describe the issue and optionally attach screenshots using the paperclip button.\n\nTip: Include the module name and priority if possible." }]);
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', text: "Hi! I'm your CRM AI Assistant. Ask me anything about your pipeline, invoices, activities, or performance.\n\nYou can also share feedback (with screenshots) or use voice input." }]);
    setMode('auto'); setAttachments([]);
    // New session for fresh conversation
    const newId = `crm-${Date.now()}`;
    localStorage.setItem('ai_session_id', newId);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setAttachments(prev => [...prev, ...files].slice(0, 3));
    e.target.value = '';
  };

  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const exportChatAsText = () => {
    const text = messages.map(m => `[${m.role}]: ${m.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'crm-chat-export.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const quickQuestions = [
    "What's my pipeline for 2026?",
    "Show overdue invoices",
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
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[580px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
      data-testid="ai-assistant-panel">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#800000] to-[#5a0000] px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">CRM AI Assistant</p>
          <p className="text-white/60 text-[10px]">
            {mode === 'feedback' ? 'Feedback Mode — attach screenshots' : 'Ask anything · Voice · Charts · Feedback'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={exportChatAsText} className="p-1 rounded-lg hover:bg-white/10" title="Export chat"><Download className="h-3.5 w-3.5 text-white/80" /></button>
          <button onClick={resetChat} className="p-1 rounded-lg hover:bg-white/10" title="New chat"><RotateCcw className="h-3.5 w-3.5 text-white/80" /></button>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10" title="Minimize"><Minimize2 className="h-4 w-4 text-white/80" /></button>
        </div>
      </div>

      {/* Mode indicator */}
      {mode === 'feedback' && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <span className="text-[10px] font-medium text-amber-700 flex items-center gap-1">
            <MessageSquarePlus className="h-3 w-3" /> Feedback Mode — attach screenshots with paperclip
          </span>
          <button onClick={() => { setMode('auto'); setAttachments([]); }} className="text-[10px] text-amber-600 hover:text-amber-800 underline">Switch to CRM</button>
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
              msg.role === 'user' ? 'bg-[#800000] text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}>
              {msg.isVoice && <Badge variant="outline" className="text-[9px] mb-1 border-white/30 text-white/70"><Mic className="h-2 w-2 mr-0.5" />Voice</Badge>}
              {msg.text.split('\n').map((line, j) => {
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>
                    {parts.map((part, k) => {
                      if (part.startsWith('**') && part.endsWith('**')) return <strong key={k}>{part.slice(2, -2)}</strong>;
                      if (part.includes('`')) {
                        const cp = part.split(/(`[^`]+`)/g);
                        return cp.map((c, ci) => c.startsWith('`') && c.endsWith('`') ? <code key={ci} className="bg-gray-200 px-1 rounded text-xs">{c.slice(1, -1)}</code> : c);
                      }
                      return part;
                    })}
                  </p>
                );
              })}
              {msg.attachmentCount > 0 && <Badge variant="outline" className="mt-1 text-[9px] border-white/30 text-white/70"><Paperclip className="h-2 w-2 mr-0.5" />{msg.attachmentCount} file(s)</Badge>}
              {msg.chart && <InlineChart chartData={msg.chart} />}
              {msg.feedbackId && <Badge variant="outline" className="mt-2 text-[10px] bg-green-50 border-green-200 text-green-700">Feedback submitted</Badge>}
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

      {/* Quick Questions + Feedback (show only at start) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {quickQuestions.map((q, i) => (
              <button key={i} onClick={() => setInput(q)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-[#800000]/20 text-[#800000] hover:bg-[#800000]/5 transition-colors">{q}</button>
            ))}
            <button onClick={() => setInput("Show me a pipeline chart by stage")}
              className="text-[10px] px-2.5 py-1 rounded-full border border-[#800000]/20 text-[#800000] hover:bg-[#800000]/5 transition-colors flex items-center gap-1">
              <BarChart3 className="h-2.5 w-2.5" /> Pipeline chart
            </button>
          </div>
          <button onClick={switchToFeedback} data-testid="ai-feedback-mode-btn"
            className="w-full text-[10px] px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
            <MessageSquarePlus className="h-3 w-3" /> Give Feedback or Report an Issue
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="px-3 pb-1 flex gap-1.5 overflow-x-auto">
          {attachments.map((f, i) => (
            <div key={i} className="relative shrink-0 px-2 py-1 bg-gray-100 rounded-lg text-[10px] text-gray-600 flex items-center gap-1">
              <Paperclip className="h-2.5 w-2.5" /> {f.name?.substring(0, 15) || 'file'}
              <button onClick={() => removeAttachment(i)} className="ml-0.5 hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-gray-50">
        <div className="flex gap-1.5">
          {/* Attach button (always available) */}
          <button onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex items-center justify-center rounded-xl border bg-white hover:bg-gray-50 shrink-0" title="Attach file" data-testid="ai-attach-btn">
            <Paperclip className="h-4 w-4 text-gray-500" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
          
          <Input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={mode === 'feedback' ? 'Describe your feedback...' : 'Ask about CRM data or use mic...'}
            className="flex-1 h-10 text-sm rounded-xl bg-white"
            disabled={loading || recording}
            data-testid="ai-assistant-input" />
          
          {/* Voice button */}
          <button onClick={recording ? stopRecording : startRecording}
            className={`h-10 w-10 flex items-center justify-center rounded-xl border shrink-0 transition-colors ${recording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-white hover:bg-gray-50 text-gray-500'}`}
            disabled={loading} title={recording ? 'Stop recording' : 'Voice input'} data-testid="ai-voice-btn">
            {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          
          <Button onClick={handleSend} disabled={loading || (!input.trim() && attachments.length === 0)}
            className="h-10 w-10 p-0 rounded-xl bg-[#800000] hover:bg-[#9a1919] shrink-0"
            data-testid="ai-assistant-send">
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
