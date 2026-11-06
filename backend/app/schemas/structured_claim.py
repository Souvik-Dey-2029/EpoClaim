"""General-purpose structured claim representations.

Defines the schema for structured factual propositions independent of domain,
organization, or fixed role lists.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class StructuredClaim(BaseModel):
    """A general-purpose structured factual proposition."""
    subject: str = Field(..., description="Primary entity or topic being asserted")
    predicate: str = Field(..., description="Action, property, relation, or attribute asserted")
    object: str = Field(default="", description="Target entity, assigned value, or outcome")
    qualifiers: Dict[str, Any] = Field(default_factory=dict, description="Contextual modifiers, e.g. role, location, scope")
    context_entities: List[str] = Field(default_factory=list, description="Surrounding contextual organizations, places, or entities")
    polarity: str = Field(default="positive", description="'positive' or 'negative'")
    valid_time_start: Optional[datetime] = Field(default=None, description="Start timestamp of validity if known")
    valid_time_end: Optional[datetime] = Field(default=None, description="End timestamp of validity if known")
    event_date: Optional[datetime] = Field(default=None, description="Event or observation date mentioned")
    publication_date: Optional[datetime] = Field(default=None, description="Independent source publication date")
    extraction_confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction confidence score")
    source_reference: Optional[str] = Field(default=None, description="Original text excerpt or claim ID")

