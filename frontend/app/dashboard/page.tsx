'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { StatsOverview } from '../../components/features/stats/StatsOverview';
import { DashboardCharts } from '../../components/features/stats/DashboardCharts';

interface LogStats {
    status_distribution: { name: string; value: number }[];
    pipeline_type_distribution: { name: string; value: number }[];
    runs_per_table: { source_tablename: string; total_runs: number; success_count: number; failed_count: number; total_rows: number }[];
    daily_runs: { run_date: string; runs: number; success: number; failed: number }[];
    totals: { total_runs: number; total_success: number; total_failed: number; total_rows_processed: number };
}

export default function DashboardPage() {
    const [stats, setStats] = useState<LogStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const statsRes = await fetch('http://localhost:8000/logs/stats/summary');
            if (!statsRes.ok) throw new Error('Failed to fetch data');
            setStats(await statsRes.json());
        } catch (err) {
            setError('Failed to load data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

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
                            <div className="text-indigo-400 animate-pulse text-sm font-medium tracking-wide">Loading Dashboard...</div>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="animate-fade-in space-y-6">
                            <StatsOverview stats={stats} />
                            <DashboardCharts stats={stats} />
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
