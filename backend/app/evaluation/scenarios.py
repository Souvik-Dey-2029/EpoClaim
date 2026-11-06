"""Evaluation benchmark scenario generator.

Creates parameterized test scenarios representing evolving, time-sensitive facts
and historical invariants to test stale-claim detection.
"""
from __future__ import annotations

import uuid
from typing import List
from app.schemas.evaluation import EvaluationScenario


def get_default_benchmark_scenarios() -> List[EvaluationScenario]:
    """Return a curated set of temporal evaluation scenarios across domains."""
    return [
        EvaluationScenario(
            scenario_id="scen_01_leadership",
            entity="OpenAI",
            attribute="CEO",
            old_value="Mira Murati",
            new_value="Sam Altman",
            change_date="2023-11-29T00:00:00Z",
            query="Who is the CEO of OpenAI?",
            original_claim="Mira Murati is the CEO of OpenAI.",
            updated_claim="Sam Altman is the CEO of OpenAI.",
            expected_stale_verdict="OUTDATED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Interim leadership announcement (Nov 17, 2023)",
                    "content": "OpenAI announced Mira Murati was appointed interim CEO following board actions.",
                    "published_date": "2023-11-17T12:00:00Z",
                },
                {
                    "title": "Reinstatement of CEO (Nov 29, 2023)",
                    "content": "Sam Altman has returned as CEO of OpenAI with a newly reconstituted board.",
                    "published_date": "2023-11-29T18:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_02_software_version",
            entity="Python",
            attribute="latest stable release",
            old_value="3.11",
            new_value="3.12",
            change_date="2023-10-02T00:00:00Z",
            query="What is the latest stable release of Python?",
            original_claim="Python 3.11 is the latest stable release of Python.",
            updated_claim="Python 3.12 is the latest stable release of Python.",
            expected_stale_verdict="OUTDATED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Python 3.11 Release Announcement",
                    "content": "Python 3.11 is released as the newest stable version with major performance gains.",
                    "published_date": "2022-10-24T00:00:00Z",
                },
                {
                    "title": "Python 3.12 Final Release",
                    "content": "Python 3.12 is officially released and is now the latest stable version.",
                    "published_date": "2023-10-02T00:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_03_sports_champion",
            entity="FIFA World Cup Men's Champion",
            attribute="title holder",
            old_value="France",
            new_value="Argentina",
            change_date="2022-12-18T00:00:00Z",
            query="Who is the reigning men's FIFA World Cup champion?",
            original_claim="France is the reigning FIFA World Cup champion.",
            updated_claim="Argentina is the reigning FIFA World Cup champion.",
            expected_stale_verdict="OUTDATED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "France lifts 2018 trophy",
                    "content": "France won the 2018 World Cup defeating Croatia in Moscow.",
                    "published_date": "2018-07-15T00:00:00Z",
                },
                {
                    "title": "Argentina wins 2022 World Cup",
                    "content": "Argentina defeated France in the 2022 final in Qatar to become champions.",
                    "published_date": "2022-12-18T20:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_04_historical_invariant",
            entity="Apollo 11",
            attribute="moon landing date",
            old_value="July 20, 1969",
            new_value="July 20, 1969",
            change_date="1969-07-20T20:17:00Z",
            query="When did Apollo 11 land on the moon?",
            original_claim="Apollo 11 landed on the moon on July 20, 1969.",
            updated_claim="Apollo 11 landed on the moon on July 20, 1969.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Apollo 11 Mission Overview",
                    "content": "On July 20, 1969, American astronauts Neil Armstrong and Buzz Aldrin landed the Apollo Lunar Module Eagle on the Moon.",
                    "published_date": "2000-01-01T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_05_pure_falsehood",
            entity="Albert Einstein",
            attribute="won Nobel Prize in Chemistry",
            old_value="in 1921",
            new_value="in Physics, never Chemistry",
            change_date="1921-11-09T00:00:00Z",
            query="Did Albert Einstein win the Nobel Prize in Chemistry?",
            original_claim="Albert Einstein won the Nobel Prize in Chemistry in 1921.",
            updated_claim="Albert Einstein won the Nobel Prize in Physics for his explanation of the photoelectric effect.",
            expected_stale_verdict="CONTRADICTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "The Nobel Prize in Physics 1921",
                    "content": "The Nobel Prize in Physics 1921 was awarded to Albert Einstein for his services to Theoretical Physics.",
                    "published_date": "2020-05-01T00:00:00Z",
                }
            ],
        ),
    ]

