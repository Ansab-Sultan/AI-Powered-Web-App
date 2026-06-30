"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api, ChatMetadata } from "../lib/api";
import { Plus, MessageSquare, Trash2, LogOut, Sparkles, X } from "lucide-react";

interface SidebarProps {
  activeChatId: string | null;
  onSelectChat: (chatId: string | null) => void;
  showDashboard: boolean;
  onToggleDashboard: (show: boolean, tab?: "analytics" | "settings") => void;
  onLogout: () => void;
  refreshTrigger: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  activeChatId,
  onSelectChat,
  showDashboard,
  onToggleDashboard,
  onLogout,
  refreshTrigger,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatMetadata[]>([]);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Chat Workspace";

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await api.getChats();
      setChats(res.chats || []);
    } catch {
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChats();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeChatId, refreshTrigger, fetchChats]);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      await api.deleteChat(chatId);
      if (activeChatId === chatId) {
        onSelectChat(null);
      } else {
        await fetchChats();
      }
    } catch {
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-80 shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:shadow-sm lg:translate-x-0 ${
      isMobileOpen ? "translate-x-0" : "-translate-x-full"
    }`}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-150">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 leading-tight">{appName}</h1>
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest leading-none">workspace</span>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-105 hover:text-zinc-700 lg:hidden cursor-pointer active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4">
        <button
          onClick={() => {
            onToggleDashboard(false);
            onSelectChat(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-500 hover:shadow-lg active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {loadingChats && chats.length === 0 ? (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <MessageSquare className="h-8 w-8 text-zinc-300 mx-auto" />
            <p className="text-[11px] font-semibold text-zinc-400">No conversations yet</p>
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = activeChatId === chat.chat_id && !showDashboard;
            return (
              <div
                key={chat.chat_id}
                onClick={() => {
                  onToggleDashboard(false);
                  onSelectChat(chat.chat_id);
                }}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-indigo-50/70 text-indigo-600"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600" : "text-zinc-400"}`} />
                  <span className="truncate">{chat.title || `Chat ${chat.chat_id.substring(0, 8)}`}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(e, chat.chat_id)}
                  className="rounded-lg p-1 text-zinc-400 opacity-0 transition-all hover:bg-zinc-100 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {user && (
        <div className="border-t border-zinc-100 p-4 bg-zinc-50/40 flex items-center justify-between gap-3">
          <div
            onClick={() => onToggleDashboard(true, "analytics")}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer p-1.5 rounded-xl border border-transparent hover:border-zinc-200/50 hover:bg-white transition-all active:scale-[0.98]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-black text-[10px] text-white uppercase shadow-sm">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-800 truncate leading-tight">{user.name}</p>
              <p className="text-[9px] text-zinc-400 truncate leading-normal mt-0.5">{user.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50/40 transition-all active:scale-95 shrink-0"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
}
