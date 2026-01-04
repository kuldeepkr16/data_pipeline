import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Card } from '../../common/Card';

interface DashboardChartsProps {
    stats: any; // Using any temporarily
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
    success: '#10b981',
    failed: '#ef4444',
    running: '#3b82f6',
    pending: '#6b7280'
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ stats }) => {
    if (!stats) return null;

    return (
        <div className="space-y-8">
            {/* Top Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="!bg-gray-900/40">
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
                </Card>

                <Card className="!bg-gray-900/40">
                    <h3 className="text-lg font-semibold text-white mb-4">Status Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={stats.status_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#9ca3af' }}>
                                {stats.status_distribution.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Bottom Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="!bg-gray-900/40">
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
                </Card>

                <Card className="!bg-gray-900/40">
                    <h3 className="text-lg font-semibold text-white mb-4">Pipeline Type Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={stats.pipeline_type_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#9ca3af' }}>
                                {stats.pipeline_type_distribution.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        </div>
    );
};
