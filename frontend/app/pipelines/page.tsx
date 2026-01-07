'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Config, PipelineRun, ConfigCreate } from '../../types';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { PipelineGrid } from '../../components/features/pipelines/PipelineGrid';
import { AddPipelineModal } from '../../components/features/pipelines/AddPipelineModal';
import { EditPipelineModal } from '../../components/features/pipelines/EditPipelineModal';

export default function PipelinesPage() {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pipeline Grid State
    const [triggeringTable, setTriggeringTable] = useState<string | null>(null);
    const [loadedStats, setLoadedStats] = useState<Record<string, number>>({});
    const [selectedTimeRange, setSelectedTimeRange] = useState<number | null>(null);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Config | null>(null);

    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [configRes, runsRes] = await Promise.all([
                fetch('http://localhost:8000/pipelines'),
                fetch('http://localhost:8000/runs')
            ]);

            if (!configRes.ok) throw new Error('Failed to fetch data');

            setConfigs(await configRes.json());
            if (runsRes.ok) setPipelineRuns(await runsRes.json());
        } catch (err) {
            setError('Failed to load data. Is the backend running?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchLoadedStats(selectedTimeRange);
    }, [selectedTimeRange, fetchLoadedStats]);

    // Auto-refresh runs
    useEffect(() => {
        const anyRunning = pipelineRuns.some(run => run.status === 'running' || run.status === 'pending');
        if (anyRunning) {
            const fetchRuns = async () => {
                try {
                    const runsRes = await fetch('http://localhost:8000/runs');
                    if (runsRes.ok) setPipelineRuns(await runsRes.json());
                } catch (e) { console.error(e); }
            };
            const interval = setInterval(fetchRuns, 5000);
            return () => clearInterval(interval);
        }
    }, [pipelineRuns]);

    // Handlers
    const handleCreateConfig = async (newConfig: ConfigCreate) => {
        try {
            const res = await fetch('http://localhost:8000/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to create config');
            }

            fetchData();
            setNotification({ message: 'Pipeline created successfully!', type: 'success' });
        } catch (err: any) {
            setNotification({ message: `Error: ${err.message}`, type: 'error' });
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
            setConfigs(prev => prev.map(c => c.source_tablename === updatedConfig.source_tablename ? updatedConfig : c));
            setNotification({ message: 'Configuration saved successfully!', type: 'success' });
            setEditingConfig(null);
        } catch (err) {
            setNotification({ message: 'Failed to save configuration.', type: 'error' });
        }
    };

    const handleDeleteConfig = async (config: Config) => {
        if (!confirm(`Are you sure you want to delete the pipeline for ${config.source_tablename}?`)) return;

        try {
            const res = await fetch(`http://localhost:8000/pipelines/${config.source_tablename}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete config');

            setConfigs(prev => prev.filter(c => c.source_tablename !== config.source_tablename));
            setNotification({ message: 'Pipeline deleted successfully!', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Failed to delete pipeline.', type: 'error' });
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
            setConfigs(prev => prev.map(c => c.source_tablename === config.source_tablename ? updated : c));
            await handleSaveConfig(updated);
        } catch {
            // Error handled in save
        }
    };

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    return (
        <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col">
            <div className="fixed inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/20 via-[#0f111a]/50 to-[#0f111a] pointer-events-none" />

            <Header />

            <main className="relative flex-grow flex flex-col items-center p-6 md:p-10 z-10">
                <div className="w-full max-w-7xl space-y-8">
                    {loading && (
                        <div className="flex flex-col justify-center items-center py-32 space-y-4">
                            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                            <div className="text-indigo-400 animate-pulse text-sm font-medium tracking-wide">Synchronizing Pipelines...</div>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="animate-fade-in space-y-6">
                            <PipelineGrid
                                configs={configs}
                                pipelineRuns={pipelineRuns}
                                loadedStats={loadedStats}
                                triggeringTable={triggeringTable}
                                onTrigger={handleTriggerPipeline}
                                onToggleStatus={handleToggleStatus}
                                onEdit={setEditingConfig}
                                onDelete={handleDeleteConfig}
                                selectedTimeRange={selectedTimeRange}
                                setSelectedTimeRange={setSelectedTimeRange}
                                onAdd={() => setIsAddModalOpen(true)}
                                onRefresh={fetchData}
                            />
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

            <AddPipelineModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleCreateConfig}
            />

            <EditPipelineModal
                isOpen={!!editingConfig}
                onClose={() => setEditingConfig(null)}
                config={editingConfig}
                onSave={handleSaveConfig}
            />
        </div>
    );
}
