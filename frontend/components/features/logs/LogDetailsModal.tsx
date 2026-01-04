import React from 'react';
import { Modal } from '../../common/Modal';
import { PipelineLog } from '../../../types';
import { Badge } from '../../common/Badge';
import { formatTimestamp } from '../../../utils/formatters';

interface LogDetailsModalProps {
    log: PipelineLog | null;
    onClose: () => void;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({ log, onClose }) => {
    if (!log) return null;

    return (
        <Modal isOpen={!!log} onClose={onClose} title="Log Details">
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Table</label>
                    <p className="text-white font-medium capitalize text-lg">{log.source_tablename}</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pipeline Type</label>
                    <div className="flex">
                        <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium border border-indigo-500/10">
                            {log.pipeline_type}
                        </span>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
                    <Badge variant={log.status as any}>{log.status.toUpperCase()}</Badge>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rows Processed</label>
                    <p className="text-gray-300 font-mono text-lg">{log.rows_processed?.toLocaleString() ?? '-'}</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Started At</label>
                    <p className="text-gray-300 text-sm">{formatTimestamp(log.started_at)}</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Time Taken</label>
                    <p className="text-gray-300 font-mono text-sm">{log.time_taken || '-'}</p>
                </div>
            </div>

            {log.file_paths && (
                <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Processed Files
                    </label>
                    <div className="font-mono text-xs text-indigo-300 break-all bg-black/30 p-3 rounded-lg border border-white/5">
                        {log.file_paths}
                    </div>
                </div>
            )}

            {log.error_message && (
                <div className="space-y-2 bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                    <label className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Error Details
                    </label>
                    <p className="text-red-300 text-sm font-mono whitespace-pre-wrap">{log.error_message}</p>
                </div>
            )}

            <div className="p-4 bg-black/20 rounded-lg text-xs text-gray-500 font-mono">
                ID: {log.id}
            </div>
        </Modal>
    );
};
