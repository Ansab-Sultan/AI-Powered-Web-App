"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api, TokenUsageSummaryResponse, TokenUsageRecord } from "../lib/api";
import {
  Calendar,
  Database,
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Cpu,
  User,
  Trash2,
  ArrowLeft,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Menu,
} from "lucide-react";

interface DashboardViewProps {
  activeTab: "analytics" | "settings";
  setActiveTab: (tab: "analytics" | "settings") => void;
  onClose: () => void;
  onOpenSidebar: () => void;
}

export default function DashboardView({ activeTab, setActiveTab, onClose, onOpenSidebar }: DashboardViewProps) {
  const { user, refreshProfile, logout } = useAuth();

  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<TokenUsageSummaryResponse | null>(null);
  const [history, setHistory] = useState<TokenUsageRecord[]>([]);
  const [historyPage, setHistoryPage] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [name, setName] = useState<string>(user?.name || "");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const pageSize = 10;

  /**
   * Fetches token usage summary and logs from the backend.
   */
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const summaryRes = await api.getTokenUsageSummary(undefined, days);
      setSummary(summaryRes);

      const historyRes = await api.getTokenUsageHistory(
        undefined,
        undefined,
        pageSize,
        historyPage * pageSize
      );
      setHistory(historyRes.records || []);
      setTotalRecords(historyRes.total_records || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [days, historyPage]);

  useEffect(() => {
    if (activeTab === "analytics") {
      const timer = setTimeout(() => {
        fetchAnalytics();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchAnalytics]);

  useEffect(() => {
    if (user?.name) {
      const timer = setTimeout(() => {
        setName(user.name);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  /**
   * Submits updated profile information to the backend.
   */
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (password && password !== confirmPassword) {
      setProfileError("Passwords do not match.");
      return;
    }

    setProfileLoading(true);
    try {
      await api.updateProfile(name || undefined, password || undefined);
      setProfileSuccess("Profile updated successfully.");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      await refreshProfile();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update profile.";
      setProfileError(errorMsg);
    } finally {
      setProfileLoading(false);
    }
  };

  /**
   * Deletes the user account permanently.
   */
  const handleDeleteAccount = async () => {
    setProfileError(null);
    setProfileLoading(true);
    try {
      await api.deleteAccount();
      logout();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete account.";
      setProfileError(errorMsg);
      setProfileLoading(false);
    }
  };

  /**
   * Formats a ISO date string to a human-readable local date format.
   */
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  /**
   * Formats API log timestamps to a condensed readable date.
   */
  const formatLogDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * Calculates the percentage value relative to a total.
   */
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  /**
   * Returns visual theme classes and gradients mapped to specific LLM models.
   */
  const getModelColors = (modelName: string) => {
    const name = modelName.toLowerCase();
    if (name.includes("gemini")) {
      return {
        bar: "bg-gradient-to-r from-emerald-500 to-teal-600",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-250/25",
        iconColor: "text-emerald-500",
      };
    } else if (name.includes("llama")) {
      return {
        bar: "bg-gradient-to-r from-amber-500 to-orange-600",
        badge: "bg-amber-50 text-amber-700 border-amber-250/25",
        iconColor: "text-amber-500",
      };
    } else if (name.includes("mixtral") || name.includes("mistral")) {
      return {
        bar: "bg-gradient-to-r from-blue-500 to-indigo-600",
        badge: "bg-blue-50 text-blue-700 border-blue-250/25",
        iconColor: "text-blue-500",
      };
    } else if (name.includes("gemma")) {
      return {
        bar: "bg-gradient-to-r from-fuchsia-500 to-rose-600",
        badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-250/25",
        iconColor: "text-fuchsia-500",
      };
    }
    return {
      bar: "bg-gradient-to-r from-indigo-500 to-purple-600",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-250/25",
      iconColor: "text-indigo-500",
    };
  };

  /**
   * Retrieves the initials of a user name.
   */
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
    <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 md:p-8 h-screen animate-fade-in">
      <header className="flex flex-col gap-5 border border-zinc-200/60 bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="group flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm transition-all hover:border-zinc-300 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Chat
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 lg:hidden cursor-pointer active:scale-95 shadow-sm"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl md:text-2xl font-black text-zinc-900 leading-tight">
              Workspace Control Center
            </h2>
            <p className="text-xs text-zinc-450 font-semibold mt-1">
              Manage account preferences and audit LLM token usage stats
            </p>
          </div>

          <div className="flex border border-zinc-200/80 rounded-xl bg-zinc-100/80 p-1 shadow-inner backdrop-blur-sm">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-white text-indigo-600 shadow-sm border border-zinc-200/20"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-white/40"
              }`}
            >
              Token Analytics
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === "settings"
                  ? "bg-white text-indigo-600 shadow-sm border border-zinc-200/20"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-white/40"
              }`}
            >
              Account Preferences
            </button>
          </div>
        </div>
      </header>

      {activeTab === "analytics" && (
        <div className="space-y-6 animate-slide-in-right">
          <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black text-zinc-450 uppercase tracking-widest">
                Timeframe Period
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-zinc-200/80 bg-zinc-50 p-1">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDays(d);
                      setHistoryPage(0);
                    }}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      days === d
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-150"
                        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              </button>
            </div>
          </div>

          {loading && !summary ? (
            <div className="flex h-64 items-center justify-center">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-355 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-55/40 text-indigo-650 border border-indigo-100/50 group-hover:scale-105 transition-transform duration-300">
                    <Database className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                      Total Tokens
                    </p>
                    <p className="font-heading text-xl md:text-2xl font-black text-zinc-955 mt-1.5 tracking-tight leading-tight">
                      {summary?.totals.total_tokens.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-355 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-55/40 text-blue-650 border border-blue-100/50 group-hover:scale-105 transition-transform duration-300">
                    <Activity className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                      Prompt Tokens
                    </p>
                    <p className="font-heading text-xl md:text-2xl font-black text-zinc-955 mt-1.5 tracking-tight leading-tight">
                      {summary?.totals.total_input_tokens.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-355 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fuchsia-55/40 text-fuchsia-650 border border-fuchsia-100/50 group-hover:scale-105 transition-transform duration-300">
                    <Activity className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                      Completion Tokens
                    </p>
                    <p className="font-heading text-xl md:text-2xl font-black text-zinc-955 mt-1.5 tracking-tight leading-tight">
                      {summary?.totals.total_output_tokens.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-355 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-55/40 text-emerald-650 border border-emerald-100/50 group-hover:scale-105 transition-transform duration-300">
                    <Calendar className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                      Total Sessions
                    </p>
                    <p className="font-heading text-xl md:text-2xl font-black text-zinc-955 mt-1.5 tracking-tight leading-tight">
                      {summary?.totals.total_requests.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest mb-6 border-b border-zinc-100 pb-3">
                    Model Distribution Breakdown
                  </h3>
                  <div className="space-y-4">
                    {!summary || summary.models.length === 0 ? (
                      <p className="text-center text-xs text-zinc-450 py-12">
                        No usage logs available for this period
                      </p>
                    ) : (
                      summary.models.map((model) => {
                        const percentage = getPercentage(model.total_tokens, summary.totals.total_tokens);
                        const colors = getModelColors(model.model_name);
                        return (
                          <div
                            key={model.model_name}
                            className="space-y-3 p-4 rounded-xl border border-zinc-150/60 bg-zinc-50/20 hover:bg-zinc-50/50 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between text-xs gap-2">
                              <span className="font-bold text-zinc-850 flex items-center gap-2 min-w-0">
                                <Cpu className={`h-4 w-4 shrink-0 ${colors.iconColor}`} />
                                <span className="truncate">{model.model_name}</span>
                              </span>
                              <span className="font-black text-zinc-900 shrink-0">
                                {model.total_tokens.toLocaleString()}{" "}
                                <span className="text-zinc-400 font-semibold ml-1">({percentage}%)</span>
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-200/60 overflow-hidden">
                              <div
                                style={{ width: `${percentage}%` }}
                                className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                              />
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-455 font-black uppercase tracking-widest">
                              <span>Prompts: {model.total_input_tokens.toLocaleString()}</span>
                              <span className="text-zinc-300">•</span>
                              <span>Replies: {model.total_output_tokens.toLocaleString()}</span>
                              <span className="text-zinc-300">•</span>
                              <span>Sessions: {model.request_count}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
                  <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest border-b border-zinc-100 pb-3">
                    Workspace Summary Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
                      <span className="text-xs font-semibold text-zinc-500">Avg Tokens / Session</span>
                      <span className="font-heading text-sm font-black text-indigo-650">
                        {summary && summary.totals.total_requests > 0
                          ? Math.round(summary.totals.total_tokens / summary.totals.total_requests).toLocaleString()
                          : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
                      <span className="text-xs font-semibold text-zinc-500">Unique Models Used</span>
                      <span className="font-heading text-sm font-black text-indigo-650">
                        {summary ? summary.models.length : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
                      <span className="text-xs font-semibold text-zinc-500">Start Date</span>
                      <span className="text-xs font-bold text-zinc-700">
                        {summary ? new Date(summary.start_date).toLocaleDateString() : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-semibold text-zinc-500">End Date</span>
                      <span className="text-xs font-bold text-zinc-700">
                        {summary ? new Date(summary.end_date).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-zinc-100">
                  <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest">
                    Detailed API Token Logs
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 border-b border-zinc-200 text-[10px] font-black text-zinc-450 uppercase tracking-widest">
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Model Name</th>
                        <th className="px-6 py-4 text-right">Input Tokens</th>
                        <th className="px-6 py-4 text-right">Output Tokens</th>
                        <th className="px-6 py-4 text-right">Total Tokens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-xs text-zinc-400 font-medium">
                            No token logs found
                          </td>
                        </tr>
                      ) : (
                        history.map((record, index) => {
                          const colors = getModelColors(record.model_name);
                          return (
                            <tr key={index} className="hover:bg-zinc-50/40 transition-colors">
                              <td className="px-6 py-4 font-semibold text-zinc-500">
                                {formatLogDate(record.timestamp)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold border ${colors.badge}`}>
                                  {record.model_name}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-zinc-650 font-medium">
                                {record.input_tokens.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right text-zinc-650 font-medium">
                                {record.output_tokens.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right font-black text-indigo-650">
                                {record.total_tokens.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {totalRecords > pageSize && (
                  <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
                    <span className="text-xs text-zinc-450 font-semibold">
                      Showing {historyPage * pageSize + 1} to{" "}
                      {Math.min((historyPage + 1) * pageSize, totalRecords)} of {totalRecords} logs
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                        disabled={historyPage === 0 || loading}
                        className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/20 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-zinc-500 disabled:hover:border-zinc-200 active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => p + 1)}
                        disabled={(historyPage + 1) * pageSize >= totalRecords || loading}
                        className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/20 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-zinc-500 disabled:hover:border-zinc-200 active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-slide-in-right">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/30">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest">
                  Profile Settings
                </h3>
              </div>

              {profileError && (
                <div className="rounded-xl bg-rose-50/60 p-3.5 border border-rose-200/40 flex items-start gap-2.5">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-850 font-bold leading-relaxed">{profileError}</p>
                </div>
              )}

              {profileSuccess && (
                <div className="rounded-xl bg-emerald-50/60 p-3.5 border border-emerald-250/40 flex items-start gap-2.5">
                  <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-850 font-bold leading-relaxed">{profileSuccess}</p>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    Display Name
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <User className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Name"
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 pl-10 pr-4 text-sm text-zinc-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    New Password (optional)
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <Lock className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 pl-10 pr-10 text-sm text-zinc-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {password && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <Lock className="h-4 w-4 text-zinc-400" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-3 pl-10 pr-10 text-sm text-zinc-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-zinc-100">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-500 active:scale-98 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-100 transition-all"
                  >
                    {profileLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Save Changes <Check className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative overflow-hidden bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
              <div className="p-6 flex flex-col items-center border-b border-zinc-100 bg-gradient-to-b from-zinc-50/30 to-transparent pt-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 font-heading text-xl font-black text-white uppercase shadow-md shadow-indigo-100 ring-4 ring-indigo-50">
                  {getInitials(user.name)}
                </div>
                <h4 className="font-heading text-base font-black text-zinc-900 mt-4 leading-tight">
                  {user.name}
                </h4>
                <span
                  className={`mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                    user.role === "admin"
                      ? "bg-amber-50 text-amber-700 border-amber-200/50"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200/50"
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 border border-zinc-200/40">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-zinc-455 uppercase tracking-widest leading-none">
                      Email Address
                    </p>
                    <p className="text-xs font-semibold text-zinc-700 truncate mt-1.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 border border-zinc-200/40">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-zinc-455 uppercase tracking-widest leading-none">
                      Member Since
                    </p>
                    <p className="text-xs font-semibold text-zinc-700 truncate mt-1.5">
                      {formatDate(user.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200/60 bg-rose-50/10 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="h-4.5 w-4.5" />
                <h4 className="text-xs font-black uppercase tracking-widest">Danger Zone</h4>
              </div>
              <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                Deleting your account is permanent. It deletes your profile configuration and all associated conversations.
              </p>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete My Account
                </button>
              ) : (
                <div className="rounded-xl bg-rose-50/50 p-4 border border-rose-100 space-y-3 animate-fade-in">
                  <p className="text-xs font-bold text-rose-800 leading-tight">
                    Are you absolutely certain? This operation cannot be undone.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={profileLoading}
                      className="w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                    >
                      Yes, Delete Permanently
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="w-full rounded-xl border border-zinc-200 bg-white py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
