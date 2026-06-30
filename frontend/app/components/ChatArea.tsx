"use client";

import React, { useEffect, useRef, useState } from "react";
import { api, MessageItem, ChatMetadata } from "../lib/api";
import { Send, Sparkles, Cpu, ChevronRight, User, Terminal, Check, Copy, ChevronDown, Menu } from "lucide-react";

interface ChatAreaProps {
  chatId: string | null;
  onChatCreated: (chatId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  newChatTrigger?: number;
  onOpenSidebar: () => void;
}

export default function ChatArea({
  chatId,
  onChatCreated,
  selectedModel,
  onModelChange,
  newChatTrigger,
  onOpenSidebar,
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

  const parseMarkdownToReact = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const parseInline = (inlineText: string): React.ReactNode[] => {
      const parts = [];
      const regex = /(\*\*|`|\*)(.*?)\1/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(inlineText)) !== null) {
        const textBefore = inlineText.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(textBefore);
        }

        const delimiter = match[1];
        const content = match[2];

        if (delimiter === "**") {
          parts.push(<strong key={match.index} className="font-bold text-zinc-950">{content}</strong>);
        } else if (delimiter === "`") {
          parts.push(<code key={match.index} className="px-1.5 py-0.5 rounded bg-zinc-100 text-rose-600 font-mono text-[11px] font-semibold">{content}</code>);
        } else if (delimiter === "*") {
          parts.push(<em key={match.index} className="italic text-zinc-800">{content}</em>);
        }

        lastIndex = regex.lastIndex;
      }

      const remaining = inlineText.substring(lastIndex);
      if (remaining) {
        parts.push(remaining);
      }

      return parts;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        const itemText = line.trim().substring(2);
        listItems.push(
          <li key={i} className="list-disc ml-5 mb-1 text-zinc-700">
            {parseInline(itemText)}
          </li>
        );
        continue;
      } else {
        if (inList) {
          elements.push(<ul key={`list-${i}`} className="space-y-1 my-2">{listItems}</ul>);
          inList = false;
        }
      }

      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("### ")) {
        elements.push(<h4 key={i} className="text-base font-bold text-zinc-900 mt-5 mb-2 block">{parseInline(trimmedLine.substring(4))}</h4>);
      } else if (trimmedLine.startsWith("## ")) {
        elements.push(<h3 key={i} className="text-lg font-bold text-zinc-900 mt-6 mb-2.5 block">{parseInline(trimmedLine.substring(3))}</h3>);
      } else if (trimmedLine.startsWith("# ")) {
        elements.push(<h2 key={i} className="text-xl font-bold text-zinc-900 mt-7 mb-3 block">{parseInline(trimmedLine.substring(2))}</h2>);
      } else if (trimmedLine === "---") {
        elements.push(<hr key={i} className="my-4 border-zinc-200" />);
      } else if (trimmedLine !== "") {
        elements.push(<p key={i} className="mb-2.5 text-zinc-850 leading-relaxed">{parseInline(line)}</p>);
      } else {
        elements.push(<div key={i} className="h-2" />);
      }
    }

    if (inList) {
      elements.push(<ul key="list-end" className="space-y-1 my-2">{listItems}</ul>);
    }

    return elements;
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
      return <div className="space-y-1">{parseMarkdownToReact(content)}</div>;
    }

    return (
      <div className="space-y-4">
        {parts.map((part, idx) => {
          const partId = `${msgIndex}-${idx}`;
          if (part.type === "code") {
            return (
              <div key={partId} className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-[11px] my-3">
                <div className="flex items-center justify-between bg-zinc-100/80 px-4 py-2 text-zinc-500 border-b border-zinc-200">
                  <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px]">
                    <Terminal className="h-3.5 w-3.5" /> {part.lang || "code"}
                  </span>
                  <button
                    onClick={() => copyToClipboard(part.value || "", partId)}
                    className="flex items-center gap-1 hover:text-zinc-950 transition-colors cursor-pointer"
                  >
                    {copiedId === partId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[9px] text-emerald-600 font-black">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-bold">Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-zinc-800 leading-relaxed font-mono">
                  <code>{part.value}</code>
                </pre>
              </div>
            );
          }

          return (
            <div key={partId} className="space-y-1">
              {parseMarkdownToReact(part.value || "")}
            </div>
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
    <div className="flex flex-1 flex-col h-screen bg-zinc-50/20">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200/50 bg-white/70 backdrop-blur-md px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 lg:hidden cursor-pointer active:scale-95 shadow-sm"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-850 leading-tight">
              {metadata?.title ? metadata.title : "New Session"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                {selectedModel || "Loading model..."}
              </span>
              {metadata?.total_tokens !== undefined && metadata.total_tokens > 0 && (
                <>
                  <span className="text-[9px] text-zinc-300">•</span>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    {metadata.total_tokens.toLocaleString()} Tokens
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
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-indigo-100/50 blur-xl scale-125" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg border border-indigo-500">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900">Start a new conversation</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed font-semibold">
                Ask a complex question, write or debug code, or audit API token metadata dynamically.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 w-full max-w-xl pt-4">
              {samplePrompts.map((prompt) => (
                <div
                  key={prompt.title}
                  onClick={() => setInput(prompt.text)}
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span className="text-[11px] font-black text-zinc-800 flex items-center gap-1 uppercase tracking-wider">
                    {prompt.title} <ChevronRight className="h-3 w-3 text-zinc-400 group-hover:text-indigo-600 transition-all group-hover:translate-x-0.5" />
                  </span>
                  <p className="mt-2 text-xs text-zinc-500 leading-normal line-clamp-2">{prompt.text}</p>
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                      <Cpu className="h-4.5 w-4.5" />
                    </div>
                  )}

                  <div className="space-y-1.5 max-w-[85%]">
                    <div
                      className={`rounded-2xl px-4.5 py-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] leading-relaxed border ${
                        isUser
                          ? "bg-indigo-600 text-white border-indigo-550 rounded-tr-sm"
                          : "bg-white text-zinc-800 border-zinc-200/60 rounded-tl-sm"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed tracking-tight">{msg.content}</p>
                      ) : (
                        renderContent(msg.content, index)
                      )}
                    </div>

                    {!isUser && msg.usage_metadata && (
                      <div className="flex flex-wrap items-center gap-3 px-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>Prompt: {msg.usage_metadata.input_tokens}</span>
                        <span>•</span>
                        <span>Reply: {msg.usage_metadata.output_tokens}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-black">Total: {msg.usage_metadata.total_tokens}</span>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 border border-zinc-200/50 shadow-sm">
                      <User className="h-4.5 w-4.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-4 justify-start animate-slide-up-fade">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                  <Cpu className="h-4.5 w-4.5" />
                </div>
                <div className="rounded-2xl bg-white border border-zinc-200/60 rounded-tl-sm px-4.5 py-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="px-6 pb-6 pt-2">
        <div className="max-w-3xl mx-auto flex flex-col border border-zinc-200 rounded-2xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.01),0_12px_24px_-4px_rgba(0,0,0,0.04)] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-150 transition-all duration-200">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="w-full resize-none bg-transparent py-2 px-3.5 text-sm text-zinc-800 outline-none max-h-48 overflow-y-auto leading-relaxed border-0 focus:ring-0 focus:outline-none"
          />
          
          <div className="flex items-center justify-between border-t border-zinc-100 pt-2 px-1 mt-1">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 cursor-pointer"
              >
                <span>{selectedModel || "Select Model"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              {modelDropdownOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg max-h-48 overflow-y-auto animate-slide-up-fade">
                  {models.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        onModelChange(model);
                        setModelDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer"
                    >
                      <span className="truncate">{model}</span>
                      {selectedModel === model && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-30 disabled:hover:shadow-none disabled:active:scale-100 cursor-pointer shrink-0 animate-fade-in"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-center text-[9px] font-bold text-zinc-400 mt-2.5 uppercase tracking-widest">
          Secured workspace • Running on {selectedModel}
        </p>
      </div>
    </div>
  );
}
