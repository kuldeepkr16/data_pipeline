import React, { useState, useEffect } from 'react';
import { ConfigCreate, SourceConfig, DestinationConfig } from '../../../types';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';

interface AddPipelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: ConfigCreate) => void;
}

export const AddPipelineModal: React.FC<AddPipelineModalProps> = ({ isOpen, onClose, onSave }) => {
    const [config, setConfig] = useState<ConfigCreate>({
        source_tablename: '',
        sink_tablename: '',
        source_name: '', // Initialize source_name
        destination_name: '', // Initialize destination_name
        source_to_dl_schedule: 60,
        source_to_dl_load_type: 'full',
        dl_to_sink_schedule: 60,
        dl_to_sink_load_type: 'full',
        source_type: 'postgres',
        sink_type: 'postgres'
    });

    const [sources, setSources] = useState<SourceConfig[]>([]);
    const [destinations, setDestinations] = useState<DestinationConfig[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedSource, setSelectedSource] = useState<string>('');
    const [selectedSink, setSelectedSink] = useState<string>('');
    const [loadingTables, setLoadingTables] = useState(false);

    // Fetch Sources and Destinations on Mount
    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const [sourcesRes, destsRes] = await Promise.all([
                        fetch('http://localhost:8000/sources'),
                        fetch('http://localhost:8000/destinations')
                    ]);
                    if (sourcesRes.ok) setSources(await sourcesRes.json());
                    if (destsRes.ok) setDestinations(await destsRes.json());
                } catch (e) {
                    console.error("Failed to load metadata", e);
                }
            };
            fetchData();
        }
    }, [isOpen]);

    // Fetch Tables when Source is Selected
    useEffect(() => {
        if (!selectedSource) return;

        const fetchTables = async () => {
            setLoadingTables(true);
            try {
                // Find source name based on ID (or just use string if IDs match, assuming selectedSource is source_name)
                // The Select returns the value. Let's assume value is source_name.
                const res = await fetch(`http://localhost:8000/sources/${selectedSource}/tables`);
                if (res.ok) {
                    setTables(await res.json());
                } else {
                    setTables([]);
                }
            } catch (e) {
                console.error("Failed to load tables", e);
                setTables([]);
            } finally {
                setLoadingTables(false);
            }
        };

        fetchTables();
    }, [selectedSource]);

    const handleSave = () => {
        onSave({
            ...config,
            source_name: selectedSource,
            destination_name: selectedSink
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Pipeline">
            <div className="space-y-6">

                {/* Source Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Source Database"
                        value={selectedSource}
                        onChange={(e) => {
                            setSelectedSource(e.target.value);
                            // Also set the source_type if relevant
                            const source = sources.find(s => s.source_name === e.target.value);
                            setConfig(prev => ({ ...prev, source_type: source?.source_type || 'postgres' }));
                        }}
                        options={[
                            { value: '', label: 'Select Source...' },
                            ...sources.map(s => ({ value: s.source_name, label: s.source_name }))
                        ]}
                    />

                    <Select
                        label="Source Table"
                        value={config.source_tablename}
                        onChange={(e) => setConfig({ ...config, source_tablename: e.target.value })}
                        options={[
                            { value: '', label: 'Select Table...' },
                            ...tables.map(t => ({ value: t, label: t }))
                        ]}
                        disabled={!selectedSource || loadingTables}
                    />
                </div>

                {/* Sink Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Destination Database"
                        value={selectedSink}
                        onChange={(e) => {
                            setSelectedSink(e.target.value);
                            const dest = destinations.find(d => d.destination_name === e.target.value);
                            if (dest) {
                                setConfig(prev => ({ ...prev, sink_type: dest.destination_type }));
                            }
                        }}
                        options={[
                            { value: '', label: 'Select Destination...' },
                            ...destinations.map(d => ({ value: d.destination_name, label: d.destination_name }))
                        ]}
                    />

                    <Input
                        label="Sink Table Name"
                        value={config.sink_tablename}
                        onChange={(e) => setConfig({ ...config, sink_tablename: e.target.value })}
                        placeholder="e.g. customers_analytics"
                    />
                </div>

                <hr className="border-white/10" />

                {/* Schedules */}
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Source -> Lake Schedule (min)"
                        type="number"
                        value={config.source_to_dl_schedule}
                        onChange={(e) => setConfig({ ...config, source_to_dl_schedule: Number(e.target.value) })}
                    />
                    <Select
                        label="Load Type"
                        value={config.source_to_dl_load_type}
                        onChange={(e) => setConfig({ ...config, source_to_dl_load_type: e.target.value })}
                        options={[
                            { value: 'incremental', label: 'Incremental' },
                            { value: 'full', label: 'Full Replace' }
                        ]}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Lake -> Sink Schedule (min)"
                        type="number"
                        value={config.dl_to_sink_schedule}
                        onChange={(e) => setConfig({ ...config, dl_to_sink_schedule: Number(e.target.value) })}
                    />
                    <Select
                        label="Load Type"
                        value={config.dl_to_sink_load_type}
                        onChange={(e) => setConfig({ ...config, dl_to_sink_load_type: e.target.value })}
                        options={[
                            { value: 'incremental', label: 'Incremental' },
                            { value: 'full', label: 'Full Replace' }
                        ]}
                    />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!config.source_tablename || !config.sink_tablename}>Create Pipeline</Button>
                </div>
            </div>
        </Modal>
    );
};
