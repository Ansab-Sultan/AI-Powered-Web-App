"use client";

import React, { useEffect, useState } from "react";
import { api, ChatMetadata } from "../lib/api";
import { Plus, MessageSquare, Trash2, Settings, BarChart2, LogOut, ChevronDown, Check, Sparkles } from "lucide-react";

interface SidebarProps {
  activeChatId: string | null;
  onSelectChat: (chatId: string | null) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  showAnalytics: boolean;
  onToggleAnalytics: (show: boolean) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  refreshTrigger: number;
}

export default function Sidebar({
  activeChatId,
  onSelectChat,
  selectedModel,
  onModelChange,
  showAnalytics,
  onToggleAnalytics,
  onOpenProfile,
  onLogout,
  refreshTrigger,
}: SidebarProps) {
  const [chats, setChats] = useState<ChatMetadata[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState<boolean>(false);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);

  const fetchChats = async () => {
    setLoadingChats(true);
    try {
      const res = await api.getChats();
      setChats(res.chats || []);
    } catch (_) {
    } finally {
      setLoadingChats(false);
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
    fetchChats();
  }, [activeChatId, refreshTrigger]);

  useEffect(() => {
    fetchModels();
  }, []);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      await api.deleteChat(chatId);
      if (activeChatId === chatId) {
        onSelectChat(null);
      } else {
        await fetchChats();
      }
    } catch (_) {}
  };

  return (
    <aside className="flex h-screen w-80 flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-none">Chat Workspace</h1>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">nexlab app</span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-100">
        <button
          onClick={() => {
            onToggleAnalytics(false);
            onSelectChat(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 hover:shadow-md active:scale-98"
        >
          <Plus className="h-4 w-4" /> New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {loadingChats && chats.length === 0 ? (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8">No conversations yet</p>
        ) : (
          chats.map((chat) => {
            const isActive = activeChatId === chat.chat_id && !showAnalytics;
            return (
              <div
                key={chat.chat_id}
                onClick={() => {
                  onToggleAnalytics(false);
                  onSelectChat(chat.chat_id);
                }}
                className={`group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 text-indigo-950 border-l-4 border-indigo-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate pr-2">{chat.title || `Chat ${chat.chat_id.substring(0, 8)}`}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(e, chat.chat_id)}
                  className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
        <div className="relative">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Model</label>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:bg-slate-100"
          >
            <span className="truncate">{selectedModel || "Select Model"}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg max-h-48 overflow-y-auto">
              {models.map((model) => (
                <button
                  key={model}
                  onClick={() => {
                    onModelChange(model);
                    setModelDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="truncate">{model}</span>
                  {selectedModel === model && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <button
            onClick={() => onToggleAnalytics(true)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
              showAnalytics
                ? "bg-indigo-50 text-indigo-950 border-l-4 border-indigo-600"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <BarChart2 className="h-4 w-4 text-slate-400" /> Token Analytics
          </button>

          <button
            onClick={onOpenProfile}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
          >
            <Settings className="h-4 w-4 text-slate-400" /> Account Settings
          </button>

          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
