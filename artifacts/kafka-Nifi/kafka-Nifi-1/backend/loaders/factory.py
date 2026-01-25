"""Loader Factory"""
from typing import Dict, Type
from .base import BaseLoader
from .mongodb_loader import MongoDBLoader
from .postgresql_loader import PostgreSQLLoader
from .mysql_loader import MySQLLoader
from .api_loader import APILoader


class LoaderFactory:
    """Factory for creating database loaders"""
    
    _loaders: Dict[str, Type[BaseLoader]] = {
        'mongodb': MongoDBLoader,
        'postgresql': PostgreSQLLoader,
        'mysql': MySQLLoader,
        'api': APILoader,
    }
    
    @classmethod
    def get_loader(cls, target_type: str) -> BaseLoader:
        """Get a loader instance for the given target type"""
        loader_class = cls._loaders.get(target_type.lower())
        if not loader_class:
            raise ValueError(f"Unknown target type: {target_type}. Supported: {list(cls._loaders.keys())}")
        return loader_class()
    
    @classmethod
    def get_supported_types(cls) -> list:
        """Get list of supported target types"""
        return list(cls._loaders.keys())
    
    @classmethod
    def register_loader(cls, target_type: str, loader_class: Type[BaseLoader]) -> None:
        """Register a new loader type"""
        cls._loaders[target_type.lower()] = loader_class
