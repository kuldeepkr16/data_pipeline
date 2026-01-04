export interface ConnectorField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'textarea';
    placeholder?: string;
    description?: string;
    required?: boolean;
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
            { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
            { key: 'port', label: 'Port', type: 'number', placeholder: '5432', required: true },
            { key: 'dbname', label: 'Database Name', type: 'text', placeholder: 'postgres', required: true },
            { key: 'user', label: 'User', type: 'text', placeholder: 'postgres', required: true },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }
        ]
    },
    {
        id: 'mysql',
        name: 'MySQL',
        fields: [
            { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
            { key: 'port', label: 'Port', type: 'number', placeholder: '3306', required: true },
            { key: 'dbname', label: 'Database Name', type: 'text', placeholder: 'mysql', required: true },
            { key: 'user', label: 'User', type: 'text', placeholder: 'root', required: true },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }
        ]
    },
    {
        id: 'mongodb',
        name: 'MongoDB',
        fields: [
            { key: 'connection_string', label: 'Connection String (URI)', type: 'password', placeholder: 'mongodb://user:pass@host:27017/db', required: true },
            { key: 'dbname', label: 'Database Name', type: 'text', placeholder: 'my_db', required: true }
        ]
    },
    {
        id: 'dynamodb',
        name: 'DynamoDB',
        fields: [
            { key: 'region_name', label: 'AWS Region', type: 'text', placeholder: 'us-east-1', required: true },
            { key: 'aws_access_key_id', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...', required: true },
            { key: 'aws_secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: '••••••••', required: true }
        ]
    },
    {
        id: 'salesforce',
        name: 'Salesforce',
        fields: [
            { key: 'username', label: 'Username', type: 'text', placeholder: 'user@example.com', required: true },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true },
            { key: 'security_token', label: 'Security Token', type: 'password', placeholder: 'Token from Salesforce', required: true }
        ]
    },
    {
        id: 'googlesheets',
        name: 'Google Sheets',
        fields: [
            { key: 'spreadsheet_id', label: 'Spreadsheet ID', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', required: true },
            { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', placeholder: '{ "type": "service_account", ... }', required: true }
        ]
    },
    {
        id: 's3',
        name: 'S3 / Files',
        fields: [
            { key: 'bucket_name', label: 'Bucket Name', type: 'text', placeholder: 'my-data-bucket', required: true },
            { key: 'region_name', label: 'AWS Region', type: 'text', placeholder: 'us-east-1', required: true },
            { key: 'aws_access_key_id', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...', required: true },
            { key: 'aws_secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: '••••••••', required: true },
            { key: 'prefix', label: 'Prefix (Optional)', type: 'text', placeholder: 'data/', required: false }
        ]
    },
    {
        id: 'api',
        name: 'REST API',
        fields: [
            { key: 'url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com/v1', required: true },
            { key: 'method', label: 'Method', type: 'text', placeholder: 'GET', required: true },
            { key: 'auth_header', label: 'Authorization Header', type: 'password', placeholder: 'Bearer <token>', required: false }
        ]
    },
    {
        id: 'webhook',
        name: 'Webhooks',
        fields: [
            { key: 'secret', label: 'Webhook Secret (Optional)', type: 'password', placeholder: 'whsec_...', required: false }
        ]
    }
];

export const getConnectorDefinition = (id: string): ConnectorDefinition | undefined => {
    return CONNECTOR_TYPES.find(c => c.id === id);
};
