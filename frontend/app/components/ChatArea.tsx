"use client";

import React, { useEffect, useRef, useState } from "react";
import { api, MessageItem, ChatMetadata } from "../lib/api";
import { Send, Sparkles, Cpu, ChevronRight, User, Terminal, HelpCircle, Check, Copy, ChevronDown } from "lucide-react";

interface ChatAreaProps {
  chatId: string | null;
  onChatCreated: (chatId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  newChatTrigger?: number;
}

export default function ChatArea({
  chatId,
  onChatCreated,
  selectedModel,
  onModelChange,
  newChatTrigger,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [metadata, setMetadata] = useState<ChatMetadata | null>(null);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingHistory, setFetchingHistory] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchHistory = async () => {
    if (!chatId) {
      setMessages([]);
      setMetadata(null);
      setInput("");
      return;
    }
    setFetchingHistory(true);
    try {
      const res = await api.getChatDetails(chatId);
      setMessages(res.messages || []);
      setMetadata(res.chat_metadata || null);
    } catch (_) {
    } finally {
      setFetchingHistory(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await api.getAvailableModels();
      setModels(res.all_models || []);
      if (!selectedModel && res.default_model) {
        onModelChange(res.default_model);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchHistory();
  }, [chatId, newChatTrigger]);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: MessageItem = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.chat(userMessage.content, chatId || undefined, selectedModel);
      
      const assistantMessage: MessageItem = {
        role: "assistant",
        content: res.response,
        timestamp: new Date().toISOString(),
        usage_metadata: res.usage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!chatId && res.chat_id) {
        onChatCreated(res.chat_id);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error: ${err.message || "Please try again later."}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const renderContent = (content: string, msgIndex: number) => {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push({ type: "text", value: textBefore });
      }

      const lang = match[1] || "code";
      const code = match[2];
      parts.push({ type: "code", lang, value: code });
      lastIndex = codeBlockRegex.lastIndex;
    }

    const remainingText = content.substring(lastIndex);
    if (remainingText) {
      parts.push({ type: "text", value: remainingText });
    }

    if (parts.length === 0) {
      return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
    }

    return (
      <div className="space-y-3">
        {parts.map((part, idx) => {
          const partId = `${msgIndex}-${idx}`;
          if (part.type === "code") {
            return (
              <div key={partId} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs">
                <div className="flex items-center justify-between bg-slate-100 px-4 py-2 text-slate-500 border-b border-slate-200">
                  <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                    <Terminal className="h-3.5 w-3.5" /> {part.lang || "code"}
                  </span>
                  <button
                    onClick={() => copyToClipboard(part.value || "", partId)}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                  >
                    {copiedId === partId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[10px] text-emerald-600 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold">Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-slate-800 leading-relaxed">
                  <code>{part.value}</code>
                </pre>
              </div>
            );
          }

          return (
            <p key={partId} className="whitespace-pre-wrap leading-relaxed">
              {part.value}
            </p>
          );
        })}
      </div>
    );
  };

  const samplePrompts = [
    { title: "Explain concepts", text: "Explain quantum computing in simple terms" },
    { title: "Debug code", text: "Find the memory leak in this async loop" },
    { title: "Refactor logic", text: "Improve the performance of this database lookup" },
  ];

  return (
    <div className="flex flex-1 flex-col h-screen bg-slate-50/30">
      <header className="flex h-16 shrink-0 items-center justify-between bg-transparent px-8 pt-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              {metadata?.title ? metadata.title : "New Session"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                Model: {selectedModel}
              </span>
              {metadata?.total_tokens !== undefined && metadata.total_tokens > 0 && (
                <>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Session Tokens: {metadata.total_tokens.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {fetchingHistory ? (
          <div className="flex h-full items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-extrabold text-slate-900">Start a new conversation</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Choose a model, ask a complex question, optimize code snippets, or analyze metadata tokens.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 w-full mt-4">
              {samplePrompts.map((prompt) => (
                <div
                  key={prompt.title}
                  onClick={() => setInput(prompt.text)}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all duration-200"
                >
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    {prompt.title} <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </span>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2">{prompt.text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div key={index} className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} animate-slide-up-fade`}>
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Cpu className="h-4.5 w-4.5" />
                    </div>
                  )}

                  <div className="space-y-1.5 max-w-[85%]">
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                        isUser
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-slate-800 border border-slate-100"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        renderContent(msg.content, index)
                      )}
                    </div>

                    {!isUser && msg.usage_metadata && (
                      <div className="flex flex-wrap items-center gap-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Input: {msg.usage_metadata.input_tokens}</span>
                        <span>•</span>
                        <span>Output: {msg.usage_metadata.output_tokens}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-extrabold">Total: {msg.usage_metadata.total_tokens}</span>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <User className="h-4.5 w-4.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-4 justify-start animate-slide-up-fade">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Cpu className="h-4.5 w-4.5" />
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3.5 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="bg-transparent px-6 pb-6 pt-2">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex flex-col border border-slate-200/80 rounded-2xl bg-white p-3 shadow-xl shadow-slate-100/60 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all duration-200">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full resize-none bg-transparent py-2 px-3 text-sm text-slate-800 outline-none max-h-48 overflow-y-auto leading-relaxed border-0 focus:ring-0 focus:outline-none"
          />
          
          <div className="flex items-center justify-between border-t border-slate-100/60 pt-2.5 px-1 mt-1">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100"
              >
                <span>{selectedModel || "Select Model"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {modelDropdownOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg max-h-48 overflow-y-auto animate-slide-up-fade">
                  {models.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        onModelChange(model);
                        setModelDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <span className="truncate">{model}</span>
                      {selectedModel === model && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-500 hover:shadow-md disabled:opacity-30 disabled:hover:shadow-none active:scale-95 shrink-0 animate-fade-in"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
          Running on {selectedModel}. Generates real-time metadata and stores chat history securely.
        </p>
      </div>
    </div>
  );
}
