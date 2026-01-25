from datetime import datetime
from typing import Any, Dict
from bson import ObjectId

def serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize MongoDB document for JSON response"""
    if not doc:
        return doc
    
    serialized = {}
    for key, value in doc.items():
        if key == "_id" and isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = serialize_doc(value)
        elif isinstance(value, list):
            serialized[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
        else:
            serialized[key] = value
    
    return serialized
