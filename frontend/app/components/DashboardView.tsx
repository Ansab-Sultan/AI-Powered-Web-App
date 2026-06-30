"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, TokenUsageSummaryResponse, TokenUsageRecord } from "../lib/api";
import { BarChart2, Calendar, Database, Activity, ChevronLeft, ChevronRight, RefreshCw, Cpu, User, Shield, Trash2, ArrowLeft, Loader2 } from "lucide-react";

interface DashboardViewProps {
  activeTab: "analytics" | "settings";
  setActiveTab: (tab: "analytics" | "settings") => void;
  onClose: () => void;
}

export default function DashboardView({ activeTab, setActiveTab, onClose }: DashboardViewProps) {
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

  const pageSize = 10;

  const fetchAnalytics = async () => {
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
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [days, historyPage, activeTab]);

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
      await refreshProfile();
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setProfileError(null);
    setProfileLoading(true);
    try {
      await api.deleteAccount();
      logout();
    } catch (err: any) {
      setProfileError(err.message || "Failed to delete account.");
      setProfileLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatLogDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 h-screen">
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white p-6 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Chat
          </button>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <div>
            <h2 className="text-xl font-black text-slate-900 leading-tight">Dashboard Settings</h2>
            <p className="text-xs text-slate-400 font-semibold mt-1">Manage your account profile and inspect API token analytics</p>
          </div>

          <div className="flex border border-slate-200 rounded-lg bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === "analytics"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Token Analytics
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === "settings"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Account Settings
            </button>
          </div>
        </div>
      </header>

      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Timeframe Filter</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDays(d);
                      setHistoryPage(0);
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                      days === d
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loading && !summary ? (
            <div className="flex h-64 items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tokens</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{summary?.totals.total_tokens.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prompt Tokens</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{summary?.totals.total_input_tokens.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completion Tokens</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{summary?.totals.total_output_tokens.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Requests</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{summary?.totals.total_requests.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-6">Model Distribution Breakdown</h3>
                  <div className="space-y-5">
                    {!summary || summary.models.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-12">No usage logs available for this period</p>
                    ) : (
                      summary.models.map((model) => {
                        const percentage = getPercentage(model.total_tokens, summary.totals.total_tokens);
                        return (
                          <div key={model.model_name} className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <Cpu className="h-3.5 w-3.5 text-slate-400" /> {model.model_name}
                              </span>
                              <span className="font-black text-slate-900">{model.total_tokens.toLocaleString()} ({percentage}%)</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                style={{ width: `${percentage}%` }}
                                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                              />
                            </div>
                            <div className="flex gap-4 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              <span>Prompts: {model.total_input_tokens.toLocaleString()}</span>
                              <span>Completions: {model.total_output_tokens.toLocaleString()}</span>
                              <span>Requests: {model.request_count}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                  <h3 className="text-sm font-bold text-slate-900">LLM Provider Statistics</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-semibold text-slate-500">Avg Tokens / Request</span>
                      <span className="text-sm font-bold text-slate-800">
                        {summary && summary.totals.total_requests > 0
                          ? Math.round(summary.totals.total_tokens / summary.totals.total_requests).toLocaleString()
                          : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-semibold text-slate-500">Unique Models Used</span>
                      <span className="text-sm font-bold text-slate-800">
                        {summary ? summary.models.length : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-semibold text-slate-500">Start Date</span>
                      <span className="text-sm font-bold text-slate-800">
                        {summary ? new Date(summary.start_date).toLocaleDateString() : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-semibold text-slate-500">End Date</span>
                      <span className="text-sm font-bold text-slate-800">
                        {summary ? new Date(summary.end_date).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Detailed API Token Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Model Name</th>
                        <th className="px-6 py-4">Input Tokens</th>
                        <th className="px-6 py-4">Output Tokens</th>
                        <th className="px-6 py-4">Total Tokens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-slate-400">
                            No history logs found
                          </td>
                        </tr>
                      ) : (
                        history.map((record, index) => (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-medium text-slate-500">
                              {formatLogDate(record.timestamp)}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">
                              {record.model_name}
                            </td>
                            <td className="px-6 py-4 text-slate-600">{record.input_tokens.toLocaleString()}</td>
                            <td className="px-6 py-4 text-slate-600">{record.output_tokens.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-indigo-600">
                              {record.total_tokens.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalRecords > pageSize && (
                  <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                    <span className="text-xs text-slate-500">
                      Showing {historyPage * pageSize + 1} to{" "}
                      {Math.min((historyPage + 1) * pageSize, totalRecords)} of {totalRecords} logs
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                        disabled={historyPage === 0 || loading}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setHistoryPage((p) => p + 1)}
                        disabled={(historyPage + 1) * pageSize >= totalRecords || loading}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all"
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
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Account Details</h3>

          {profileError && (
            <div className="rounded-lg bg-red-50 p-3 border border-red-100">
              <p className="text-sm text-red-700 font-medium">{profileError}</p>
            </div>
          )}

          {profileSuccess && (
            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
              <p className="text-sm text-emerald-700 font-medium">{profileSuccess}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-2.5">
              <User className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</p>
                <p className="text-sm font-medium text-slate-700">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Access Role</p>
                <p className="text-sm font-medium text-slate-700 capitalize">{user.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 sm:col-span-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Member Registration Date</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(user.created_at)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Update Profile Information</h4>
            
            <div>
              <label className="text-sm font-semibold text-slate-700">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">New Password (optional)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            {password && (
              <div>
                <label className="text-sm font-semibold text-slate-700">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-red-100 pt-6">
            <h4 className="text-sm font-bold text-red-600">Danger Zone</h4>
            <p className="mt-1 text-xs text-slate-500">
              Deleting your account is permanent. It deletes your profile configuration and all associated conversations.
            </p>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete My Account
              </button>
            ) : (
              <div className="mt-4 rounded-lg bg-red-50 p-4 border border-red-200 space-y-3">
                <p className="text-xs font-semibold text-red-800">
                  Are you absolutely certain? This operation cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={profileLoading}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Yes, Delete Permanently
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
