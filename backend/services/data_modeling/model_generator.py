"""Model Generator - Generate graph.json and .mmd from sales_model.yml

This module reads the YAML spec and generates:
1. sales_model.graph.json - For React Flow visual editor
2. sales_model.mmd - Mermaid ER diagram
"""
import os
import json
import yaml
import logging
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Color palette for entities
ENTITY_COLORS = {
    "sales_user": "#3B82F6",
    "sales_team": "#8B5CF6",
    "account": "#10B981",
    "contact": "#06B6D4",
    "opportunity": "#F59E0B",
    "activity": "#EC4899",
    "invoice": "#EF4444",
    "task": "#6366F1",
    "employee": "#84CC16",
}

# Entity icons
ENTITY_ICONS = {
    "sales_user": "user",
    "sales_team": "users",
    "account": "building",
    "contact": "user-circle",
    "opportunity": "target",
    "activity": "calendar",
    "invoice": "file-text",
    "task": "check-square",
    "employee": "briefcase",
}

# Grid positions for entities
ENTITY_POSITIONS = {
    "sales_user": {"x": 100, "y": 100},
    "sales_team": {"x": 100, "y": 300},
    "account": {"x": 400, "y": 100},
    "contact": {"x": 700, "y": 100},
    "opportunity": {"x": 400, "y": 300},
    "activity": {"x": 700, "y": 300},
    "invoice": {"x": 400, "y": 500},
    "task": {"x": 700, "y": 500},
    "employee": {"x": 100, "y": 500},
}


class ModelGenerator:
    """Generate model files from YAML spec"""
    
    def __init__(self, yaml_path: str = None):
        self.yaml_path = yaml_path or self._get_default_yaml_path()
        self.spec = None
    
    def _get_default_yaml_path(self) -> str:
        """Get default path to sales_model.yml"""
        return os.path.join(
            os.path.dirname(__file__),
            "sales_model.yml"
        )
    
    def load_spec(self) -> Dict:
        """Load YAML spec"""
        with open(self.yaml_path, 'r') as f:
            self.spec = yaml.safe_load(f)
        return self.spec
    
    def generate_graph_json(self) -> Dict:
        """Generate React Flow compatible graph JSON"""
        if not self.spec:
            self.load_spec()
        
        entities = []
        for entity_id, entity_def in self.spec.get('entities', {}).items():
            fields = []
            for field_name, field_def in entity_def.get('fields', {}).items():
                field_info = {
                    "name": field_name,
                    "type": field_def.get('type', 'string'),
                    "required": field_def.get('required', False),
                }
                if field_name in ['canonical_id', 'org_id', 'source_system', 'source_record_id']:
                    field_info['pk'] = True
                if field_name.endswith('_id') and field_name not in ['canonical_id', 'org_id', 'source_record_id']:
                    # Guess FK based on naming convention
                    fk_entity = field_name.replace('_id', '')
                    if fk_entity in self.spec.get('entities', {}):
                        field_info['fk'] = fk_entity
                fields.append(field_info)
            
            entities.append({
                "id": entity_id,
                "label": entity_def.get('label', entity_id.replace('_', ' ').title()),
                "description": entity_def.get('description', ''),
                "color": ENTITY_COLORS.get(entity_id, "#6B7280"),
                "icon": ENTITY_ICONS.get(entity_id, "database"),
                "position": ENTITY_POSITIONS.get(entity_id, {"x": 100, "y": 100}),
                "pk": entity_def.get('primary_key', ['canonical_id']),
                "sourceModels": entity_def.get('source_models', []),
                "fields": fields
            })
        
        relationships = []
        for rel in self.spec.get('relationships', []):
            relationships.append({
                "id": rel.get('id'),
                "from": rel.get('from_entity'),
                "to": rel.get('to_entity'),
                "cardinality": rel.get('cardinality', '1:N'),
                "label": rel.get('label', ''),
                "fk": rel.get('join', {}),
                "style": {
                    "stroke": ENTITY_COLORS.get(rel.get('from_entity'), "#6B7280"),
                    "animated": rel.get('cardinality') == '1:1'
                }
            })
        
        return {
            "version": self.spec.get('version', '1.0'),
            "name": self.spec.get('name', 'Data Model'),
            "description": self.spec.get('description', ''),
            "generatedAt": datetime.utcnow().isoformat() + 'Z',
            "entities": entities,
            "relationships": relationships
        }
    
    def generate_mermaid(self) -> str:
        """Generate Mermaid ER diagram"""
        if not self.spec:
            self.load_spec()
        
        lines = ['erDiagram']
        
        # Entity definitions
        for entity_id, entity_def in self.spec.get('entities', {}).items():
            entity_name = entity_id.upper()
            lines.append(f"    {entity_name} {{")
            
            for field_name, field_def in entity_def.get('fields', {}).items():
                field_type = field_def.get('type', 'string')
                suffix = ''
                if field_name == 'canonical_id':
                    suffix = ' PK'
                elif field_name.endswith('_id') and field_name not in ['canonical_id', 'org_id', 'source_record_id']:
                    suffix = ' FK'
                lines.append(f"        {field_type} {field_name}{suffix}")
            
            lines.append("    }")
            lines.append("")
        
        # Relationships
        lines.append("    %% Relationships")
        for rel in self.spec.get('relationships', []):
            from_entity = rel.get('from_entity', '').upper()
            to_entity = rel.get('to_entity', '').upper()
            cardinality = rel.get('cardinality', '1:N')
            label = rel.get('label', '')
            
            # Convert cardinality to Mermaid syntax
            if cardinality == '1:1':
                connector = '||--||'
            elif cardinality == '1:N':
                connector = '||--o{'
            elif cardinality == 'N:1':
                connector = '}o--||'
            else:  # N:M
                connector = '}o--o{'
            
            lines.append(f"    {from_entity} {connector} {to_entity} : \"{label}\"")
        
        return '\n'.join(lines)
    
    def save_outputs(self, output_dir: str = None):
        """Generate and save all output files"""
        if output_dir is None:
            output_dir = os.path.dirname(self.yaml_path)
        
        # Generate graph JSON
        graph_json = self.generate_graph_json()
        graph_path = os.path.join(output_dir, 'sales_model.graph.json')
        with open(graph_path, 'w') as f:
            json.dump(graph_json, f, indent=2)
        logger.info(f"Generated: {graph_path}")
        
        # Generate Mermaid
        mermaid = self.generate_mermaid()
        mermaid_path = os.path.join(output_dir, 'sales_model.mmd')
        with open(mermaid_path, 'w') as f:
            f.write(mermaid)
        logger.info(f"Generated: {mermaid_path}")
        
        return {
            "graph_json": graph_path,
            "mermaid": mermaid_path
        }


# CLI support
if __name__ == "__main__":
    import sys
    
    generator = ModelGenerator()
    
    if len(sys.argv) > 1 and sys.argv[1] == '--generate':
        generator.save_outputs()
        print("Model files generated successfully!")
    else:
        print("Usage: python model_generator.py --generate")
        print("This will regenerate sales_model.graph.json and sales_model.mmd from sales_model.yml")
