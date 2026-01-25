"""Mapping Suggester - Generates field mapping suggestions"""
from typing import List, Dict, Any, Optional
from .similarity import SchemaMatcher


class MappingSuggester:
    """Generate field mapping suggestions between source and target schemas"""
    
    def __init__(self, confidence_threshold: float = 0.5):
        self.confidence_threshold = confidence_threshold
        self.matcher = SchemaMatcher()
    
    def suggest_mappings(
        self,
        source_fields: List[Dict[str, Any]],
        target_fields: List[Dict[str, Any]],
        auto_map_threshold: float = 0.8
    ) -> Dict[str, Any]:
        """
        Generate mapping suggestions between source and target fields.
        
        Returns:
            {
                "suggestions": [...],
                "auto_mapped": [...],
                "unmapped_source": [...],
                "unmapped_target": [...],
                "stats": {...}
            }
        """
        suggestions = []
        auto_mapped = []
        mapped_targets = set()
        
        for source_field in source_fields:
            matches = []
            
            for target_field in target_fields:
                if target_field['name'] in mapped_targets:
                    continue
                    
                similarity = self.matcher.calculate_similarity(source_field, target_field)
                
                if similarity >= self.confidence_threshold:
                    transform = self.matcher.suggest_transform(
                        source_field.get('type', 'char'),
                        target_field.get('type', 'varchar')
                    )
                    
                    matches.append({
                        "target_field": target_field['name'],
                        "target_type": target_field.get('type', 'unknown'),
                        "confidence": round(similarity, 3),
                        "suggested_transform": transform,
                        "type_compatible": self.matcher.type_compatibility(
                            source_field.get('type', ''),
                            target_field.get('type', '')
                        )
                    })
            
            # Sort matches by confidence
            matches.sort(key=lambda x: x['confidence'], reverse=True)
            
            suggestion = {
                "source_field": source_field['name'],
                "source_type": source_field.get('type', 'unknown'),
                "matches": matches[:5],  # Top 5 matches
                "best_match": matches[0] if matches else None,
                "status": "mapped" if matches else "unmapped"
            }
            
            suggestions.append(suggestion)
            
            # Auto-map high confidence matches
            if matches and matches[0]['confidence'] >= auto_map_threshold:
                auto_mapped.append({
                    "source_field": source_field['name'],
                    "target_field": matches[0]['target_field'],
                    "transform": matches[0]['suggested_transform'],
                    "confidence": matches[0]['confidence']
                })
                mapped_targets.add(matches[0]['target_field'])
        
        # Find unmapped fields
        mapped_sources = {s['source_field'] for s in auto_mapped}
        unmapped_source = [
            f['name'] for f in source_fields 
            if f['name'] not in mapped_sources
        ]
        unmapped_target = [
            f['name'] for f in target_fields 
            if f['name'] not in mapped_targets
        ]
        
        # Calculate stats
        total_source = len(source_fields)
        total_target = len(target_fields)
        auto_mapped_count = len(auto_mapped)
        
        return {
            "suggestions": suggestions,
            "auto_mapped": auto_mapped,
            "unmapped_source": unmapped_source,
            "unmapped_target": unmapped_target,
            "stats": {
                "total_source_fields": total_source,
                "total_target_fields": total_target,
                "auto_mapped_count": auto_mapped_count,
                "auto_map_percentage": round(auto_mapped_count / total_source * 100, 1) if total_source > 0 else 0,
                "unmapped_source_count": len(unmapped_source),
                "unmapped_target_count": len(unmapped_target)
            }
        }
    
    def generate_mapping_config(
        self,
        suggestions: Dict[str, Any],
        include_unmapped: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Generate a mapping configuration from suggestions.
        Uses auto-mapped fields and optionally includes unmapped fields with null targets.
        """
        mapping_config = []
        
        # Add auto-mapped fields
        for mapping in suggestions.get('auto_mapped', []):
            mapping_config.append({
                "source_field": mapping['source_field'],
                "target_field": mapping['target_field'],
                "transform": mapping['transform'],
                "confidence": mapping['confidence'],
                "auto_mapped": True
            })
        
        # Optionally add unmapped fields
        if include_unmapped:
            for field_name in suggestions.get('unmapped_source', []):
                # Find the suggestion for this field
                for suggestion in suggestions.get('suggestions', []):
                    if suggestion['source_field'] == field_name:
                        best = suggestion.get('best_match')
                        mapping_config.append({
                            "source_field": field_name,
                            "target_field": best['target_field'] if best else None,
                            "transform": best['suggested_transform'] if best else 'direct',
                            "confidence": best['confidence'] if best else 0,
                            "auto_mapped": False
                        })
                        break
        
        return mapping_config
