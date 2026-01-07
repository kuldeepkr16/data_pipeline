import React, { useState, useEffect } from 'react';
import { Config } from '../../../types';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';

interface EditPipelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: Config | null;
    onSave: (config: Config) => void;
}

export const EditPipelineModal: React.FC<EditPipelineModalProps> = ({ isOpen, onClose, config, onSave }) => {
    const [tempConfig, setTempConfig] = useState<Config | null>(null);

    useEffect(() => {
        if (config) {
            setTempConfig(config);
        }
    }, [config]);

    const handleSave = () => {
        if (tempConfig) {
            onSave(tempConfig);
            onClose();
        }
    };

    if (!tempConfig) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Pipeline: ${tempConfig.source_tablename}`}>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Frequency (Minutes)"
                        type="number"
                        value={tempConfig.source_to_dl_schedule}
                        onChange={(e) => setTempConfig({ ...tempConfig, source_to_dl_schedule: Number(e.target.value) })}
                    />

                    <Select
                        label="Loading Strategy"
                        value={tempConfig.source_to_dl_load_type}
                        onChange={(e) => setTempConfig({ ...tempConfig, source_to_dl_load_type: e.target.value })}
                        options={[
                            { value: 'incremental', label: 'Incremental' },
                            { value: 'full', label: 'Full Replace' }
                        ]}
                    />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
