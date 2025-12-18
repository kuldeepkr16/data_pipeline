'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// ============ Types ============
interface Config {
  source_tablename: string;
  source_to_dl_schedule: number;
  source_to_dl_load_type: string;
  source_to_dl_is_active: number;
  source_to_dl_last_loader_run_status?: string;
  source_to_dl_last_loader_run_timestamp?: string;
  dl_to_sink_schedule?: number;
  dl_to_sink_load_type?: string;
  dl_to_sink_is_active?: number;
  dl_to_sink_last_loader_run_status?: string;
  dl_to_sink_last_loader_run_timestamp?: string;
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

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, logsRes, statsRes, stagesRes, runsRes] = await Promise.all([
        fetch('http://localhost:8000/config'),
        fetch('http://localhost:8000/logs'),
        fetch('http://localhost:8000/logs/stats/summary'),
        fetch('http://localhost:8000/stages').catch(() => ({ ok: false })),
        fetch('http://localhost:8000/runs').catch(() => ({ ok: false }))
      ]);

      if (!configRes.ok || !logsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [configData, logsData, statsData] = await Promise.all([
        configRes.json(),
        logsRes.json(),
        statsRes.json()
      ]);

      setConfigs(configData);
      setLogs(logsData);
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

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auto-refresh pipeline runs every 5 seconds when on pipelines tab
  useEffect(() => {
    if (activeTab === 'pipelines') {
      const interval = setInterval(async () => {
        try {
          const runsRes = await fetch('http://localhost:8000/runs');
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            setPipelineRuns(runsData);
          }
        } catch (e) {
          console.error('Failed to refresh runs', e);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

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

  const renderPipelines = () => {
    const defaultStages = stages.filter(s => s.pipeline_name === 'default');

    return (
      <div className="space-y-8">
        {/* Pipeline Stage Definition */}
        <div className="bg-gray-900/40 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pipeline Stages (default)</h3>
          <div className="flex items-center justify-center space-x-4 py-4">
            {defaultStages.length > 0 ? defaultStages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-32 h-20 bg-indigo-900/50 border border-indigo-500/30 rounded-lg flex flex-col items-center justify-center p-2">
                    <span className="text-xs text-indigo-300 mb-1">Stage {stage.stage_order}</span>
                    <span className="text-sm text-white text-center font-medium">{stage.stage_name}</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{stage.stage_type}</span>
                </div>
                {idx < defaultStages.length - 1 && (
                  <div className="flex items-center mx-2">
                    <div className="w-8 h-0.5 bg-indigo-500/50"></div>
                    <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            )) : (
              <div className="text-gray-500">No stages defined. Create tables in config DB.</div>
            )}
          </div>
        </div>

        {/* Tables with Trigger */}
        <div className="bg-gray-900/40 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-black/20">
            <h3 className="text-lg font-semibold text-white">Trigger Pipeline</h3>
            <p className="text-sm text-gray-400">Click Run to manually trigger a pipeline for any table</p>
          </div>
          <div className="divide-y divide-white/5">
            {configs.map((config) => (
              <div key={config.source_tablename} className="flex items-center justify-between p-4 hover:bg-white/5">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                    <span className="text-indigo-400 font-bold text-lg">{config.source_tablename[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="text-white font-medium capitalize">{config.source_tablename}</div>
                    <div className="text-sm text-gray-500">
                      {config.source_to_dl_load_type} load • {config.source_to_dl_schedule}m schedule
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleTriggerPipeline(config.source_tablename)}
                  disabled={triggeringTable === config.source_tablename}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                    triggeringTable === config.source_tablename
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {triggeringTable === config.source_tablename ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Run Pipeline</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Pipeline Runs with Visual Stages */}
        <div className="bg-gray-900/40 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-black/20">
            <h3 className="text-lg font-semibold text-white">Recent Pipeline Runs</h3>
          </div>
          <div className="divide-y divide-white/5">
            {pipelineRuns.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No pipeline runs yet. Click &quot;Run Pipeline&quot; above to start one.
              </div>
            ) : (
              pipelineRuns.slice(0, 10).map((run) => (
                <div key={run.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-medium capitalize">{run.source_tablename}</span>
                      {getStatusBadge(run.status)}
                      <span className="text-xs text-gray-500">#{run.id}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {formatTimestamp(run.started_at)}
                    </div>
                  </div>
                  
                  {/* Visual Pipeline Flow */}
                  <div className="flex items-center space-x-2 mt-2">
                    {defaultStages.map((stage, idx) => {
                      const stageLog = run.stages?.find(s => s.stage_order === stage.stage_order);
                      const status = stageLog?.status;
                      const isCurrent = run.status === 'running' && run.current_stage === stage.stage_order;
                      
                      return (
                        <div key={stage.id} className="flex items-center">
                          <div className="flex flex-col items-center group relative">
                            <div
                              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${getStageStatusColor(status)} ${isCurrent ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900' : ''}`}
                              title={`${stage.stage_name}: ${status || 'pending'}`}
                            >
                              {status === 'success' && (
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {status === 'failed' && (
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              {status === 'running' && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              )}
                              {!status && (
                                <span className="text-xs text-gray-300">{stage.stage_order}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 mt-1 max-w-[60px] truncate text-center">
                              {stage.stage_name.split(' ')[0]}
                            </span>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                              <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                {stage.stage_name}
                                {stageLog && (
                                  <>
                                    <br />
                                    Status: {stageLog.status}
                                    {stageLog.rows_processed !== null && <><br />Rows: {stageLog.rows_processed}</>}
                                    {stageLog.time_taken && <><br />Time: {stageLog.time_taken}</>}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {idx < defaultStages.length - 1 && (
                            <div className={`w-8 h-0.5 mx-1 ${status === 'success' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-gray-600'}`}></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {run.error_message && (
                    <div className="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2">
                      {run.error_message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
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
    </div>
  );

  const renderConfigurations = () => (
    <div className="bg-gray-900/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
      <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-black/20 text-xs font-bold text-gray-500 uppercase tracking-widest">
        <div className="col-span-2">Source Table</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-center">Schedule</div>
        <div className="col-span-2 text-center">Load Type</div>
        <div className="col-span-2 text-center">Last Run</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      {configs.map((config) => {
        const isEditing = editingId === config.source_tablename;
        const current = isEditing ? tempConfig! : config;

        return (
          <div key={config.source_tablename} className={`grid grid-cols-12 gap-4 p-4 items-center border-b border-white/5 hover:bg-white/5 transition-colors ${isEditing ? 'bg-indigo-900/20 border-indigo-500/30' : ''}`}>
            <div className="col-span-2 font-medium text-white capitalize">{config.source_tablename}</div>
            <div className="col-span-2 text-center">
              {isEditing ? (
                <button onClick={() => handleInputChange('source_to_dl_is_active', current.source_to_dl_is_active ? 0 : 1)} className={`px-2 py-1 rounded text-xs font-bold w-20 ${current.source_to_dl_is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  {current.source_to_dl_is_active ? 'ACTIVE' : 'INACTIVE'}
                </button>
              ) : (
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold w-20 ${config.source_to_dl_is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {config.source_to_dl_is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              )}
            </div>
            <div className="col-span-2 text-center font-mono text-gray-300">
              {isEditing ? (
                <input type="number" value={current.source_to_dl_schedule} onChange={(e) => handleInputChange('source_to_dl_schedule', parseInt(e.target.value))} className="w-16 bg-black/50 border border-indigo-500/50 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-400" />
              ) : (
                <span>{config.source_to_dl_schedule}m</span>
              )}
            </div>
            <div className="col-span-2 text-center">
              {isEditing ? (
                <select value={current.source_to_dl_load_type} onChange={(e) => handleInputChange('source_to_dl_load_type', e.target.value)} className="bg-black/50 border border-indigo-500/50 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-indigo-400">
                  <option value="full">Full Load</option>
                  <option value="incremental">Incremental</option>
                </select>
              ) : (
                <span className="inline-block px-2 py-1 rounded bg-white/5 text-gray-400 text-xs">{config.source_to_dl_load_type}</span>
              )}
            </div>
            <div className="col-span-2 text-center">{getStatusBadge(config.source_to_dl_last_loader_run_status)}</div>
            <div className="col-span-2 flex justify-end space-x-2">
              {isEditing ? (
                <>
                  <button onClick={handleSave} className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded transition-colors" title="Save">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={handleCancel} className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors" title="Cancel">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </>
              ) : (
                <button onClick={() => handleEdit(config)} className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500 rounded transition-all">Edit</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ============ Main Render ============
  return (
    <>
      <header className="w-full border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 animate-pulse"></div>
            <span className="font-bold text-xl tracking-tight text-white">Data Pipeline <span className="text-indigo-400">Reimagined</span></span>
          </div>
          <nav className="hidden md:flex space-x-8">
            <button onClick={() => setActiveTab('pipelines')} className={`transition-colors text-sm font-medium ${activeTab === 'pipelines' ? 'text-white' : 'text-gray-300 hover:text-white'}`}>Pipelines</button>
            <button onClick={() => setActiveTab('dashboard')} className={`transition-colors text-sm font-medium ${activeTab === 'dashboard' ? 'text-white' : 'text-gray-300 hover:text-white'}`}>Dashboard</button>
            <button onClick={() => setActiveTab('logs')} className={`transition-colors text-sm font-medium ${activeTab === 'logs' ? 'text-white' : 'text-gray-300 hover:text-white'}`}>Run Logs</button>
            <button onClick={() => setActiveTab('configurations')} className={`transition-colors text-sm font-medium ${activeTab === 'configurations' ? 'text-white' : 'text-gray-300 hover:text-white'}`}>Configurations</button>
          </nav>
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            <span className="text-xs text-green-400 font-mono">SYSTEM ONLINE</span>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center p-8 md:p-12">
        <div className="w-full max-w-7xl">
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
              <div className="text-indigo-400 animate-pulse text-lg">Loading data...</div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-center">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {activeTab === 'pipelines' && renderPipelines()}
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'logs' && renderLogs()}
              {activeTab === 'configurations' && renderConfigurations()}
            </>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-black/30 backdrop-blur-sm py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm mb-2">&copy; 2024 Data Pipeline Reimagined. All systems nominal.</p>
        </div>
      </footer>

      {notification && (
        <div className={`fixed bottom-0 left-0 w-full p-4 text-center font-medium transform transition-transform duration-300 ease-in-out z-50 ${notification.type === 'success' ? 'bg-green-600/90 text-white backdrop-blur-md border-t border-green-400' : 'bg-red-600/90 text-white backdrop-blur-md border-t border-red-400'}`}>
          <div className="flex justify-center items-center space-x-2">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
