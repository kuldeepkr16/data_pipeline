
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../components/layout/Header';
import { PipelineCard } from '../../../components/features/pipelines/PipelineCard';
import { PipelineConfigForm } from '../../../components/features/pipelines/PipelineConfigForm';
import Sidebar from '../../../components/features/pipelines/Sidebar';
import { Config, PipelineRun, SchemaInfo } from '../../../types';


export default function PipelineDetailsPage({ params }: { params: { tablename: string } }) {
    console.log("PipelineDetailsPage rendered", params);
    const router = useRouter();
    const { tablename } = params;
    console.log("Tablename derived:", tablename);

    const [config, setConfig] = useState<Config | null>(null);
    const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Schema State
    const [schemaInfo, setSchemaInfo] = useState<SchemaInfo | null>(null);
    const [refreshingSchema, setRefreshingSchema] = useState(false);

    // Pagination & Filter State
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 5,
        total: 0,
        total_pages: 1
    });
    // Default to last 30 days
    const [dateFilter, setDateFilter] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        };
    });

    // Sidebar active item
    const [activeSection, setActiveSection] = useState<'details' | 'configure' | 'schema' | 'transform'>('details');

    // Modals
    const [editingConfig, setEditingConfig] = useState<Config | null>(null);

    // Stats (mocked for now or derived from runs)
    const [loadedStats, setLoadedStats] = useState<number>(0);

    const fetchData = async () => {
        console.log("fetchData called for:", tablename);
        if (!tablename) {
            console.warn("No tablename, skipping fetch");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            console.log("Fetching config...");

            // Add timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            // Fetch Config
            const configRes = await fetch(`http://localhost:8000/pipelines/${tablename}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!configRes.ok) throw new Error('Failed to fetch config: ' + configRes.statusText);
            const configData = await configRes.json();
            console.log("Config fetched:", configData);
            setConfig(configData);

            // Fetch Runs with Pagination & Filters
            const queryParams = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString()
            });
            if (dateFilter.startDate) queryParams.append('start_date', dateFilter.startDate);
            if (dateFilter.endDate) queryParams.append('end_date', dateFilter.endDate);

            const runsRes = await fetch(`http://localhost:8000/runs/table/${tablename}?${queryParams}`);
            if (!runsRes.ok) throw new Error('Failed to fetch runs');
            const responseData = await runsRes.json();

            // Handle new response structure
            if (responseData.data && responseData.pagination) {
                setPipelineRuns(responseData.data);
                setPagination(prev => ({ ...prev, ...responseData.pagination }));

                if (responseData.data.length > 0) {
                    let total = 0;
                    responseData.data.forEach((run: PipelineRun) => {
                        if (run.status === 'success' && run.stages) {
                            const stage = run.stages.find(s => s.pipeline_type === 'loader_dl_to_sink');
                            if (stage && stage.rows_processed) {
                                total += stage.rows_processed;
                            }
                        }
                    });
                    setLoadedStats(total);
                }
            } else {
                setPipelineRuns(responseData);
            }

            // Fetch Schema Info if section is active (or always for now)
            fetchSchemaInfo();

        } catch (err: any) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            if (err.name === 'AbortError') {
                setError("Connection timeout. Backend might be unreachable.");
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchSchemaInfo = async () => {
        try {
            const res = await fetch(`http://localhost:8000/pipelines/${tablename}/schema`);
            if (res.ok) {
                const data = await res.json();
                setSchemaInfo(data);
            }
        } catch (error) {
            console.error("Failed to fetch schema info", error);
        }
    };

    // Initial Fetch
    useEffect(() => {
        console.log("useEffect triggered for tablename:", tablename);
        if (tablename) {
            fetchData();
        }
    }, [tablename]);

    // Trigger one refresh when switching to schema tab if missing
    useEffect(() => {
        if (activeSection === 'schema') {
            const hasSource = schemaInfo?.source_schema && schemaInfo.source_schema.length > 0;
            const hasDest = schemaInfo?.destination_schema && schemaInfo.destination_schema.length > 0;
            if (!schemaInfo || (!hasSource && !hasDest)) {
                handleRefreshSchema();
            }
        }
    }, [activeSection]);

    // Auto-refresh schema if missing
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (activeSection === 'schema') {
            // Check if we have valid schema data
            const hasSource = schemaInfo?.source_schema && schemaInfo.source_schema.length > 0;
            const hasDest = schemaInfo?.destination_schema && schemaInfo.destination_schema.length > 0;
            const isSchemaLoaded = hasSource || hasDest; // Stop if we have at least one, or maybe require source?
            // User said "once schema is loaded". Usually implies full success.
            // But strict "missing" check is better:
            const isMissing = !schemaInfo || (!hasSource && !hasDest);

            if (isMissing) {
                // Poll every 5 seconds UNTIL loaded
                interval = setInterval(() => {
                    handleRefreshSchema();
                }, 5000);
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeSection, tablename, schemaInfo]); // Removed refreshingSchema to prevent toggle loop

    const handleRefreshSchema = async () => {
        if (refreshingSchema) return;
        setRefreshingSchema(true);
        try {
            const res = await fetch(`http://localhost:8000/pipelines/${tablename}/refresh-schema`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error("Failed to refresh schema");
            const data = await res.json();
            setSchemaInfo(data);
        } catch (err) {
            console.error("Error refreshing schema: " + err);
            // Don't alert on auto-refresh to avoid spamming
        } finally {
            setRefreshingSchema(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.total_pages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    const handleDateChange = (type: 'start' | 'end', value: string) => {
        setDateFilter(prev => ({ ...prev, [type === 'start' ? 'startDate' : 'endDate']: value }));
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
    };

    const handleTrigger = async () => {
        if (!tablename) return;
        try {
            const res = await fetch(`http://localhost:8000/runs/trigger/${tablename}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pipeline_name: 'default',
                    triggered_by: 'manual_details'
                }),
            });
            if (!res.ok) throw new Error('Failed to trigger pipeline');
            // Refresh data
            fetchData();
        } catch (err) {
            alert('Failed to trigger pipeline: ' + err);
        }
    };

    const handleToggleStatus = async () => {
        if (!config) return;
        try {
            // Toggle logic similar to main page
            const newStatus = config.source_to_dl_is_active ? 0 : 1;
            const updated = { ...config, source_to_dl_is_active: newStatus };

            const res = await fetch(`http://localhost:8000/pipelines/${config.source_tablename}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            });

            if (!res.ok) throw new Error('Failed to update status');
            fetchData();
        } catch (err) {
            alert('Failed to toggle status');
        }
    };

    const handleDelete = async () => {
        if (!config) return;
        if (!confirm(`Are you sure you want to delete the pipeline for ${config.source_tablename}?`)) return;

        try {
            const res = await fetch(`http://localhost:8000/pipelines/${config.source_tablename}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete config');
            router.push('/pipelines');
        } catch (err) {
            console.error(err);
            alert('Failed to delete pipeline');
        }
    };

    const handleSaveConfig = async (updatedConfig: Config) => {
        try {
            const res = await fetch(`http://localhost:8000/pipelines/${updatedConfig.source_tablename}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig),
            });

            if (!res.ok) throw new Error('Failed to update config');

            // Re-fetch to ensure we have the latest server state (including derived fields if any)
            await fetchData();
            setEditingConfig(null);
        } catch (err) {
            console.error(err);
            alert('Failed to save configuration');
            throw err; // Propagate to form
        }
    };

    // Helper to get friendly stage name
    const getStageLabel = (type: string) => {
        if (type.includes('source_to_dl')) return 'Ingestion';
        if (type.includes('dl_to_sink')) return 'Load';
        if (type.includes('verify')) return 'Verify';
        return type;
    };

    // Sidebar Items
    const sidebarItems = [
        {
            id: 'details', label: 'Overview', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            )
        },
        {
            id: 'configure', label: 'Configure', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )
        },
        {
            id: 'schema', label: 'Schema Map', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            )
        },
        {
            id: 'transform', label: 'Transformation', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            )
        },
    ] as const;


    if (loading && !config) { // Only block if we have no config
        return (
            <div className="min-h-screen bg-[#0f111a] text-white font-sans flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="min-h-screen bg-[#0f111a] text-white font-sans flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Pipeline Not Found</h2>
                    <p className="text-gray-400 mb-4">{error || "Could not load pipeline details"}</p>
                    <button
                        onClick={() => router.push('/pipelines')}
                        className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
                    >
                        Back to Pipelines
                    </button>
                </div>
            </div>
        );
    }

    const latestRun = pipelineRuns && pipelineRuns.length > 0 ? pipelineRuns[0] : undefined;

    return (
        <div className="min-h-screen bg-[#0f111a] text-white font-sans selection:bg-indigo-500/30">
            <Header />

            <div className="flex h-[calc(100vh-64px)] overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 bg-gray-900/50 border-r border-white/5 flex flex-col">
                    <div className="p-6 border-b border-white/5">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2">
                            Actions
                        </h2>
                    </div>

                    <nav className="flex-1 p-4 space-y-1">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (item.id === 'configure') {
                                        setActiveSection('configure');
                                    } else {
                                        setActiveSection(item.id as any);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === item.id
                                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/10'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                {item.icon}
                                <span className="font-medium text-sm">{item.label}</span>
                            </button>
                        ))}

                        {/* Delete Button at bottom */}
                        <div className="mt-8 pt-6 border-t border-white/5 px-2">
                            <button
                                onClick={handleDelete}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span className="font-medium text-sm">Delete Pipeline</span>
                            </button>
                        </div>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-stars relative">
                    <div className="p-8 max-w-7xl mx-auto">

                        {/* Title Section */}
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={() => router.push('/pipelines')}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </button>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                {config.source_tablename}
                            </h1>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-800 text-gray-400 border border-gray-700">
                                Pipeline Details
                            </span>
                        </div>

                        {activeSection === 'details' && (
                            <div className="space-y-8 animate-fadeIn">
                                {/* Visual Card */}
                                <div className="mb-8">
                                    <PipelineCard
                                        config={config}
                                        latestRun={latestRun}
                                        loadedStats={loadedStats}
                                        triggeringTable={null}
                                        selectedTimeRange={null}
                                        onTrigger={handleTrigger}
                                        onToggleStatus={handleToggleStatus}
                                        onEdit={() => setActiveSection('configure')} // Switch tab instead of modal
                                        onDelete={handleDelete}
                                        disableNavigation={true}
                                    />
                                    <p className="text-center text-xs text-gray-500 mt-2">
                                        Use the "..." menu on the card to Run, Pause, or Edit.
                                    </p>
                                </div>

                                {/* Recent Activity - Logs */}
                                <div className="bg-gray-900/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-md">
                                    {/* Filters Header */}
                                    <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <h3 className="font-bold text-lg">Recent Execution History</h3>

                                        <div className="flex items-center gap-2">
                                            {/* Date Filters */}
                                            <input
                                                type="date"
                                                value={dateFilter.startDate}
                                                onChange={(e) => handleDateChange('start', e.target.value)}
                                                className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50"
                                                placeholder="Start Date"
                                            />
                                            <span className="text-gray-500">-</span>
                                            <input
                                                type="date"
                                                value={dateFilter.endDate}
                                                onChange={(e) => handleDateChange('end', e.target.value)}
                                                className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50"
                                                placeholder="End Date"
                                            />

                                            <div className="h-4 w-px bg-white/10 mx-2"></div>

                                            <button
                                                onClick={() => fetchData()}
                                                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                Refresh
                                            </button>
                                        </div>
                                    </div>

                                    {/* List */}
                                    <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto min-h-[200px]">
                                        {loading && pipelineRuns.length === 0 ? (
                                            <div className="flex justify-center items-center h-40">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                                            </div>
                                        ) : pipelineRuns.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500">
                                                No runs found. {dateFilter.startDate ? "Try adjusting your filters." : ""}
                                            </div>
                                        ) : (
                                            pipelineRuns.map((run) => (
                                                <div key={run.id} className="p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${run.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                                                run.status === 'running' ? 'bg-blue-500 animate-pulse' :
                                                                    run.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                                                                }`} />
                                                            <span className="font-mono text-sm text-gray-300 font-bold tracking-wide">{run.id.substring(0, 8)}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-500 font-mono">{new Date(run.started_at).toLocaleString()}</span>
                                                    </div>

                                                    {/* Stages Detail View */}
                                                    <div className="ml-6 grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                                        {(run.stages || []).map((stage, idx) => (
                                                            <div key={idx} className="bg-black/40 rounded px-3 py-2 border border-white/5 flex flex-col gap-1">
                                                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-500">
                                                                    <span>{getStageLabel(stage.pipeline_type)}</span>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${stage.status === 'success' ? 'bg-green-500' :
                                                                        stage.status === 'running' ? 'bg-blue-500' :
                                                                            stage.status === 'failed' ? 'bg-red-500' : 'bg-gray-700'
                                                                        }`} />
                                                                </div>
                                                                <div className="font-mono text-xs text-gray-200">
                                                                    {stage.rows_processed !== undefined && stage.rows_processed !== null
                                                                        ? `${stage.rows_processed.toLocaleString()} rows`
                                                                        : stage.status === 'success' ? 'Completed' : stage.status}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {run.error_message && (
                                                        <div className="ml-6 mt-3 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 font-mono">
                                                            Error: {run.error_message}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Pagination Footer */}
                                    <div className="p-3 border-t border-white/5 bg-black/20 flex items-center justify-between text-xs text-gray-400">
                                        <span>
                                            Showing {pipelineRuns.length} of {pagination.total} runs
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handlePageChange(pagination.page - 1)}
                                                disabled={pagination.page <= 1}
                                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Previous
                                            </button>
                                            <span className="px-2">
                                                Page {pagination.page} of {pagination.total_pages || 1}
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(pagination.page + 1)}
                                                disabled={pagination.page >= pagination.total_pages}
                                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'configure' && (
                            <PipelineConfigForm
                                config={config}
                                onSave={handleSaveConfig}
                            />
                        )}

                        {activeSection === 'schema' && (
                            <div className="space-y-6 animate-fadeIn">
                                {/* Header / Actions */}
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-300">Schema Mapping</h3>
                                        <p className="text-sm text-gray-400">View and map source columns to destination columns.</p>
                                    </div>
                                    <button
                                        onClick={() => handleRefreshSchema()}
                                        disabled={refreshingSchema}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 rounded-lg text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        {refreshingSchema ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>Refreshing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                <span>Refresh Schema</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                {/* Progress Bar - Always present to prevent layout shift */}
                                <div className={`w-full bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden transition-opacity duration-300 ${refreshingSchema ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="bg-indigo-500 h-1.5 rounded-full animate-progress"></div>
                                </div>

                                {!schemaInfo || (!schemaInfo.source_schema && !schemaInfo.destination_schema) ? (
                                    <div className="bg-gray-900/40 border border-white/5 rounded-xl p-12 text-center">
                                        <div className="text-gray-500 mb-4">
                                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <h3 className="text-lg font-bold text-gray-300">No Schema Information</h3>
                                            <p className="text-sm mt-2 text-gray-500">Click "Refresh Schema" to fetch the latest structure from Source and Destination.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-8">
                                        {/* Source Schema */}
                                        <div className="bg-gray-900/40 border border-white/5 rounded-xl overflow-hidden">
                                            <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                                <h4 className="font-bold flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    Source (Data Lake)
                                                </h4>
                                                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                                                    {schemaInfo.source_schema?.length || 0} Columns
                                                </span>
                                            </div>
                                            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                                                {schemaInfo.source_schema?.map((col, idx) => (
                                                    <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex justify-between items-center">
                                                        <span className="font-mono text-sm text-gray-300">{col.name}</span>
                                                        <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{col.type}</span>
                                                    </div>
                                                )) || <div className="p-4 text-center text-gray-500 text-sm">No source schema found.</div>}
                                            </div>
                                        </div>

                                        {/* Destination Schema */}
                                        <div className="bg-gray-900/40 border border-white/5 rounded-xl overflow-hidden">
                                            <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                                <h4 className="font-bold flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Destination (Sink)
                                                </h4>
                                                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                                                    {schemaInfo.destination_schema?.length || 0} Columns
                                                </span>
                                            </div>
                                            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                                                {schemaInfo.destination_schema?.map((col, idx) => (
                                                    <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex justify-between items-center">
                                                        <span className="font-mono text-sm text-gray-300">{col.name}</span>
                                                        <span className="text-xs text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">{col.type}</span>
                                                    </div>
                                                )) || <div className="p-4 text-center text-gray-500 text-sm">No destination schema found.</div>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {schemaInfo?.last_updated && (
                                    <div className="text-center text-xs text-gray-500">
                                        Last Updated: {new Date(schemaInfo.last_updated).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSection === 'transform' && (
                            <div className="bg-gray-900/40 border border-white/5 rounded-xl p-6 animate-fadeIn h-full">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                    Transformation Script
                                </h3>
                                <div className="flex flex-col h-[400px]">
                                    <textarea
                                        className="flex-1 bg-black/50 border border-white/10 rounded-lg p-4 font-mono text-sm text-green-400 focus:outline-none focus:border-indigo-500/50 resize-None"
                                        placeholder="-- Write your SQL transformation here&#10;SELECT * FROM source_table WHERE..."
                                    ></textarea>
                                    <div className="flex justify-end gap-3 mt-4">
                                        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">Validate</button>
                                        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-bold shadow-lg shadow-indigo-500/20 transition-colors">Save Transformation</button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
}
