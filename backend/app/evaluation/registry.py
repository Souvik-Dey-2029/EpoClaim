"""Modular metric registry pattern."""
from __future__ import annotations

from typing import Callable, Dict, List, Optional
from app.schemas.evaluation import MetricResult

MetricFunc = Callable[..., MetricResult]

_METRIC_REGISTRY: Dict[str, MetricFunc] = {}


def register_metric(name: str) -> Callable[[MetricFunc], MetricFunc]:
    """Decorator to register a custom evaluation metric."""
    def decorator(fn: MetricFunc) -> MetricFunc:
        _METRIC_REGISTRY[name] = fn
        return fn
    return decorator


def get_metric(name: str) -> Optional[MetricFunc]:
    return _METRIC_REGISTRY.get(name)


def list_metrics() -> List[str]:
    return list(_METRIC_REGISTRY.keys())

