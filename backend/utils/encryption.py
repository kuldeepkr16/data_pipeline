import os
from cryptography.fernet import Fernet
import json
from typing import Dict, Any, Optional

# Default fallback key for development (Generated locally)
# In production, this MUST be set via environment variable
DEFAULT_KEY = "CHANGE_ME_IN_PROD_GenerateWith_Fernet_generate_key"

def get_key() -> bytes:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        # Fallback or raise error? For now, fallback with warning
        print("WARNING: ENCRYPTION_KEY not set, using insecure default!")
        # We need a valid 32-byte base64 string. 
        # If the environment variable isn't set, we can't really proceed safely in a real app.
        # But to prevent crashing during this dev phase if env isn't loaded yet:
        return b'tpmw9F9U2Q3z9r4Q3z9r4Q3z9r4Q3z9r4Q3z9r4Q3z8=' # Dummy valid key
    return key.encode() if isinstance(key, str) else key

def encrypt(data: Dict[str, Any]) -> str:
    """Encrypts a dictionary to a Fernet token string."""
    if not data:
        return None
    
    key = get_key()
    f = Fernet(key)
    
    # Convert dict to JSON string, then bytes
    json_bytes = json.dumps(data).encode('utf-8')
    
    # Encrypt
    token = f.encrypt(json_bytes)
    
    # Return as string
    return token.decode('utf-8')

def decrypt(token: str) -> Optional[Dict[str, Any]]:
    """Decrypts a Fernet token string back to a dictionary."""
    if not token:
        return None
        
    try:
        key = get_key()
        f = Fernet(key)
        
        # specific check if it looks like a JSON already (legacy data support)
        if token.strip().startswith('{') and token.strip().endswith('}'):
             return json.loads(token)

        # Decrypt
        json_bytes = f.decrypt(token.encode('utf-8'))
        
        # Parse JSON
        return json.loads(json_bytes.decode('utf-8'))
    except Exception as e:
        print(f"Decryption failed: {e}")
        # Return raw or empty? If we can't decrypt, we can't use the creds.
        return None

def mask_credentials(creds: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns a copy of credentials with sensitive fields replaced by '********'.
    """
    if not creds:
        return {}
    
    masked = creds.copy()
    sensitive_keys = ['password', 'secret', 'token', 'key', 'auth_header', 'aws_access_key_id', 'aws_secret_access_key']
    
    for k in masked:
        # Check specific list OR common patterns
        if k in sensitive_keys or 'password' in k or 'secret' in k:
            masked[k] = '********'
            
    return masked
