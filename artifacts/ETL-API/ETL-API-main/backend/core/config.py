import os
from typing import Optional

class Settings:
    # MongoDB Canonical (READ ONLY)
    CANONICAL_MONGO_URL: str = os.getenv("CANONICAL_MONGO_URL", "mongodb://localhost:27017")
    CANONICAL_DB_NAME: str = os.getenv("CANONICAL_DB_NAME", "platform1_canonical")
    CANONICAL_LAYOUT: str = os.getenv("CANONICAL_LAYOUT", "single_collection")
    CANONICAL_COLLECTION: str = os.getenv("CANONICAL_COLLECTION", "data_lake_canonical")
    CANONICAL_ENTITY_COLLECTION_PREFIX: str = os.getenv("CANONICAL_ENTITY_COLLECTION_PREFIX", "silver_")
    
    # MongoDB App (READ/WRITE)
    APP_MONGO_URL: str = os.getenv("APP_MONGO_URL", "mongodb://localhost:27017")
    APP_DB_NAME: str = os.getenv("APP_DB_NAME", "platform2_app")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TTL: int = int(os.getenv("JWT_ACCESS_TTL", "3600"))
    JWT_REFRESH_TTL: int = int(os.getenv("JWT_REFRESH_TTL", "604800"))
    
    # Scheduler
    SCHEDULER_ENABLED: bool = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    SCHEDULER_CRON: str = os.getenv("SCHEDULER_CRON", "0 */6 * * *")
    
    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

settings = Settings()
