'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
interface Config {
  source_tablename: string;
  source_to_dl_schedule: number;
  source_to_dl_load_type: string;
  source_to_dl_is_active: number;
  source_to_dl_last_loader_run_status?: string;
  source_to_dl_last_loader_run_timestamp?: string;
  source_type?: string;
  dl_to_sink_schedule?: number;
  dl_to_sink_load_type?: string;
  dl_to_sink_is_active?: number;
  dl_to_sink_last_loader_run_status?: string;
  dl_to_sink_last_loader_run_timestamp?: string;
  sink_type?: string;
}

interface PipelineLog {
  id: number;
  source_tablename: string;
  pipeline_type: string;
  status: string;
  error_message: string | null;
  rows_processed: number | null;
  file_paths: string | null;
  started_at: string;
  completed_at: string | null;
  time_taken: string | null;
  stage_order?: number;
}

interface PipelineStage {
  id: number;
  pipeline_name: string;
  stage_order: number;
  stage_name: string;
  stage_type: string;
  driver_container: string;
  is_active: boolean;
}

interface PipelineRun {
  id: number;
  source_tablename: string;
  pipeline_name: string;
  status: string;
  current_stage: number;
  total_stages: number;
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  stages?: PipelineLog[];
}

interface LogStats {
  status_distribution: { name: string; value: number }[];
  pipeline_type_distribution: { name: string; value: number }[];
  runs_per_table: { source_tablename: string; total_runs: number; success_count: number; failed_count: number; total_rows: number }[];
  daily_runs: { run_date: string; runs: number; success: number; failed: number }[];
  totals: { total_runs: number; total_success: number; total_failed: number; total_rows_processed: number };
}

type TabType = 'pipelines' | 'configurations' | 'logs' | 'dashboard';

// Chart colors
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
  success: '#10b981',
  failed: '#ef4444',
  running: '#f59e0b',
  pending: '#6b7280'
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('pipelines');
  const [configs, setConfigs] = useState<Config[]>([]);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Config | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [triggeringTable, setTriggeringTable] = useState<string | null>(null);

  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);

  // Pagination & Filtering
  // Pagination & Filtering
  const [logsPage, setLogsPage] = useState(1);

  // Calculate default dates
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const defaultEndDate = formatDate(today);
  const defaultStartDate = formatDate(thirtyDaysAgo);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [tempStartDate, setTempStartDate] = useState(defaultStartDate);
  const [tempEndDate, setTempEndDate] = useState(defaultEndDate);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, stagesRes, runsRes] = await Promise.all([
        fetch('http://localhost:8000/config'),
        fetch('http://localhost:8000/logs/stats/summary'),
        fetch('http://localhost:8000/stages').catch(() => ({ ok: false })),
        fetch('http://localhost:8000/runs').catch(() => ({ ok: false }))
      ]);

      if (!configRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [configData, statsData] = await Promise.all([
        configRes.json(),
        statsRes.json()
      ]);

      setConfigs(configData);
      setStats(statsData);

      // Fetch stages and runs if available
      if (stagesRes.ok) {
        const stagesData = await (stagesRes as Response).json();
        setStages(stagesData);
      }
      if (runsRes.ok) {
        const runsData = await (runsRes as Response).json();
        setPipelineRuns(runsData);
      }
    } catch (err) {
      setError('Failed to load data. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: '10'
      });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate + 'T23:59:59');

      const logsRes = await fetch(`http://localhost:8000/logs?${params.toString()}`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
        setLogsLoaded(true);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auto-refresh pipeline runs every 5 mins when on pipelines tab
  // Dynamic Polling Logic
  useEffect(() => {
    if (activeTab === 'pipelines') {
      // Check if any pipeline is currently running to determine poll rate
      const anyRunning = pipelineRuns.some(run => run.status === 'running' || run.status === 'pending');
      const pollInterval = anyRunning ? 5000 : 300000; // 5 seconds if running, 5 mins otherwise

      const fetchRuns = async () => {
        try {
          const runsRes = await fetch('http://localhost:8000/runs');
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            setPipelineRuns(runsData);
          }
        } catch (e) {
          console.error('Failed to refresh runs', e);
        }
      };

      // Initial fetch only if we just switched to 5s mode to see immediate updates? 
      // Actually standard setInterval logic effectively covers it, but let's keep it simple.

      const interval = setInterval(fetchRuns, pollInterval);
      return () => clearInterval(interval);
    }
  }, [activeTab, pipelineRuns]); // Depend on pipelineRuns so it re-evaluates the interval when status changes

  const handleEdit = (config: Config) => {
    setEditingId(config.source_tablename);
    setTempConfig({ ...config });
  };

  const handleCancel = () => {
    setEditingId(null);
    setTempConfig(null);
  };

  const handleInputChange = (field: keyof Config, value: any) => {
    if (tempConfig) {
      setTempConfig({ ...tempConfig, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!tempConfig) return;

    try {
      const res = await fetch(`http://localhost:8000/config/${tempConfig.source_tablename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempConfig),
      });

      if (!res.ok) throw new Error('Failed to update config');

      setConfigs(prev => prev.map(c => c.source_tablename === tempConfig.source_tablename ? tempConfig : c));
      setEditingId(null);
      setTempConfig(null);
      setNotification({ message: 'Configuration saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Error saving config:', err);
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

      if (!res.ok) throw new Error('Failed to trigger pipeline');

      const data = await res.json();
      setNotification({ message: `Pipeline triggered! Run ID: ${data.run_id}`, type: 'success' });

      // Refresh runs
      const runsRes = await fetch('http://localhost:8000/runs');
      if (runsRes.ok) {
        setPipelineRuns(await runsRes.json());
      }
    } catch (err) {
      console.error('Error triggering pipeline:', err);
      setNotification({ message: 'Failed to trigger pipeline.', type: 'error' });
    } finally {
      setTriggeringTable(null);
    }
  };

  const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      success: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      running: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      partial: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getStageStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'success': return 'bg-green-500 border-green-400';
      case 'failed': return 'bg-red-500 border-red-400';
      case 'running': return 'bg-yellow-500 border-yellow-400 animate-pulse';
      default: return 'bg-gray-600 border-gray-500';
    }
  };

  // ============ Tab Content Renderers ============

  const [selectedTimeRange, setSelectedTimeRange] = useState<number | null>(null);
  const [loadedStats, setLoadedStats] = useState<Record<string, number>>({});

  const fetchLoadedStats = useCallback(async (hours: number | null) => {
    if (hours === null) {
      setLoadedStats({});
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/stats/records-loaded?hours=${hours}`);
      if (res.ok) {
        const data = await res.json();
        setLoadedStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch loaded stats', err);
    }
  }, []);

  useEffect(() => {
    fetchLoadedStats(selectedTimeRange);
  }, [selectedTimeRange, fetchLoadedStats]);

  // Helper for relative time
  const timeAgo = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  const togglePipelineStatus = async (config: Config) => {
    const newStatus = config.source_to_dl_is_active ? 0 : 1;
    try {
      await fetch(`http://localhost:8000/config/${config.source_tablename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_to_dl_is_active: newStatus,
          dl_to_sink_is_active: newStatus
        }),
      });
      // Optimistic update
      setConfigs(prev => prev.map(c =>
        c.source_tablename === config.source_tablename
          ? { ...c, source_to_dl_is_active: newStatus, dl_to_sink_is_active: newStatus }
          : c
      ));
    } catch (err) {
      console.error('Failed to toggle status', err);
      setNotification({ message: 'Failed to update status', type: 'error' });
    }
  };

  // Icons map for convenient usage
  const Icons = {
    Postgres: (
      <svg className="w-5 h-5" viewBox="-4 0 264 264" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier">
        <path d="M255.008 158.086c-1.535-4.649-5.556-7.887-10.756-8.664-2.452-.366-5.26-.21-8.583.475-5.792 1.195-10.089 1.65-13.225 1.738 11.837-19.985 21.462-42.775 27.003-64.228 8.96-34.689 4.172-50.492-1.423-57.64C233.217 10.847 211.614.683 185.552.372c-13.903-.17-26.108 2.575-32.475 4.549-5.928-1.046-12.302-1.63-18.99-1.738-12.537-.2-23.614 2.533-33.079 8.15-5.24-1.772-13.65-4.27-23.362-5.864-22.842-3.75-41.252-.828-54.718 8.685C6.622 25.672-.937 45.684.461 73.634c.444 8.874 5.408 35.874 13.224 61.48 4.492 14.718 9.282 26.94 14.237 36.33 7.027 13.315 14.546 21.156 22.987 23.972 4.731 1.576 13.327 2.68 22.368-4.85 1.146 1.388 2.675 2.767 4.704 4.048 2.577 1.625 5.728 2.953 8.875 3.74 11.341 2.835 21.964 2.126 31.027-1.848.056 1.612.099 3.152.135 4.482.06 2.157.12 4.272.199 6.25.537 13.374 1.447 23.773 4.143 31.049.148.4.347 1.01.557 1.657 1.345 4.118 3.594 11.012 9.316 16.411 5.925 5.593 13.092 7.308 19.656 7.308 3.292 0 6.433-.432 9.188-1.022 9.82-2.105 20.973-5.311 29.041-16.799 7.628-10.86 11.336-27.217 12.007-52.99.087-.729.167-1.425.244-2.088l.16-1.362 1.797.158.463.031c10.002.456 22.232-1.665 29.743-5.154 5.935-2.754 24.954-12.795 20.476-26.351"></path>
        <path d="M237.906 160.722c-29.74 6.135-31.785-3.934-31.785-3.934 31.4-46.593 44.527-105.736 33.2-120.211-30.904-39.485-84.399-20.811-85.292-20.327l-.287.052c-5.876-1.22-12.451-1.946-19.842-2.067-13.456-.22-23.664 3.528-31.41 9.402 0 0-95.43-39.314-90.991 49.444.944 18.882 27.064 142.873 58.218 105.422 11.387-13.695 22.39-25.274 22.39-25.274 5.464 3.63 12.006 5.482 18.864 4.817l.533-.452c-.166 1.7-.09 3.363.213 5.332-8.026 8.967-5.667 10.541-21.711 13.844-16.235 3.346-6.698 9.302-.471 10.86 7.549 1.887 25.013 4.561 36.813-11.958l-.47 1.885c3.144 2.519 5.352 16.383 4.982 28.952-.37 12.568-.617 21.197 1.86 27.937 2.479 6.74 4.948 21.905 26.04 17.386 17.623-3.777 26.756-13.564 28.027-29.89.901-11.606 2.942-9.89 3.07-20.267l1.637-4.912c1.887-15.733.3-20.809 11.157-18.448l2.64.232c7.99.363 18.45-1.286 24.589-4.139 13.218-6.134 21.058-16.377 8.024-13.686h.002" fill="#336791"></path>
        <path d="M108.076 81.525c-2.68-.373-5.107-.028-6.335.902-.69.523-.904 1.129-.962 1.546-.154 1.105.62 2.327 1.096 2.957 1.346 1.784 3.312 3.01 5.258 3.28.282.04.563.058.842.058 3.245 0 6.196-2.527 6.456-4.392.325-2.336-3.066-3.893-6.355-4.35M196.86 81.599c-.256-1.831-3.514-2.353-6.606-1.923-3.088.43-6.082 1.824-5.832 3.659.2 1.427 2.777 3.863 5.827 3.863.258 0 .518-.017.78-.054 2.036-.282 3.53-1.575 4.24-2.32 1.08-1.136 1.706-2.402 1.591-3.225" fill="#FFF"></path>
        <path d="M247.802 160.025c-1.134-3.429-4.784-4.532-10.848-3.28-18.005 3.716-24.453 1.142-26.57-.417 13.995-21.32 25.508-47.092 31.719-71.137 2.942-11.39 4.567-21.968 4.7-30.59.147-9.463-1.465-16.417-4.789-20.665-13.402-17.125-33.072-26.311-56.882-26.563-16.369-.184-30.199 4.005-32.88 5.183-5.646-1.404-11.801-2.266-18.502-2.376-12.288-.199-22.91 2.743-31.704 8.74-3.82-1.422-13.692-4.811-25.765-6.756-20.872-3.36-37.458-.814-49.294 7.571-14.123 10.006-20.643 27.892-19.38 53.16.425 8.501 5.269 34.653 12.913 59.698 10.062 32.964 21 51.625 32.508 55.464 1.347.449 2.9.763 4.613.763 4.198 0 9.345-1.892 14.7-8.33a529.832 529.832 0 0 1 20.261-22.926c4.524 2.428 9.494 3.784 14.577 3.92.01.133.023.266.035.398a117.66 117.66 0 0 0-2.57 3.175c-3.522 4.471-4.255 5.402-15.592 7.736-3.225.666-11.79 2.431-11.916 8.435-.136 6.56 10.125 9.315 11.294 9.607 4.074 1.02 7.999 1.523 11.742 1.523 9.103 0 17.114-2.992 23.516-8.781-.197 23.386.778 46.43 3.586 53.451 2.3 5.748 7.918 19.795 25.664 19.794 2.604 0 5.47-.303 8.623-.979 18.521-3.97 26.564-12.156 29.675-30.203 1.665-9.645 4.522-32.676 5.866-45.03 2.836.885 6.487 1.29 10.434 1.289 8.232 0 17.731-1.749 23.688-4.514 6.692-3.108 18.768-10.734 16.578-17.36zm-44.106-83.48c-.061 3.647-.563 6.958-1.095 10.414-.573 3.717-1.165 7.56-1.314 12.225-.147 4.54.42 9.26.968 13.825 1.108 9.22 2.245 18.712-2.156 28.078a36.508 36.508 0 0 1-1.95-4.009c-.547-1.326-1.735-3.456-3.38-6.404-6.399-11.476-21.384-38.35-13.713-49.316 2.285-3.264 8.084-6.62 22.64-4.813zm-17.644-61.787c21.334.471 38.21 8.452 50.158 23.72 9.164 11.711-.927 64.998-30.14 110.969a171.33 171.33 0 0 0-.886-1.117l-.37-.462c7.549-12.467 6.073-24.802 4.759-35.738-.54-4.488-1.05-8.727-.92-12.709.134-4.22.692-7.84 1.232-11.34.663-4.313 1.338-8.776 1.152-14.037.139-.552.195-1.204.122-1.978-.475-5.045-6.235-20.144-17.975-33.81-6.422-7.475-15.787-15.84-28.574-21.482 5.5-1.14 13.021-2.203 21.442-2.016zM66.674 175.778c-5.9 7.094-9.974 5.734-11.314 5.288-8.73-2.912-18.86-21.364-27.791-50.624-7.728-25.318-12.244-50.777-12.602-57.916-1.128-22.578 4.345-38.313 16.268-46.769 19.404-13.76 51.306-5.524 64.125-1.347-.184.182-.376.352-.558.537-21.036 21.244-20.537 57.54-20.485 59.759-.002.856.07 2.068.168 3.735.362 6.105 1.036 17.467-.764 30.334-1.672 11.957 2.014 23.66 10.111 32.109a36.275 36.275 0 0 0 2.617 2.468c-3.604 3.86-11.437 12.396-19.775 22.426zm22.479-29.993c-6.526-6.81-9.49-16.282-8.133-25.99 1.9-13.592 1.199-25.43.822-31.79-.053-.89-.1-1.67-.127-2.285 3.073-2.725 17.314-10.355 27.47-8.028 4.634 1.061 7.458 4.217 8.632 9.645 6.076 28.103.804 39.816-3.432 49.229-.873 1.939-1.698 3.772-2.402 5.668l-.546 1.466c-1.382 3.706-2.668 7.152-3.465 10.424-6.938-.02-13.687-2.984-18.819-8.34zm1.065 37.9c-2.026-.506-3.848-1.385-4.917-2.114.893-.42 2.482-.992 5.238-1.56 13.337-2.745 15.397-4.683 19.895-10.394 1.031-1.31 2.2-2.794 3.819-4.602l.002-.002c2.411-2.7 3.514-2.242 5.514-1.412 1.621.67 3.2 2.702 3.84 4.938.303 1.056.643 3.06-.47 4.62-9.396 13.156-23.088 12.987-32.921 10.526zm69.799 64.952c-16.316 3.496-22.093-4.829-25.9-14.346-2.457-6.144-3.665-33.85-2.808-64.447.011-.407-.047-.8-.159-1.17a15.444 15.444 0 0 0-.456-2.162c-1.274-4.452-4.379-8.176-8.104-9.72-1.48-.613-4.196-1.738-7.46-.903.696-2.868 1.903-6.107 3.212-9.614l.549-1.475c.618-1.663 1.394-3.386 2.214-5.21 4.433-9.848 10.504-23.337 3.915-53.81-2.468-11.414-10.71-16.988-23.204-15.693-7.49.775-14.343 3.797-17.761 5.53-.735.372-1.407.732-2.035 1.082.954-11.5 4.558-32.992 18.04-46.59 8.489-8.56 19.794-12.788 33.568-12.56 27.14.444 44.544 14.372 54.366 25.979 8.464 10.001 13.047 20.076 14.876 25.51-13.755-1.399-23.11 1.316-27.852 8.096-10.317 14.748 5.644 43.372 13.315 57.129 1.407 2.521 2.621 4.7 3.003 5.626 2.498 6.054 5.732 10.096 8.093 13.046.724.904 1.426 1.781 1.96 2.547-4.166 1.201-11.649 3.976-10.967 17.847-.55 6.96-4.461 39.546-6.448 51.059-2.623 15.21-8.22 20.875-23.957 24.25zm68.104-77.936c-4.26 1.977-11.389 3.46-18.161 3.779-7.48.35-11.288-.838-12.184-1.569-.42-8.644 2.797-9.547 6.202-10.503.535-.15 1.057-.297 1.561-.473.313.255.656.508 1.032.756 6.012 3.968 16.735 4.396 31.874 1.271l.166-.033c-2.042 1.909-5.536 4.471-10.49 6.772z" fill="#FFF"></path></g>
      </svg>
    ),
    MinIO: (
      <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 10h16v2H4zm0 4h16v2H4zm0-8h16v2H4z" />
      </svg>
    ),
    DuckDB: (
      <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.66 0-3 1.34-3 3 0 .35.07.69.18 1H10c-1.66 0-3 1.34-3 3v2h11v-2c0-1.66-1.34-3-3-3zM5.5 17h13c.83 0 1.5-.67 1.5-1.5S19.33 14 18.5 14h-13c-.83 0-1.5.67-1.5 1.5S4.67 17 5.5 17z" />
      </svg>
    ),
    Iceberg: (
      <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 22h20L12 2zm0 3.8L18.4 20H5.6L12 5.8z" />
      </svg>
    ),
    Source: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
    ),
    Sink: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
    ),
    Pipeline: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
    )
  };

  const renderPipelines = () => {
    return (
      <div className="space-y-6 bg-stars">
        {/* Time Range Selector */}
        <div className="flex justify-between items-center bg-gray-900/40 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3">Records Display:</span>
            <button
              onClick={() => setSelectedTimeRange(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedTimeRange === null
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-500'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              Recent Run (Live)
            </button>
            <div className="h-4 w-px bg-gray-700 mx-2" />
            {[
              { label: '30m', value: 0.5 },
              { label: '1h', value: 1 },
              { label: '6h', value: 6 },
              { label: '24h', value: 24 }
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => setSelectedTimeRange(option.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedTimeRange === option.value
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {selectedTimeRange !== null && (
            <div className="px-4 text-xs text-indigo-300 font-medium">
              Values showing total records processed in the last <span className="text-white font-bold">{selectedTimeRange === 0.5 ? '30 Minutes' : selectedTimeRange + ' Hours'}</span>
            </div>
          )}
        </div>

        {/* Pipeline Cards Layout */}
        <div className="space-y-4">
          {configs.map((config, index) => {
            const latestRun = pipelineRuns.find(r => r.source_tablename === config.source_tablename);
            const isRunning = latestRun?.status === 'running';

            return (
              <div key={config.source_tablename} className="bg-gray-900/60 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md hover:border-indigo-500/30 transition-all group">
                {/* Header Row */}
                <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    {/* ID Badge */}
                    <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 bg-white/5 rounded-lg border border-white/5">
                      <span className="text-xs text-gray-500 font-bold">#{index + 1}</span>
                    </div>

                    <div>
                      {/* Prominent Table Name */}
                      <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
                        {config.source_tablename}
                      </h3>

                      {/* Flow Info (Source -> Sink) */}
                      <div className="flex items-center gap-3">
                        {/* Source - Dynamic */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                          {config.source_type === 'postgres' ? (
                            Icons.Postgres
                          ) : (
                            Icons.Source
                          )}
                          <span className="text-[10px] uppercase font-bold text-gray-400">
                            {config.source_type ? `${config.source_type} Source` : 'Source'}
                          </span>
                        </div>

                        <span className="text-gray-600">→</span>

                        {/* Sink - Dynamic */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                          {config.sink_type === 'duckdb' ? (
                            Icons.DuckDB
                          ) : config.sink_type === 'minio' ? (
                            Icons.MinIO
                          ) : config.sink_type === 'postgres' ? (
                            Icons.Postgres
                          ) : (
                            Icons.Sink
                          )}
                          <span className="text-[10px] uppercase font-bold text-gray-400">
                            {config.sink_type ? `${config.sink_type} Sink` : 'Sink'}
                          </span>
                        </div>

                        <span className="text-gray-500 text-xs ml-2 border-l border-gray-700 pl-3">
                          Syncs every {config.source_to_dl_schedule}m
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right */}
                  {/* Actions Right */}
                  {/* Actions Right */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {/* Status Indicators */}
                    {isRunning ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></div>
                        <span className="text-xs font-bold uppercase tracking-wider">Running</span>
                      </div>
                    ) : (
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${config.source_to_dl_is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                        {config.source_to_dl_is_active ? 'Active' : 'Paused'}
                      </span>
                    )}

                    {/* Run Now Button (Direct Action) */}
                    <button
                      onClick={() => handleTriggerPipeline(config.source_tablename)}
                      disabled={isRunning || triggeringTable === config.source_tablename}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg ${isRunning
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-indigo-500/20'
                        }`}
                    >
                      {isRunning ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      )}
                      <span>{isRunning ? 'Processing...' : 'Run Now'}</span>
                    </button>

                    <div className="h-6 w-px bg-white/10 mx-1"></div>

                    {/* More Menu */}
                    <div className="relative group/menu">
                      <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                      </button>
                      <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden ring-1 ring-black/50">
                        {/* Pause/Resume Option */}
                        <button
                          onClick={() => togglePipelineStatus(config)}
                          className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors"
                        >
                          {config.source_to_dl_is_active ? (
                            <>
                              <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span>Pause Pipeline</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span>Resume Pipeline</span>
                            </>
                          )}
                        </button>
                        <div className="h-px bg-white/5 my-1" />

                        <button onClick={() => { setActiveTab('configurations'); handleEdit(config); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit Config
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button onClick={() => alert("Not implemented")} className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Visualizer */}
                <div className="bg-black/20 p-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">
                    <span>Pipeline Activity</span>
                    {latestRun && (
                      <span className="flex items-center gap-2">
                        <span>Last Run: {timeAgo(latestRun.started_at)}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${latestRun.status === 'success' ? 'bg-green-500' : latestRun.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Stage 1: Ingestion */}
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Option B: Ingestion - Stream/Wave */}
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="text-[10px] font-bold text-gray-400">INGESTION</span>
                      </div>
                      <div className="text-xl font-bold text-white font-mono">
                        {selectedTimeRange ? (loadedStats[config.source_tablename] || 0).toLocaleString() : (latestRun?.stages?.find(s => s.pipeline_type === 'loader_source_to_dl')?.rows_processed || 0).toLocaleString()}
                      </div>
                      <div className="w-full h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-blue-500 w-full opacity-50"></div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center text-gray-700">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>

                    {/* Stage 3: Load */}
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Option 3: Load - Server/Cyber */}
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                        <span className="text-[10px] font-bold text-gray-400">LOAD</span>
                      </div>
                      <div className="text-xl font-bold text-white font-mono">
                        {selectedTimeRange ? (loadedStats[config.source_tablename] || 0).toLocaleString() : (latestRun?.stages?.find(s => s.pipeline_type === 'loader_dl_to_sink')?.rows_processed || 0).toLocaleString()}
                      </div>
                      <div className="w-full h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-green-500 w-full opacity-50"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {configs.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-gray-900/40 rounded-xl border border-white/10">
              No pipelines configured. Go to the Database to add tables.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    if (!stats) return <div className="text-gray-400">No statistics available</div>;

    return (
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border border-indigo-500/20 rounded-xl p-6">
            <div className="text-3xl font-bold text-white">{stats.totals.total_runs || 0}</div>
            <div className="text-indigo-300 text-sm mt-1">Total Runs</div>
          </div>
          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-500/20 rounded-xl p-6">
            <div className="text-3xl font-bold text-green-400">{stats.totals.total_success || 0}</div>
            <div className="text-green-300 text-sm mt-1">Successful</div>
          </div>
          <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-500/20 rounded-xl p-6">
            <div className="text-3xl font-bold text-red-400">{stats.totals.total_failed || 0}</div>
            <div className="text-red-300 text-sm mt-1">Failed</div>
          </div>
          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/20 rounded-xl p-6">
            <div className="text-3xl font-bold text-purple-400">{(stats.totals.total_rows_processed || 0).toLocaleString()}</div>
            <div className="text-purple-300 text-sm mt-1">Rows Processed</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/40 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Runs Per Table</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.runs_per_table} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="source_tablename" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
                <Legend />
                <Bar dataKey="success_count" name="Success" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed_count" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900/40 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.status_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#9ca3af' }}>
                  {stats.status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/40 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Daily Runs (Last 7 Days)</h3>
            {stats.daily_runs.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.daily_runs} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="run_date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="success" name="Success" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">No runs in the last 7 days</div>
            )}
          </div>

          <div className="bg-gray-900/40 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pipeline Type Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.pipeline_type_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#9ca3af' }}>
                  {stats.pipeline_type_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderLogs = () => (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-gray-900/40 p-4 rounded-xl border border-white/5">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={tempStartDate}
              onChange={(e) => setTempStartDate(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
            <input
              type="date"
              value={tempEndDate}
              onChange={(e) => setTempEndDate(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setStartDate(tempStartDate);
                setEndDate(tempEndDate);
                setLogsPage(1);
              }}
              className="mt-6 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              Search
            </button>
            {(tempStartDate || tempEndDate) && (
              <button
                onClick={() => {
                  setTempStartDate('');
                  setTempEndDate('');
                  setStartDate('');
                  setEndDate('');
                  setLogsPage(1);
                }}
                className="mb-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

      </div>

      <div className="bg-gray-900/40 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Table</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Pipeline</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rows</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time Taken</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Started At</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">File Paths</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No pipeline runs logged yet</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-sm">{log.id}</td>
                    <td className="px-4 py-3 text-white font-medium capitalize">{log.source_tablename}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{log.pipeline_type}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(log.status)}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-sm">{log.rows_processed?.toLocaleString() || '-'}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-sm">{log.time_taken || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{formatTimestamp(log.started_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate" title={log.file_paths || ''}>{log.file_paths || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>


        {/* Pagination Footer */}
        <div className="border-t border-white/5 bg-black/20 p-3 flex justify-between items-center">
          <button
            onClick={() => setLogsPage(p => Math.max(1, p - 1))}
            disabled={logsPage === 1 || logsLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${logsPage === 1
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Previous
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">Page <span className="text-white font-bold">{logsPage}</span></span>
            {logsLoading && <span className="text-xs text-indigo-400 animate-pulse ml-2">Loading...</span>}
          </div>

          <button
            onClick={() => setLogsPage(p => p + 1)}
            disabled={logs.length < 10 || logsLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${logs.length < 10
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );

  // Helper for tooltips
  const InfoTooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
    <div className="relative group/tooltip flex items-center gap-1 cursor-help">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-xs text-gray-300 w-48 text-center opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-20 shadow-xl pointer-events-none">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );

  const renderConfigurations = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {configs.map((config) => (
          <div key={config.source_tablename} className="bg-gray-900/40 border border-white/10 rounded-xl p-6 hover:bg-gray-900/60 transition-colors backdrop-blur-sm group">
            {editingId === config.source_tablename ? (
              // Editing Mode
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <span className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </span>
                    <span>Editing: {config.source_tablename}</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Frequency (Minutes)</label>
                    <input
                      type="number"
                      value={tempConfig?.source_to_dl_schedule || 0}
                      onChange={(e) => setTempConfig({ ...tempConfig!, source_to_dl_schedule: Number(e.target.value) })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Loading Strategy</label>
                    <select
                      value={tempConfig?.source_to_dl_load_type || 'incremental'}
                      onChange={(e) => setTempConfig({ ...tempConfig!, source_to_dl_load_type: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                    >
                      <option value="incremental">Incremental</option>
                      <option value="full">Full Replace</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-white/5">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/5">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-lg">{config.source_tablename}</h3>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${config.source_to_dl_is_active ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                        <span>{config.source_to_dl_is_active ? 'Active Pipeline' : 'Paused'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit Configuration"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <InfoTooltip text="How often this pipeline runs to check for new data.">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center">
                        Frequency
                        <svg className="w-3 h-3 ml-1 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </label>
                    </InfoTooltip>
                    <p className="text-white font-mono text-sm">Every {config.source_to_dl_schedule}m</p>
                  </div>

                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <InfoTooltip text="'Incremental' only loads new data. 'Full' reloads everything.">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center">
                        Strategy
                        <svg className="w-3 h-3 ml-1 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </label>
                    </InfoTooltip>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${config.source_to_dl_load_type === 'incremental' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                        {config.source_to_dl_load_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Background Stars Component
  // Background Stars Component
  const Stars = () => {
    const [starStyles, setStarStyles] = useState<React.CSSProperties[]>([]);

    useEffect(() => {
      const styles = Array.from({ length: 50 }).map(() => ({
        top: `${Math.floor(Math.random() * 100)}%`,
        left: `${Math.floor(Math.random() * 100)}%`,
        width: `${Math.random() * 3 + 1}px`,
        height: `${Math.random() * 3 + 1}px`,
        '--duration': `${Math.random() * 3 + 2}s`,
        '--delay': `${Math.random() * 5}s`,
      } as React.CSSProperties));
      setStarStyles(styles);
    }, []);

    return (
      <div className="stars-container pointer-events-none fixed inset-0 z-0">
        {starStyles.map((style, i) => (
          <div key={i} className="star z-0" style={style} />
        ))}
      </div>
    );
  };

  // ============ Main Render ============
  return (
    <div className="min-h-screen text-gray-300 font-sans selection:bg-indigo-500/30 relative overflow-hidden">
      <Stars />
      <header className="w-full border-b border-white/5 bg-[#0f111a]/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div
            className="flex items-center space-x-4 cursor-pointer"
            onClick={() => setActiveTab('pipelines')}
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
              <Image src="/logo.png" alt="Logo" width={40} height={40} className="relative w-10 h-10 rounded-lg shadow-xl" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white leading-none">DataFlow <span className="text-indigo-400">Reimagined</span></h1>
            </div>
          </div>
          <nav className="hidden md:flex space-x-1">
            {['pipelines', 'dashboard', 'logs', 'configurations'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as TabType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 z-50 ${activeTab === tab
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {/* Refresh Button */}
            <button
              onClick={() => {
                if (activeTab === 'logs') {
                  setLogsLoaded(false); // Reset to force re-fetch
                  fetchLogs();
                } else {
                  fetchDashboardData();
                }
                setNotification({ message: `Refreshed ${activeTab} data`, type: 'success' });
              }}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              title="Refresh Data"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <div className="flex items-center space-x-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-gray-300 font-medium tracking-wide">System Operational</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center p-6 md:p-10">
        <div className="w-full max-w-7xl space-y-8">
          {loading && (
            <div className="flex flex-col justify-center items-center py-32 space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 bg-indigo-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="text-indigo-400 animate-pulse text-sm font-medium tracking-wide">Synchronizing Data...</div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
              <div className="flex justify-center mb-3">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-1">Connection Error</h3>
              <p className="text-red-400/80 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="animate-fade-in">
              {activeTab === 'pipelines' && renderPipelines()}
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'logs' && renderLogs()}
              {activeTab === 'configurations' && renderConfigurations()}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-[#0f111a] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs text-gray-600">
          <p>&copy; 2024 DataFlow Reimagined. Enterprise Edition.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span>v2.4.0-stable</span>
            <span className="hover:text-gray-400 cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-gray-400 cursor-pointer transition-colors">Support</span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>IST Timezone</span>
            </span>
          </div>
        </div>
      </footer>

      {notification && (
        <div className={`fixed bottom-6 right-6 w-auto max-w-sm p-4 rounded-xl shadow-2xl transform transition-all duration-500 ease-out z-50 flex items-center space-x-3 border backdrop-blur-xl ${notification.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
            {notification.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
          </div>
          <p className="font-medium text-sm">{notification.message}</p>
        </div>
      )}
    </div>
  );
}
