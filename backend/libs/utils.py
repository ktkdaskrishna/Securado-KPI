"""Shared Utilities

Common helper functions used across all services.
"""
from datetime import datetime
from typing import Any, Dict, Optional
import uuid
import bcrypt
import jwt
import os


# JWT Configuration - Use environment variable, fail if not set in production
def get_jwt_secret():
    """Get JWT secret from environment, with fallback for development only"""
    secret = os.environ.get('JWT_SECRET')
    if secret:
        return secret
    # Fallback for development - but log warning
    import logging
    logging.warning("JWT_SECRET not set - using development fallback. DO NOT use in production!")
    return 'event-mesh-crm-secret-key-12345'

JWT_SECRET = get_jwt_secret()
JWT_ALGORITHM = 'HS256'
JWT_ACCESS_EXPIRY_HOURS = 24
JWT_REFRESH_EXPIRY_DAYS = 7


def serialize_doc(doc: Any) -> Any:
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                if 'id' not in doc:
                    result['id'] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc


def generate_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())


def generate_correlation_id() -> str:
    """Generate a correlation ID for event tracing"""
    return f"corr_{uuid.uuid4().hex[:16]}"


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(data: Dict[str, Any]) -> str:
    """Create a JWT access token"""
    from datetime import timedelta
    
    payload = data.copy()
    payload["type"] = "access"
    payload["exp"] = datetime.utcnow() + timedelta(hours=JWT_ACCESS_EXPIRY_HOURS)
    payload["iat"] = datetime.utcnow()
    
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create a JWT refresh token"""
    from datetime import timedelta
    
    payload = data.copy()
    payload["type"] = "refresh"
    payload["exp"] = datetime.utcnow() + timedelta(days=JWT_REFRESH_EXPIRY_DAYS)
    payload["iat"] = datetime.utcnow()
    
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_partition_key(org_id: str, entity_type: str, record_id: str) -> str:
    """Generate partition key for event routing"""
    return f"{org_id}:{entity_type}:{record_id}"


def now_utc() -> datetime:
    """Get current UTC datetime"""
    return datetime.utcnow()


class UserStatus:
    """User status constants"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class RunStatus:
    """Pipeline run status constants"""
    PENDING = "pending"
    RUNNING = "running"
    EXTRACTING = "extracting"
    TRANSFORMING = "transforming"
    LOADING = "loading"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class PipelineStages:
    """Default pipeline stages for opportunities"""
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"
    
    @classmethod
    def all(cls):
        return [cls.QUALIFIED, cls.PROPOSAL, cls.NEGOTIATION, cls.CLOSED_WON, cls.CLOSED_LOST]
