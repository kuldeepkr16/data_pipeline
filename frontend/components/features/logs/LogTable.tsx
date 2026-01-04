import React, { useState } from 'react';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { PipelineLog } from '../../../types';
import { formatTimestamp } from '../../../utils/formatters';

interface LogTableProps {
    logs: PipelineLog[];
    loading: boolean;
    selectedTable: string | null;
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    onShowDetails: (log: PipelineLog) => void;
}

export const LogTable: React.FC<LogTableProps> = ({
    logs, loading, selectedTable, page, setPage, onShowDetails
}) => {
    const [activeMenuLogId, setActiveMenuLogId] = useState<string | null>(null);

    return (
        <Card className="overflow-hidden !p-0 !bg-gray-900/40">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 bg-black/20">
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16"></th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Table</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Pipeline</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rows</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time Taken</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Started At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!selectedTable ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-16 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                        <p className="text-gray-400 font-medium">Please select a table to view logs</p>
                                        <p className="text-gray-600 text-xs">Choose a source table from the dropdown above</p>
                                    </div>
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No pipeline runs logged yet</td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 text-center relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuLogId(activeMenuLogId === log.id ? null : log.id);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                            </svg>
                                        </button>

                                        {activeMenuLogId === log.id && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenuLogId(null)}></div>
                                                <div className="absolute left-0 mt-2 w-48 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-black/50 origin-top-left">
                                                    <button
                                                        onClick={() => {
                                                            onShowDetails(log);
                                                            setActiveMenuLogId(null);
                                                        }}
                                                        className="w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Show Details
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-white font-medium capitalize">{log.source_tablename}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{log.pipeline_type}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={log.status as any}>{log.status.toUpperCase()}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-gray-300 font-mono text-sm">{log.rows_processed?.toLocaleString() || '-'}</td>
                                    <td className="px-4 py-3 text-gray-300 font-mono text-sm">{log.time_taken || '-'}</td>
                                    <td className="px-4 py-3 text-gray-400 text-sm">{formatTimestamp(log.started_at)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>


            {/* Pagination Footer */}
            <div className="border-t border-white/5 bg-black/20 p-3 flex justify-between items-center">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${page === 1
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Previous
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">Page <span className="text-white font-bold">{page}</span></span>
                    {loading && <span className="text-xs text-indigo-400 animate-pulse ml-2">Loading...</span>}
                </div>

                <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={logs.length < 10 || loading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${logs.length < 10
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Next
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </Card>
    );
};
