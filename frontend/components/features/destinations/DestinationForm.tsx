import React, { useState, useEffect } from 'react';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { DestinationConfig, ConnectionCreds } from '../../../types';
import { CONNECTOR_TYPES, getConnectorDefinition } from '../../../constants/connectorConfig';

interface DestinationFormProps {
    initialData?: Partial<DestinationConfig>;
    onSubmit: (data: Partial<DestinationConfig>) => Promise<void>;
    onCancel: () => void;
    isEditing?: boolean;
}

export const DestinationForm: React.FC<DestinationFormProps> = ({ initialData, onSubmit, onCancel, isEditing = false }) => {
    // Default to first type if not specified
    const defaultType = CONNECTOR_TYPES[0].id;

    const [formData, setFormData] = useState<Partial<DestinationConfig>>({
        destination_name: '',
        destination_type: defaultType,
        destination_creds: {}
    });

    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                destination_creds: {
                    ...prev.destination_creds,
                    ...initialData.destination_creds
                }
            }));
        }
    }, [initialData]);

    const updateCreds = (field: string, value: any) => {
        setTestStatus('idle');
        setTestMessage(null);
        setFormData(prev => ({
            ...prev,
            destination_creds: {
                ...prev.destination_creds,
                [field]: value
            }
        }));
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestMessage(null);
        setError(null);

        // Frontend Validation
        const activeDefinition = getConnectorDefinition(formData.destination_type || defaultType);
        if (activeDefinition) {
            const missingFields: string[] = [];
            activeDefinition.fields.forEach(field => {
                if (field.required) {
                    const val = formData.destination_creds?.[field.key];
                    if (val === undefined || val === null || val === '') {
                        missingFields.push(field.label);
                    }
                }
            });

            if (missingFields.length > 0) {
                setTestStatus('idle');
                setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
                return;
            }
        }

        try {
            const res = await fetch('http://localhost:8000/connections/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: formData.destination_type,
                    creds: formData.destination_creds
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Connection failed');
            }

            setTestStatus('success');
            setTestMessage('Connection successful!');
        } catch (err: any) {
            setTestStatus('failed');
            setTestMessage(err.message);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        if (!formData.destination_name) {
            setError("Destination Name is required");
            return;
        }

        setLoading(true);
        try {
            await onSubmit(formData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const activeDefinition = getConnectorDefinition(formData.destination_type || defaultType);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Connector Type</label>
                    <select
                        className="w-full bg-[#0f111a] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                        value={formData.destination_type}
                        onChange={(e) => {
                            setFormData({
                                ...formData,
                                destination_type: e.target.value,
                                destination_creds: {} // Reset creds on type change
                            });
                            setTestStatus('idle');
                        }}
                        disabled={isEditing}
                    >
                        {CONNECTOR_TYPES.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Destination Name (Identifier)</label>
                    <Input
                        value={formData.destination_name}
                        onChange={(e) => setFormData({ ...formData, destination_name: e.target.value })}
                        placeholder="e.g., analytics_db"
                    />
                </div>

                {activeDefinition && (
                    <div className="pt-4 border-t border-white/5">
                        <h3 className="text-md font-semibold text-gray-300 mb-3">Connection Details</h3>

                        <div className="grid grid-cols-1 gap-4">
                            {activeDefinition.fields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        {field.label}
                                        {field.defaultValue && <span className="text-gray-600 font-normal ml-1">(e.g. {field.defaultValue})</span>}
                                        {field.required && <span className="text-red-400 ml-1">*</span>}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            className="w-full bg-[#0f111a] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors h-24 font-mono text-xs"
                                            value={formData.destination_creds?.[field.key] || ''}
                                            onChange={(e) => updateCreds(field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                        />
                                    ) : (
                                        <Input
                                            type={field.type}
                                            value={formData.destination_creds?.[field.key] || ''}
                                            onChange={(e) => updateCreds(field.key, field.type === 'number' ? parseInt(e.target.value) : e.target.value)}
                                            placeholder={field.placeholder}
                                        />
                                    )}
                                    {field.description && (
                                        <p className="text-[10px] text-gray-600 mt-1">{field.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <Button
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className={`w-full ${testStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    {testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Connection Verified' : 'Test Connection'}
                </Button>
                {testMessage && (
                    <div className={`text-xs p-2 rounded ${testStatus === 'success' ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                        {testMessage}
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={testStatus !== 'success' || loading}
                    title={testStatus !== 'success' ? "Please verify connection first" : ""}
                >
                    {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Destination'}
                </Button>
            </div>
        </div>
    );
};
