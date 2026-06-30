"use client";

import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./auth/page";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import DashboardView from "./components/DashboardView";

export default function Home() {
  const { isLoading, isAuthenticated, logout } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [activeView, setActiveView] = useState<"chat" | "dashboard">("chat");
  const [dashboardTab, setDashboardTab] = useState<"analytics" | "settings">("analytics");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [newChatTrigger, setNewChatTrigger] = useState<number>(0);

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

  const handleToggleDashboard = (show: boolean, tab?: "analytics" | "settings") => {
    setActiveView(show ? "dashboard" : "chat");
    if (tab) {
      setDashboardTab(tab);
    }
  };

  const handleSelectChat = (chatId: string | null) => {
    setActiveChatId(chatId);
    if (chatId === null) {
      setNewChatTrigger((prev) => prev + 1);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        showDashboard={activeView === "dashboard"}
        onToggleDashboard={handleToggleDashboard}
        onLogout={logout}
        refreshTrigger={refreshTrigger}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeView === "dashboard" ? (
          <DashboardView
            activeTab={dashboardTab}
            setActiveTab={setDashboardTab}
            onClose={() => setActiveView("chat")}
          />
        ) : (
          <ChatArea
            chatId={activeChatId}
            onChatCreated={(newId) => {
              setActiveChatId(newId);
              setRefreshTrigger((prev) => prev + 1);
            }}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            newChatTrigger={newChatTrigger}
          />
        )}
      </main>
    </div>
  );
}
