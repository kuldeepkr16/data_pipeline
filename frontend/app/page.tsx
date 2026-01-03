'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Config, PipelineLog, PipelineRun, PipelineStage } from '../types';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { StatsOverview } from '../components/features/stats/StatsOverview';
import { DashboardCharts } from '../components/features/stats/DashboardCharts';
import { LogTable } from '../components/features/logs/LogTable';
import { LogFilters } from '../components/features/logs/LogFilters';
import { LogDetailsModal } from '../components/features/logs/LogDetailsModal';
import { PipelineGrid } from '../components/features/pipelines/PipelineGrid';
import { ConfigEditor } from '../components/features/pipelines/ConfigEditor';

interface LogStats {
  status_distribution: { name: string; value: number }[];
  pipeline_type_distribution: { name: string; value: number }[];
  runs_per_table: { source_tablename: string; total_runs: number; success_count: number; failed_count: number; total_rows: number }[];
  daily_runs: { run_date: string; runs: number; success: number; failed: number }[];
  totals: { total_runs: number; total_success: number; total_failed: number; total_rows_processed: number };
}

type TabType = 'pipelines' | 'configurations' | 'logs' | 'dashboard';

export default function Home() {
  const searchParams = useSearchParams();
  // --- State ---
  const [activeTab, setActiveTab] = useState<TabType>('pipelines');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['pipelines', 'configurations', 'logs', 'dashboard'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  const [configs, setConfigs] = useState<Config[]>([]);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]); // Kept for future use if grid needs it
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pipeline Grid State
  const [triggeringTable, setTriggeringTable] = useState<string | null>(null);
  const [loadedStats, setLoadedStats] = useState<Record<string, number>>({});
  const [selectedTimeRange, setSelectedTimeRange] = useState<number | null>(null);

  // Config State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Notification State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Logs State
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<PipelineLog | null>(null);

  // Date Filters
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const defaultStartDate = formatDate(thirtyDaysAgo);
  const defaultEndDate = formatDate(today);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  // --- API Calls ---

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, stagesRes, runsRes] = await Promise.all([
        fetch('http://localhost:8000/config'),
        fetch('http://localhost:8000/logs/stats/summary'),
        fetch('http://localhost:8000/stages').catch(() => ({ ok: false })),
        fetch('http://localhost:8000/runs').catch(() => ({ ok: false }))
      ]);

      if (!configRes.ok || !statsRes.ok) throw new Error('Failed to fetch data');

      setConfigs(await configRes.json());
      setStats(await statsRes.json());
      if (stagesRes.ok) setStages(await (stagesRes as Response).json());
      if (runsRes.ok) setPipelineRuns(await (runsRes as Response).json());
    } catch (err) {
      setError('Failed to load data. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!selectedTable) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: '10',
        source_tablename: selectedTable,
        start_date: startDate,
        end_date: endDate + 'T23:59:59'
      });
      const logsRes = await fetch(`http://localhost:8000/logs?${params.toString()}`);
      if (logsRes.ok) {
        setLogs(await logsRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, startDate, endDate, selectedTable]);

  const fetchLoadedStats = useCallback(async (hours: number | null) => {
    if (hours === null) {
      setLoadedStats({});
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/stats/records-loaded?hours=${hours}`);
      if (res.ok) setLoadedStats(await res.json());
    } catch (err) {
      console.error('Failed to fetch loaded stats', err);
    }
  }, []);

  // --- Effects ---

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    fetchLoadedStats(selectedTimeRange);
  }, [selectedTimeRange, fetchLoadedStats]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auto-refresh runs (Dynamic Polling)
  useEffect(() => {
    if (activeTab === 'pipelines') {
      const anyRunning = pipelineRuns.some(run => run.status === 'running' || run.status === 'pending');
      const pollInterval = anyRunning ? 5000 : 300000;
      const fetchRuns = async () => {
        try {
          const runsRes = await fetch('http://localhost:8000/runs');
          if (runsRes.ok) setPipelineRuns(await runsRes.json());
        } catch (e) { console.error(e); }
      };
      const interval = setInterval(fetchRuns, pollInterval);
      return () => clearInterval(interval);
    }
  }, [activeTab, pipelineRuns]);

  // --- Handlers ---

  const handleSaveConfig = async (updatedConfig: Config) => {
    try {
      const res = await fetch(`http://localhost:8000/config/${updatedConfig.source_tablename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
      if (!res.ok) throw new Error('Failed to update config');
      setConfigs(prev => prev.map(c => c.source_tablename === updatedConfig.source_tablename ? updatedConfig : c));
      setEditingId(null);
      setNotification({ message: 'Configuration saved successfully!', type: 'success' });
    } catch (err) {
      setNotification({ message: 'Failed to save configuration.', type: 'error' });
    }
  };

  const handleTriggerPipeline = async (source_tablename: string) => {
    setTriggeringTable(source_tablename);
    try {
      const res = await fetch(`http://localhost:8000/trigger/${source_tablename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_name: 'default', triggered_by: 'manual' }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNotification({ message: `Pipeline triggered! Run ID: ${data.run_id}`, type: 'success' });
      const runsRes = await fetch('http://localhost:8000/runs');
      if (runsRes.ok) setPipelineRuns(await runsRes.json());
    } catch (err) {
      setNotification({ message: 'Failed to trigger pipeline.', type: 'error' });
    } finally {
      setTriggeringTable(null);
    }
  };

  const handleToggleStatus = async (config: Config) => {
    const newStatus = config.source_to_dl_is_active ? 0 : 1;
    const updated = { ...config, source_to_dl_is_active: newStatus, dl_to_sink_is_active: newStatus };
    try {
      // Optimistic update
      setConfigs(prev => prev.map(c => c.source_tablename === config.source_tablename ? updated : c));
      await handleSaveConfig(updated);
    } catch {
      // Revert is handled by error notification logic in save
    }
  };

  const handleResetLogs = () => {
    setSelectedTable(null);
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setLogsPage(1);
    setLogs([]);
    setNotification({ message: 'Filters reset', type: 'success' });
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col">
      <div className="fixed inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/20 via-[#0f111a]/50 to-[#0f111a] pointer-events-none" />

      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="relative flex-grow flex flex-col items-center p-6 md:p-10 z-10">
        <div className="w-full max-w-7xl space-y-8">

          {loading && (
            <div className="flex flex-col justify-center items-center py-32 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="text-indigo-400 animate-pulse text-sm font-medium tracking-wide">Synchronizing Data...</div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
              <h3 className="text-lg font-medium text-white mb-1">Connection Error</h3>
              <p className="text-red-400/80 text-sm">{error}</p>
              <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors">
                Retry Connection
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="animate-fade-in space-y-6">
              {activeTab === 'pipelines' && (
                <PipelineGrid
                  configs={configs}
                  pipelineRuns={pipelineRuns}
                  loadedStats={loadedStats}
                  triggeringTable={triggeringTable}
                  onTrigger={handleTriggerPipeline}
                  onToggleStatus={handleToggleStatus}
                  onEdit={(config) => {
                    setActiveTab('configurations');
                    setEditingId(config.source_tablename);
                  }}
                  selectedTimeRange={selectedTimeRange}
                  setSelectedTimeRange={setSelectedTimeRange}
                />
              )}

              {activeTab === 'dashboard' && (
                <>
                  <StatsOverview stats={stats} />
                  <DashboardCharts stats={stats} />
                </>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <LogFilters
                    startDate={startDate} setStartDate={setStartDate}
                    endDate={endDate} setEndDate={setEndDate}
                    selectedTable={selectedTable} setSelectedTable={setSelectedTable}
                    onRefresh={fetchLogs}
                    onReset={handleResetLogs}
                    configs={configs}
                  />
                  <LogTable
                    logs={logs}
                    loading={logsLoading}
                    selectedTable={selectedTable}
                    page={logsPage}
                    setPage={setLogsPage}
                    onShowDetails={setSelectedLog}
                  />
                </div>
              )}

              {activeTab === 'configurations' && (
                <ConfigEditor
                  configs={configs}
                  onSave={handleSaveConfig}
                  onEdit={(config) => { setEditingId(config.source_tablename); }}
                  editingId={editingId}
                  setEditingId={setEditingId}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {notification && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl flex items-center space-x-3 border backdrop-blur-xl z-50 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          <p className="font-medium text-sm">{notification.message}</p>
        </div>
      )}

      <LogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
