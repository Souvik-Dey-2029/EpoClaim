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
        EvaluationScenario(
            scenario_id="scen_06_gpt41_compound_failure",
            entity="OpenAI GPT-4.1",
            attribute="model status and API availability",
            old_value="latest model and available via API",
            new_value="available via API but not confirmed as latest",
            change_date="2026-02-13T00:00:00Z",
            query="Is GPT-4.1 the latest model in the GPT-4 series and available via API?",
            original_claim="OpenAI's GPT-4.1 remains the latest model in the GPT-4 series and is available through the API.",
            updated_claim="OpenAI's GPT-4.1 is available through the API.",
            expected_stale_verdict="PARTIALLY_SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "OpenAI Help Center Release Notes",
                    "content": "GPT-4.1 is available in the API. In the API, there are no changes at this time.",
                    "published_date": "2026-01-29T00:00:00Z",
                },
                {
                    "title": "Introducing GPT-4.1 in the API",
                    "content": "Note that GPT-4.1 will only be available via the API.",
                    "published_date": "2025-04-14T00:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_07_compound_both_supported",
            entity="Neil Armstrong",
            attribute="astronaut status and moon landing",
            old_value="American astronaut and walked on the moon",
            new_value="American astronaut and walked on the moon",
            change_date="1969-07-20T20:17:00Z",
            query="Who was Neil Armstrong?",
            original_claim="Neil Armstrong was an American astronaut and is the first person to walk on the Moon.",
            updated_claim="Neil Armstrong was an American astronaut and walked on the Moon.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "NASA Apollo History",
                    "content": "Neil Armstrong was an American astronaut and is the first person to walk on the Moon.",
                    "published_date": "2021-01-01T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_08_contrastive_deprecation",
            entity="Legacy API vs Modern API",
            attribute="lifecycle state",
            old_value="previous deprecated but replacement supported",
            new_value="previous deprecated but replacement supported",
            change_date="2024-01-01T00:00:00Z",
            query="What is the status of the API versions?",
            original_claim="The legacy v1 API was deprecated, but the replacement v2 API is supported.",
            updated_claim="The legacy v1 API was deprecated, but the replacement v2 API is supported.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "API v1 Deprecation Policy Notice",
                    "content": "The legacy v1 API was officially deprecated and will sunset for all external consumers.",
                    "published_date": "2024-01-15T00:00:00Z",
                },
                {
                    "title": "API v2 Production Support Specification",
                    "content": "Meanwhile, the replacement v2 API is actively supported and recommended for all production workloads.",
                    "published_date": "2024-02-01T00:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_09_negation_availability",
            entity="GPT-4.1",
            attribute="platform availability",
            old_value="not available in ChatGPT but remains available in API",
            new_value="not available in ChatGPT but remains available in API",
            change_date="2026-02-13T00:00:00Z",
            query="Where can I use GPT-4.1?",
            original_claim="The model is not available in ChatGPT but remains available through the API.",
            updated_claim="The model is not available in ChatGPT but remains available through the API.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Model Availability Update",
                    "content": "The model is not available in ChatGPT but remains available through the API.",
                    "published_date": "2026-01-29T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_10_missing_dates_uncertainty",
            entity="Quantum Corp",
            attribute="valuation",
            old_value="50 billion dollars",
            new_value="uncertain",
            change_date="2025-06-01T00:00:00Z",
            query="What is Quantum Corp valued at?",
            original_claim="Quantum Corp is valued at 50 billion dollars.",
            updated_claim="Quantum Corp is valued at 50 billion dollars.",
            expected_stale_verdict="INSUFFICIENT_EVIDENCE",
            expected_fresh_verdict="INSUFFICIENT_EVIDENCE",
            context_docs=[
                {
                    "title": "Blog Speculation",
                    "content": "Some analysts discuss whether Quantum Corp could reach higher valuations.",
                    "published_date": None,
                }
            ],
        ),
        # --- Phase 2B Deterministic Scenarios (scen_11 to scen_18) ---
        EvaluationScenario(
            scenario_id="scen_11_historical_fact_old_source",
            entity="Battle of Hastings",
            attribute="year of occurrence",
            old_value="1066",
            new_value="1066",
            change_date="1066-10-14T00:00:00Z",
            query="In what year did the Battle of Hastings occur?",
            original_claim="The Battle of Hastings was fought in 1066.",
            updated_claim="The Battle of Hastings was fought in 1066.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Medieval History Archives",
                    "content": "The Battle of Hastings was fought on 14 October 1066 between the Norman-French army and the English army.",
                    "published_date": "2005-01-01T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_12_recent_source_describes_old_event",
            entity="Magna Carta",
            attribute="granting year",
            old_value="1215",
            new_value="1215",
            change_date="1215-06-15T00:00:00Z",
            query="When was the Magna Carta granted?",
            original_claim="The Magna Carta was originally issued in 1215.",
            updated_claim="The Magna Carta was originally issued in 1215.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Historical Retrospective (2026 Analysis)",
                    "content": "In a 2026 retrospective on constitutional history, scholars reaffirm that Magna Carta was granted by King John in 1215.",
                    "published_date": "2026-03-01T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_13_point_in_time_inside_interval",
            entity="Barack Obama",
            attribute="US Presidency status in 2012",
            old_value="President of the United States",
            new_value="President of the United States",
            change_date="2012-06-01T00:00:00Z",
            query="Was Barack Obama the President of the United States in 2012?",
            original_claim="Barack Obama was the President of the United States in 2012.",
            updated_claim="Barack Obama was the President of the United States in 2012.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "White House Presidential Archives",
                    "content": "Barack Obama served as the 44th President of the United States from January 20, 2009 to January 20, 2017.",
                    "published_date": "2017-01-20T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_14_point_in_time_outside_interval",
            entity="Barack Obama",
            attribute="US Presidency status in 2024",
            old_value="President of the United States",
            new_value="former President",
            change_date="2024-01-01T00:00:00Z",
            query="Was Barack Obama the President of the United States in 2024?",
            original_claim="Barack Obama was the President of the United States in 2024.",
            updated_claim="Barack Obama concluded his presidency in 2017.",
            expected_stale_verdict="CONTRADICTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "US History Records",
                    "content": "Barack Obama concluded his two terms as President on January 20, 2017 and was succeeded by Donald Trump.",
                    "published_date": "2024-01-01T00:00:00Z",
                }
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_15_syndicated_reprints_inflation",
            entity="Alpha Tech",
            attribute="acquisition price",
            old_value="acquired for 1 billion dollars",
            new_value="acquired for 1 billion dollars",
            change_date="2024-05-01T00:00:00Z",
            query="What was Alpha Tech acquired for?",
            original_claim="Alpha Tech was acquired for 1 billion dollars.",
            updated_claim="Alpha Tech was acquired for 1 billion dollars.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Wire Service Release",
                    "content": "Alpha Tech was acquired for 1 billion dollars in an all-cash transaction.",
                    "source_url": "https://wire.example.com/alpha-tech-deal",
                    "published_date": "2024-05-01T10:00:00Z",
                },
                {
                    "title": "Tech Tribune Syndicated Copy",
                    "content": "Alpha Tech was acquired for 1 billion dollars in an all-cash transaction.",
                    "source_url": "https://tribune.example.com/reprint/alpha-tech-deal?utm_source=rss",
                    "published_date": "2024-05-01T10:05:00Z",
                },
                {
                    "title": "Market Watch Mirror Copy",
                    "content": "Alpha Tech was acquired for 1 billion dollars in an all-cash transaction.",
                    "source_url": "https://market.example.com/syndicated/alpha-tech-deal",
                    "published_date": "2024-05-01T10:15:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_16_independent_sources_agreement",
            entity="Quantum Corp",
            attribute="headquarters location",
            old_value="Zurich",
            new_value="Zurich",
            change_date="2023-01-01T00:00:00Z",
            query="Where is Quantum Corp headquartered?",
            original_claim="Quantum Corp is headquartered in Zurich.",
            updated_claim="Quantum Corp is headquartered in Zurich.",
            expected_stale_verdict="SUPPORTED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Swiss Commercial Registry",
                    "content": "Quantum Corp maintains its official corporate seat and headquarters in Zurich, Switzerland.",
                    "source_url": "https://zefix.ch/entry/quantum-corp",
                    "published_date": "2023-01-01T00:00:00Z",
                },
                {
                    "title": "Financial Times Swiss Tech Profile",
                    "content": "From its headquarters in Zurich, Quantum Corp develops high-precision sensors.",
                    "source_url": "https://ft.example.com/tech/quantum-zurich",
                    "published_date": "2023-06-15T00:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_17_system_as_known_cutoff_protection",
            entity="Nova Dynamics",
            attribute="lead researcher",
            old_value="Dr. Alice Smith",
            new_value="Dr. Bob Jones",
            change_date="2024-06-01T00:00:00Z",
            query="Who is the lead researcher at Nova Dynamics?",
            original_claim="Dr. Alice Smith is the lead researcher at Nova Dynamics.",
            updated_claim="Dr. Bob Jones succeeded Dr. Alice Smith at Nova Dynamics.",
            expected_stale_verdict="OUTDATED",
            expected_fresh_verdict="SUPPORTED",
            context_docs=[
                {
                    "title": "Research Team 2023",
                    "content": "Dr. Alice Smith is the lead researcher heading robotics at Nova Dynamics.",
                    "published_date": "2023-05-01T00:00:00Z",
                },
                {
                    "title": "Research Team 2024 Announcement",
                    "content": "Dr. Bob Jones has been appointed lead researcher, replacing Dr. Alice Smith.",
                    "published_date": "2024-06-01T00:00:00Z",
                },
            ],
        ),
        EvaluationScenario(
            scenario_id="scen_18_uncertain_temporal_bounds_honesty",
            entity="Starlight Energy",
            attribute="commercial fusion reactor deployment",
            old_value="operational in late 2025",
            new_value="uncertain deployment timeline",
            change_date="2025-01-01T00:00:00Z",
            query="When will Starlight Energy deploy its commercial fusion reactor?",
            original_claim="Starlight Energy deployed an operational commercial fusion reactor in late 2025.",
            updated_claim="Starlight Energy announced planned testing without confirmed operational deployment.",
            expected_stale_verdict="INSUFFICIENT_EVIDENCE",
            expected_fresh_verdict="INSUFFICIENT_EVIDENCE",
            context_docs=[
                {
                    "title": "Press Speculation",
                    "content": "Clean energy executives and external analysts discussed speculative hopes for future fusion milestones.",
                    "published_date": None,
                }
            ],
        ),
    ]

