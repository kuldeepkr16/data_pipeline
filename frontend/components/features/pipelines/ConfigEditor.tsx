import React, { useState } from 'react';
import { Config } from '../../../types';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { Badge } from '../../common/Badge';

interface ConfigEditorProps {
    configs: Config[];
    onSave: (config: Config) => void;
    onEdit: (config: Config) => void;
    onAdd: () => void;
    editingId: string | null;
    setEditingId: (id: string | null) => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
    configs, onSave, onEdit, onAdd, editingId, setEditingId
}) => {
    const [tempConfig, setTempConfig] = useState<Config | null>(null);

    React.useEffect(() => {
        if (editingId) {
            const configToEdit = configs.find(c => c.source_tablename === editingId);
            if (configToEdit) setTempConfig(configToEdit);
        }
    }, [editingId, configs]);

    const handleEditClick = (config: Config) => {
        onEdit(config);
        // setTempConfig is handled by effect now
    };

    const handleSaveClick = () => {
        if (tempConfig) {
            onSave(tempConfig);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={onAdd} className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create New Pipeline</span>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {configs.map((config) => (
                    <Card key={config.source_tablename} className="hover:bg-gray-900/60 transition-colors group">
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
                                    <Input
                                        label="Frequency (Minutes)"
                                        type="number"
                                        value={tempConfig?.source_to_dl_schedule || 0}
                                        onChange={(e) => setTempConfig({ ...tempConfig!, source_to_dl_schedule: Number(e.target.value) })}
                                    />

                                    <Select
                                        label="Loading Strategy"
                                        value={tempConfig?.source_to_dl_load_type || 'incremental'}
                                        onChange={(e) => setTempConfig({ ...tempConfig!, source_to_dl_load_type: e.target.value })}
                                        options={[
                                            { value: 'incremental', label: 'Incremental' },
                                            { value: 'full', label: 'Full Replace' }
                                        ]}
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-white/5">
                                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveClick}>
                                        Save Changes
                                    </Button>
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
                                        onClick={() => handleEditClick(config)}
                                        className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Edit Configuration"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center">
                                            Frequency
                                        </label>
                                        <p className="text-white font-mono text-sm">Every {config.source_to_dl_schedule}m</p>
                                    </div>

                                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center">
                                            Strategy
                                        </label>
                                        <p className="text-white font-mono text-sm capitalize">{config.source_to_dl_load_type}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
};
