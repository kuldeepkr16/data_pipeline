import React, { useState, useEffect } from 'react';
import { Config } from '../../../types';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';

interface PipelineConfigFormProps {
    config: Config;
    onSave: (config: Config) => Promise<void>;
}

export const PipelineConfigForm: React.FC<PipelineConfigFormProps> = ({ config, onSave }) => {
    const [formData, setFormData] = useState<Config>(config);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setFormData(config);
        setIsDirty(false);
    }, [config]);

    const handleChange = (field: keyof Config, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            setIsDirty(JSON.stringify(updated) !== JSON.stringify(config));
            return updated;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(formData);
            setIsDirty(false); // Reset dirty state on success if parent doesn't force re-render immediately
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
            {/* Header / Actions */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <div>
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Pipeline Configuration
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        View and update the core settings for this pipeline.
                    </p>
                </div>
                {isDirty && (
                    <div className="flex items-center gap-3 animate-slideIn">
                        <span className="text-xs text-yellow-500 font-mono">Unsaved Changes</span>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setFormData(config);
                                setIsDirty(false);
                            }}
                            disabled={saving}
                        >
                            Discard
                        </Button>
                        <Button type="submit" isLoading={saving}>
                            Save Changes
                        </Button>
                    </div>
                )}
            </div>

            {/* General Settings */}
            <div className="bg-gray-900/40 border border-white/5 rounded-xl p-6">
                <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">
                    General Identity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Source Table Name (Immutable)"
                        value={formData.source_tablename}
                        // Only readonly, cannot rename primary key easily
                        readOnly
                        className="opacity-50 cursor-not-allowed"
                    />
                    <Input
                        label="Sink Table Name"
                        value={formData.sink_tablename || ''}
                        onChange={(e) => handleChange('sink_tablename', e.target.value)}
                        placeholder="Target table in destination"
                    />
                    <Input
                        label="Source Connection Name"
                        value={formData.source_name || ''}
                        readOnly
                        className="opacity-50"
                    />
                    <Input
                        label="Destination Connection Name"
                        value={formData.destination_name || ''}
                        readOnly
                        className="opacity-50"
                    />
                </div>
            </div>

            {/* Ingestion Settings */}
            <div className="bg-gray-900/40 border border-white/5 rounded-xl p-6">
                <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">
                    Ingestion (Source → Data Lake)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Select
                        label="Activation Status"
                        value={formData.source_to_dl_is_active ? '1' : '0'}
                        onChange={(e) => handleChange('source_to_dl_is_active', parseInt(e.target.value))}
                        options={[
                            { value: '1', label: 'Active' },
                            { value: '0', label: 'Paused' }
                        ]}
                    />
                    <Input
                        label="Schedule (Minutes)"
                        type="number"
                        value={formData.source_to_dl_schedule}
                        onChange={(e) => handleChange('source_to_dl_schedule', Number(e.target.value))}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select
                        label="Load Type"
                        value={formData.source_to_dl_load_type}
                        onChange={(e) => handleChange('source_to_dl_load_type', e.target.value)}
                        options={[
                            { value: 'full', label: 'Full Refresh' },
                            { value: 'incremental', label: 'Incremental' }
                        ]}
                    />
                    {formData.source_to_dl_load_type === 'incremental' && (
                        <Input
                            label="Incremental Key"
                            value={formData.source_to_dl_incremental_key || ''}
                            onChange={(e) => handleChange('source_to_dl_incremental_key', e.target.value)}
                            placeholder="e.g., updated_at, id"
                        />
                    )}
                </div>
            </div>

            {/* Loading Settings */}
            <div className="bg-gray-900/40 border border-white/5 rounded-xl p-6">
                <h4 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">
                    Loading (Data Lake → Sink)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Select
                        label="Activation Status"
                        value={formData.dl_to_sink_is_active ? '1' : '0'} // Assuming optional in interface but typically 0/1 in DB
                        onChange={(e) => handleChange('dl_to_sink_is_active', parseInt(e.target.value))}
                        options={[
                            { value: '1', label: 'Active' },
                            { value: '0', label: 'Paused' }
                        ]}
                    />
                    <Input
                        label="Schedule (Minutes)"
                        type="number"
                        value={formData.dl_to_sink_schedule || 0}
                        onChange={(e) => handleChange('dl_to_sink_schedule', Number(e.target.value))}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select
                        label="Load Type"
                        value={formData.dl_to_sink_load_type || 'full'}
                        onChange={(e) => handleChange('dl_to_sink_load_type', e.target.value)}
                        options={[
                            { value: 'full', label: 'Full Refresh' },
                            { value: 'incremental', label: 'Incremental' }
                        ]}
                    />
                    {formData.dl_to_sink_load_type === 'incremental' && (
                        <Input
                            label="Incremental Key"
                            value={formData.dl_to_sink_incremental_key || ''}
                            onChange={(e) => handleChange('dl_to_sink_incremental_key', e.target.value)}
                            placeholder="e.g., updated_at, id"
                        />
                    )}
                </div>
            </div>

        </form>
    );
};
