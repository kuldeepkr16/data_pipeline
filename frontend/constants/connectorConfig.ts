export interface ConnectorField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'textarea';
    placeholder?: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
}

export interface ConnectorDefinition {
    id: string;
    name: string;
    fields: ConnectorField[];
}

export const CONNECTOR_TYPES: ConnectorDefinition[] = [
    {
        id: 'postgres',
        name: 'Postgres',
        fields: [
            { key: 'host', label: 'Host', type: 'text', placeholder: '', required: true, defaultValue: 'localhost' },
            { key: 'port', label: 'Port', type: 'number', placeholder: '', required: true, defaultValue: 5432 },
            { key: 'dbname', label: 'Database Name', type: 'text', placeholder: '', required: true, defaultValue: 'postgres' },
            { key: 'user', label: 'User', type: 'text', placeholder: '', required: true, defaultValue: 'postgres' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '', required: true }
        ]
    },
    {
        id: 'mysql',
        name: 'MySQL',
        fields: [
            { key: 'host', label: 'Host', type: 'text', placeholder: '', required: true, defaultValue: 'localhost' },
            { key: 'port', label: 'Port', type: 'number', placeholder: '', required: true, defaultValue: 3306 },
            { key: 'dbname', label: 'Database Name', type: 'text', placeholder: '', required: true, defaultValue: 'mysql' },
            { key: 'user', label: 'User', type: 'text', placeholder: '', required: true, defaultValue: 'root' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '', required: true }
        ]
    },
    {
        id: 'mongodb',
        name: 'MongoDB',
        fields: [
            { key: 'connection_string', label: 'Connection String (URI)', type: 'password', placeholder: '', required: true, defaultValue: 'mongodb://localhost:27017' },
            { key: 'dbname', label: 'Database Name', type: 'text', placeholder: '', required: true, defaultValue: 'test' }
        ]
    },
    {
        id: 'dynamodb',
        name: 'DynamoDB',
        fields: [
            { key: 'region_name', label: 'AWS Region', type: 'text', placeholder: '', required: true, defaultValue: 'us-east-1' },
            { key: 'aws_access_key_id', label: 'Access Key ID', type: 'text', placeholder: '', required: true, defaultValue: 'AKIA...' },
            { key: 'aws_secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: '', required: true }
        ]
    },
    {
        id: 'salesforce',
        name: 'Salesforce',
        fields: [
            { key: 'username', label: 'Username', type: 'text', placeholder: '', required: true, defaultValue: 'user@example.com' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '', required: true },
            { key: 'security_token', label: 'Security Token', type: 'password', placeholder: '', required: true, defaultValue: 'TOKEN123' }
        ]
    },
    {
        id: 'googlesheets',
        name: 'Google Sheets',
        fields: [
            { key: 'spreadsheet_link', label: 'Spreadsheet Link', type: 'text', placeholder: '', required: true, defaultValue: 'https://docs.google.com/spreadsheets/d/...' },
            { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', placeholder: '', required: true, defaultValue: '{ "type": "service_account", ... }' }
        ]
    },
    {
        id: 's3',
        name: 'S3 / Files',
        fields: [
            { key: 'bucket_name', label: 'Bucket Name', type: 'text', placeholder: '', required: true, defaultValue: 'my-data-bucket' },
            { key: 'region_name', label: 'AWS Region', type: 'text', placeholder: '', required: true, defaultValue: 'us-east-1' },
            { key: 'aws_access_key_id', label: 'Access Key ID', type: 'text', placeholder: '', required: true, defaultValue: 'AKIA...' },
            { key: 'aws_secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: '', required: true },
            { key: 'prefix', label: 'Prefix (Optional)', type: 'text', placeholder: '', required: false, defaultValue: 'data/' }
        ]
    },
    {
        id: 'api',
        name: 'REST API',
        fields: [
            { key: 'url', label: 'Base URL', type: 'text', placeholder: '', required: true, defaultValue: 'https://api.example.com/v1' },
            { key: 'method', label: 'Method', type: 'text', placeholder: '', required: true, defaultValue: 'GET' },
            { key: 'auth_header', label: 'Authorization Header', type: 'password', placeholder: '', required: false, defaultValue: 'Bearer <token>' }
        ]
    },
    {
        id: 'webhook',
        name: 'Webhooks',
        fields: [
            { key: 'secret', label: 'Webhook Secret (Optional)', type: 'password', placeholder: '', required: false, defaultValue: 'whsec_...' }
        ]
    }
];

export const getConnectorDefinition = (id: string): ConnectorDefinition | undefined => {
    return CONNECTOR_TYPES.find(c => c.id === id);
};
