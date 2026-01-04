import React from 'react';
import { Card } from '../../common/Card';

interface StatsOverviewProps {
    stats: any; // Using any temporarily, should be typed properly later
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
    if (!stats) return <div className="text-gray-400">No statistics available</div>;

    return (
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
    );
};
