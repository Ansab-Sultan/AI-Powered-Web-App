"use client";

import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./auth/page";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import AnalyticsPanel from "./components/AnalyticsPanel";
import ProfileModal from "./components/ProfileModal";

export default function Home() {
  const { isLoading, isAuthenticated, logout } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        showAnalytics={showAnalytics}
        onToggleAnalytics={setShowAnalytics}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={logout}
        refreshTrigger={refreshTrigger}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showAnalytics ? (
          <AnalyticsPanel />
        ) : (
          <ChatArea
            chatId={activeChatId}
            onChatCreated={(newId) => {
              setActiveChatId(newId);
              setRefreshTrigger((prev) => prev + 1);
            }}
            selectedModel={selectedModel}
          />
        )}
      </main>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
