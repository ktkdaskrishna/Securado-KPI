"""Schema Similarity Calculator"""
from typing import List, Dict, Any, Tuple
from difflib import SequenceMatcher
import re


class SchemaMatcher:
    """Calculate similarity between schema fields"""
    
    # Common field name synonyms
    SYNONYMS = {
        'id': ['identifier', 'key', 'pk'],
        'name': ['title', 'label', 'fullname', 'full_name'],
        'email': ['email_address', 'mail', 'e_mail', 'email_from'],
        'phone': ['telephone', 'phone_number', 'mobile', 'contact_phone'],
        'amount': ['value', 'total', 'revenue', 'price', 'expected_revenue'],
        'date': ['datetime', 'timestamp', 'time', 'created', 'updated'],
        'created_at': ['create_date', 'created', 'creation_date', 'date_created'],
        'updated_at': ['write_date', 'modified', 'modification_date', 'date_modified'],
        'user': ['owner', 'assignee', 'user_id', 'owner_id'],
        'status': ['state', 'stage', 'stage_id'],
        'description': ['desc', 'notes', 'comment', 'details'],
        'company': ['organization', 'org', 'firm', 'business'],
        'address': ['location', 'addr', 'street'],
        'customer': ['client', 'contact', 'partner'],
        'closed': ['is_closed', 'completed', 'done'],
        'won': ['is_won', 'successful', 'success'],
    }
    
    # Type compatibility mapping
    TYPE_COMPATIBILITY = {
        # Source type -> compatible target types
        'char': ['varchar', 'text', 'string', 'character varying'],
        'text': ['varchar', 'text', 'string', 'character varying', 'longtext'],
        'integer': ['int', 'bigint', 'smallint', 'integer', 'number'],
        'float': ['decimal', 'numeric', 'double', 'real', 'float', 'money'],
        'boolean': ['bool', 'boolean', 'tinyint', 'bit'],
        'date': ['date', 'datetime', 'timestamp', 'timestamptz'],
        'datetime': ['timestamp', 'datetime', 'timestamptz', 'date'],
        'many2one': ['varchar', 'text', 'integer', 'bigint'],  # Odoo relational
        'one2many': ['json', 'jsonb', 'text'],  # Store as JSON
        'many2many': ['json', 'jsonb', 'text'],  # Store as JSON
        'monetary': ['decimal', 'numeric', 'money', 'float'],
        'selection': ['varchar', 'text', 'enum'],
    }
    
    @classmethod
    def normalize_name(cls, name: str) -> str:
        """Normalize field name for comparison"""
        # Remove common prefixes/suffixes
        name = re.sub(r'^(fk_|pk_|idx_|col_)', '', name.lower())
        name = re.sub(r'(_id|_fk|_pk)$', '', name)
        # Remove underscores, hyphens, spaces
        name = re.sub(r'[_\-\s]', '', name)
        return name
    
    @classmethod
    def string_similarity(cls, s1: str, s2: str) -> float:
        """Calculate string similarity using SequenceMatcher"""
        n1 = cls.normalize_name(s1)
        n2 = cls.normalize_name(s2)
        
        # Exact match after normalization
        if n1 == n2:
            return 1.0
        
        # Check if one contains the other
        if n1 in n2 or n2 in n1:
            return 0.9
        
        # Use SequenceMatcher
        return SequenceMatcher(None, n1, n2).ratio()
    
    @classmethod
    def synonym_similarity(cls, s1: str, s2: str) -> float:
        """Check if fields are synonyms"""
        n1 = cls.normalize_name(s1)
        n2 = cls.normalize_name(s2)
        
        for key, synonyms in cls.SYNONYMS.items():
            key_normalized = cls.normalize_name(key)
            synonyms_normalized = [cls.normalize_name(s) for s in synonyms]
            
            all_terms = [key_normalized] + synonyms_normalized
            
            if n1 in all_terms and n2 in all_terms:
                return 0.95
            
            # Partial match with synonyms
            for term in all_terms:
                if (term in n1 and n2 == key_normalized) or (term in n2 and n1 == key_normalized):
                    return 0.85
        
        return 0.0
    
    @classmethod
    def type_compatibility(cls, source_type: str, target_type: str) -> bool:
        """Check if source type can be converted to target type"""
        source_type = source_type.lower().split('(')[0].strip()
        target_type = target_type.lower().split('(')[0].strip()
        
        # Direct match
        if source_type == target_type:
            return True
        
        # Check compatibility map
        compatible_types = cls.TYPE_COMPATIBILITY.get(source_type, [])
        return target_type in compatible_types or source_type in compatible_types
    
    @classmethod
    def calculate_similarity(cls, source_field: Dict, target_field: Dict) -> float:
        """Calculate overall similarity score between two fields"""
        source_name = source_field.get('name', '')
        target_name = target_field.get('name', '')
        source_type = source_field.get('type', '')
        target_type = target_field.get('type', '')
        
        # Calculate name similarity
        string_sim = cls.string_similarity(source_name, target_name)
        synonym_sim = cls.synonym_similarity(source_name, target_name)
        name_similarity = max(string_sim, synonym_sim)
        
        # Check type compatibility
        type_compatible = cls.type_compatibility(source_type, target_type)
        
        # Combine scores
        if not type_compatible:
            # Penalize incompatible types
            return name_similarity * 0.5
        
        return name_similarity
    
    @classmethod
    def suggest_transform(cls, source_type: str, target_type: str) -> str:
        """Suggest transformation function based on types"""
        source_type = source_type.lower()
        target_type = target_type.lower()
        
        if 'many2one' in source_type:
            return 'extract_name'  # Extract display name from Odoo relation
        if 'float' in source_type or 'monetary' in source_type:
            if 'int' in target_type:
                return 'to_int'
            return 'to_float'
        if 'int' in source_type and 'float' in target_type:
            return 'to_float'
        if 'bool' in source_type or 'boolean' in source_type:
            return 'to_bool'
        if 'date' in source_type or 'datetime' in source_type:
            return 'to_datetime'
        
        return 'direct'
