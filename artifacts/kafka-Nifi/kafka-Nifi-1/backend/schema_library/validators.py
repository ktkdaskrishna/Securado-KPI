"""Schema Validation Engine"""
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime
import re
import uuid
from .models import (
    SchemaDefinition, FieldDefinition, DataType,
    ValidationRule, ValidationRuleType
)


class ValidationError:
    """Represents a validation error"""
    def __init__(self, field: str, message: str, value: Any = None, rule: str = None):
        self.field = field
        self.message = message
        self.value = value
        self.rule = rule
    
    def to_dict(self) -> Dict:
        return {
            "field": self.field,
            "message": self.message,
            "value": str(self.value) if self.value is not None else None,
            "rule": self.rule
        }


class ValidationResult:
    """Result of schema validation"""
    def __init__(self, valid: bool, errors: List[ValidationError] = None):
        self.valid = valid
        self.errors = errors or []
    
    def to_dict(self) -> Dict:
        return {
            "valid": self.valid,
            "error_count": len(self.errors),
            "errors": [e.to_dict() for e in self.errors]
        }


class SchemaValidator:
    """Validates data against a schema definition"""
    
    # Email regex pattern
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    # URL regex pattern
    URL_PATTERN = re.compile(r'^https?://[^\s/$.?#].[^\s]*$')
    # Phone pattern (basic)
    PHONE_PATTERN = re.compile(r'^[+]?[0-9\s\-\(\)]{7,20}$')
    # UUID pattern
    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
    
    def __init__(self, schema: SchemaDefinition, strict: bool = True):
        self.schema = schema
        self.strict = strict  # If True, fail on first error
        self.field_map = {f.name: f for f in schema.fields}
    
    def validate(self, data: Dict[str, Any]) -> ValidationResult:
        """
        Validate data against the schema.
        Returns ValidationResult with valid=True if all validations pass.
        """
        errors = []
        
        # Check required fields
        for field in self.schema.fields:
            if field.required and field.name not in data:
                if not field.auto_generate:  # Skip auto-generated fields
                    errors.append(ValidationError(
                        field=field.name,
                        message=f"Required field '{field.display_name or field.name}' is missing",
                        rule="required"
                    ))
                    if self.strict:
                        return ValidationResult(valid=False, errors=errors)
        
        # Validate each field in data
        for field_name, value in data.items():
            field = self.field_map.get(field_name)
            
            if field is None:
                # Unknown field - skip or error based on strict mode
                continue
            
            # Skip null values for non-required fields
            if value is None:
                if field.required and not field.auto_generate:
                    errors.append(ValidationError(
                        field=field_name,
                        message=f"Required field '{field.display_name or field_name}' cannot be null",
                        value=value,
                        rule="required"
                    ))
                continue
            
            # Type validation
            type_error = self._validate_type(field, value)
            if type_error:
                errors.append(type_error)
                if self.strict:
                    return ValidationResult(valid=False, errors=errors)
                continue
            
            # Constraint validation
            constraint_errors = self._validate_constraints(field, value)
            errors.extend(constraint_errors)
            
            if self.strict and constraint_errors:
                return ValidationResult(valid=False, errors=errors)
        
        return ValidationResult(valid=len(errors) == 0, errors=errors)
    
    def _validate_type(self, field: FieldDefinition, value: Any) -> Optional[ValidationError]:
        """Validate field type"""
        data_type = field.data_type
        
        try:
            if data_type == DataType.STRING:
                if not isinstance(value, str):
                    return ValidationError(field.name, f"Expected string, got {type(value).__name__}", value, "type")
            
            elif data_type == DataType.NUMBER or data_type == DataType.CURRENCY:
                if not isinstance(value, (int, float)):
                    # Try to convert
                    try:
                        float(value)
                    except (ValueError, TypeError):
                        return ValidationError(field.name, f"Expected number, got {type(value).__name__}", value, "type")
            
            elif data_type == DataType.INTEGER:
                if not isinstance(value, int) or isinstance(value, bool):
                    return ValidationError(field.name, f"Expected integer, got {type(value).__name__}", value, "type")
            
            elif data_type == DataType.BOOLEAN:
                if not isinstance(value, bool):
                    return ValidationError(field.name, f"Expected boolean, got {type(value).__name__}", value, "type")
            
            elif data_type == DataType.DATETIME:
                if not isinstance(value, (datetime, str)):
                    return ValidationError(field.name, f"Expected datetime, got {type(value).__name__}", value, "type")
                if isinstance(value, str):
                    # Try to parse
                    try:
                        datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        return ValidationError(field.name, f"Invalid datetime format: {value}", value, "type")
            
            elif data_type == DataType.DATE:
                if isinstance(value, str):
                    try:
                        datetime.strptime(value[:10], '%Y-%m-%d')
                    except ValueError:
                        return ValidationError(field.name, f"Invalid date format: {value}", value, "type")
            
            elif data_type == DataType.EMAIL:
                if not isinstance(value, str) or not self.EMAIL_PATTERN.match(value):
                    return ValidationError(field.name, f"Invalid email format: {value}", value, "format")
            
            elif data_type == DataType.URL:
                if not isinstance(value, str) or not self.URL_PATTERN.match(value):
                    return ValidationError(field.name, f"Invalid URL format: {value}", value, "format")
            
            elif data_type == DataType.PHONE:
                if not isinstance(value, str) or not self.PHONE_PATTERN.match(value):
                    return ValidationError(field.name, f"Invalid phone format: {value}", value, "format")
            
            elif data_type == DataType.UUID:
                if not isinstance(value, str) or not self.UUID_PATTERN.match(value):
                    return ValidationError(field.name, f"Invalid UUID format: {value}", value, "format")
            
            elif data_type == DataType.JSON:
                if not isinstance(value, (dict, list)):
                    return ValidationError(field.name, f"Expected JSON object/array, got {type(value).__name__}", value, "type")
            
            elif data_type == DataType.ARRAY:
                if not isinstance(value, list):
                    return ValidationError(field.name, f"Expected array, got {type(value).__name__}", value, "type")
        
        except Exception as e:
            return ValidationError(field.name, f"Type validation error: {str(e)}", value, "type")
        
        return None
    
    def _validate_constraints(self, field: FieldDefinition, value: Any) -> List[ValidationError]:
        """Validate field constraints"""
        errors = []
        
        # Min/Max value
        if field.min_value is not None and isinstance(value, (int, float)):
            if value < field.min_value:
                errors.append(ValidationError(
                    field.name,
                    f"Value {value} is less than minimum {field.min_value}",
                    value, "min_value"
                ))
        
        if field.max_value is not None and isinstance(value, (int, float)):
            if value > field.max_value:
                errors.append(ValidationError(
                    field.name,
                    f"Value {value} exceeds maximum {field.max_value}",
                    value, "max_value"
                ))
        
        # Min/Max length
        if field.min_length is not None and isinstance(value, str):
            if len(value) < field.min_length:
                errors.append(ValidationError(
                    field.name,
                    f"Length {len(value)} is less than minimum {field.min_length}",
                    value, "min_length"
                ))
        
        if field.max_length is not None and isinstance(value, str):
            if len(value) > field.max_length:
                errors.append(ValidationError(
                    field.name,
                    f"Length {len(value)} exceeds maximum {field.max_length}",
                    value, "max_length"
                ))
        
        # Pattern
        if field.pattern and isinstance(value, str):
            if not re.match(field.pattern, value):
                errors.append(ValidationError(
                    field.name,
                    f"Value does not match pattern: {field.pattern}",
                    value, "pattern"
                ))
        
        # Enum values
        if field.enum_values and value not in field.enum_values:
            errors.append(ValidationError(
                field.name,
                f"Value '{value}' not in allowed values: {field.enum_values}",
                value, "enum"
            ))
        
        return errors
    
    def validate_batch(self, records: List[Dict[str, Any]]) -> Tuple[List[Dict], List[Dict]]:
        """
        Validate a batch of records.
        Returns (valid_records, invalid_records_with_errors)
        """
        valid = []
        invalid = []
        
        for i, record in enumerate(records):
            result = self.validate(record)
            if result.valid:
                valid.append(record)
            else:
                invalid.append({
                    "index": i,
                    "record": record,
                    "errors": result.to_dict()["errors"]
                })
        
        return valid, invalid
