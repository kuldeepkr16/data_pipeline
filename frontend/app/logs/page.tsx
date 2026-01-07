'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { LogTable } from '../../components/features/logs/LogTable';
import { LogFilters } from '../../components/features/logs/LogFilters';
import { LogDetailsModal } from '../../components/features/logs/LogDetailsModal';
import { Config, PipelineLog } from '../../types';

export default function LogsPage() {
    const [logs, setLogs] = useState<PipelineLog[]>([]);
    const [configs, setConfigs] = useState<Config[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [logsPage, setLogsPage] = useState(1);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<PipelineLog | null>(null);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(formatDate(thirtyDaysAgo));
    const [endDate, setEndDate] = useState(formatDate(today));

    // Fetch Metadata (Configs)
    useEffect(() => {
        fetch('http://localhost:8000/pipelines')
            .then(res => res.json())
            .then(setConfigs)
            .catch(console.error);
    }, []);

    const fetchLogs = useCallback(async () => {
        if (!selectedTable) {
            setLogs([]);
            return;
        }
        setLoading(true);
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
            setLoading(false);
        }
    }, [logsPage, startDate, endDate, selectedTable]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleResetLogs = () => {
        setSelectedTable(null);
        setStartDate(formatDate(thirtyDaysAgo));
        setEndDate(formatDate(today));
        setLogsPage(1);
        setLogs([]);
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col">
            <div className="fixed inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/20 via-[#0f111a]/50 to-[#0f111a] pointer-events-none" />

            <Header />

            <main className="relative flex-grow flex flex-col items-center p-6 md:p-10 z-10">
                <div className="w-full max-w-7xl space-y-8">
                    <div className="animate-fade-in space-y-4">
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
                            loading={loading}
                            selectedTable={selectedTable}
                            page={logsPage}
                            setPage={setLogsPage}
                            onShowDetails={setSelectedLog}
                        />
                    </div>
                </div>
            </main>
            <Footer />
            <LogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
        </div>
    );
}
