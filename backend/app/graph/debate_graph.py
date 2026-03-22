"""
LangGraph Debate Orchestration
The core debate flow: Orchestrator → Agents (parallel) → Summarizer → Converge/Continue
"""
import json
import logging
import os
import re
from typing import Any, Callable, Optional

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

load_dotenv(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
    override=True,
)

# Agent role definitions (model assignment resolved at runtime from ROLE_* env vars)
_AGENT_DEFS = {
    "investor": {"name": "天使投资人", "env_key": "ROLE_INVESTOR", "default": "gpt", "prompt_file": "investor.txt"},
    "cto": {"name": "技术CTO", "env_key": "ROLE_CTO", "default": "deepseek", "prompt_file": "cto.txt"},
    "user_rep": {"name": "目标用户", "env_key": "ROLE_USER_REP", "default": "glm", "prompt_file": "user_rep.txt"},
    "competitor": {"name": "竞品分析师", "env_key": "ROLE_COMPETITOR", "default": "gemini", "prompt_file": "competitor.txt"},
    "orchestrator": {"name": "主持人", "env_key": "ROLE_ORCHESTRATOR", "default": "claude", "prompt_file": "orchestrator.txt"},
}


def _get_agent_config(agent_key: str) -> dict:
    """Resolve agent config at runtime so ROLE_* env vars are read after dotenv loads."""
    defn = _AGENT_DEFS[agent_key]
    return {
        "name": defn["name"],
        "model": os.getenv(defn["env_key"], defn["default"]),
        "prompt_file": defn["prompt_file"],
    }

# Score dimension mapping to radar chart axes
SCORE_DIMENSIONS = [
    "market_demand",
    "business_model",
    "tech_feasibility",
    "competitive_advantage",
    "user_experience",
    "team_fit",
]


_MODEL_MAP = {
    "gpt": lambda: os.getenv("MODEL_GPT", "gpt-4o"),
    "claude": lambda: os.getenv("MODEL_CLAUDE", "claude-sonnet-4-20250514"),
    "deepseek": lambda: os.getenv("MODEL_DEEPSEEK", "deepseek-chat"),
    "gemini": lambda: os.getenv("MODEL_GEMINI", "gemini-2.0-flash"),
    "glm": lambda: os.getenv("MODEL_GLM", "glm-4-flash"),
}


def _normalize_model_key(model_key: str) -> str:
    """Normalize model aliases from env so matching is deterministic."""
    return model_key.strip().lower()


def resolve_model_name(model_key: str) -> str:
    """Resolve an alias like `gpt` to the actual upstream model name."""
    normalized_key = _normalize_model_key(model_key)
    resolver = _MODEL_MAP.get(normalized_key)
    model_name = resolver() if resolver else model_key
    return model_name.strip() if isinstance(model_name, str) else str(model_name)


def get_agent_runtime_config(agent_key: str) -> dict[str, str]:
    """Return the resolved runtime config for a single agent."""
    defn = _AGENT_DEFS[agent_key]
    model_key = _normalize_model_key(os.getenv(defn["env_key"], defn["default"]))
    return {
        "agent": agent_key,
        "name": defn["name"],
        "model_key": model_key,
        "model_name": resolve_model_name(model_key),
        "prompt_file": defn["prompt_file"],
    }


def get_runtime_agent_configs() -> dict[str, dict[str, str]]:
    """Return the resolved runtime config for every configured agent."""
    return {
        agent_key: get_agent_runtime_config(agent_key)
        for agent_key in _AGENT_DEFS
    }


def _get_llm(model_key: str):
    """Get LLM via OpenAI-compatible endpoint. Resolves model key from env."""
    model_name = resolve_model_name(model_key)
    return ChatOpenAI(
        model=model_name,
        api_key=os.getenv("API_KEY"),
        base_url=os.getenv("API_BASE_URL", "https://api.993939.xyz/v1"),
        streaming=True,
    )


def _load_prompt(prompt_file: str) -> str:
    """Load prompt template from file."""
    prompt_dir = os.path.join(os.path.dirname(__file__), "..", "prompts")
    filepath = os.path.join(prompt_dir, prompt_file)
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def _parse_scores(response_text: str) -> dict[str, float]:
    """Extract scores JSON from agent response."""
    pattern = r"```scores\s*\n(.*?)\n```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse scores JSON from response")
    return {}


def _parse_summary(response_text: str) -> dict:
    """Extract summary JSON from orchestrator response."""
    pattern = r"```summary\s*\n(.*?)\n```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse summary JSON")
    return {}


def _parse_report(response_text: str) -> dict:
    """Extract report JSON from orchestrator response."""
    pattern = r"```report\s*\n(.*?)\n```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse report JSON")
    return {}


async def _invoke_agent(
    agent_key: str,
    idea: str,
    current_round: int,
    context: str,
    scores_context: str = "",
    on_event: Optional[Callable] = None,
) -> dict[str, Any]:
    """Invoke a single agent and return its response with scores."""
    config = _get_agent_config(agent_key)
    runtime_config = get_agent_runtime_config(agent_key)
    llm = _get_llm(runtime_config["model_key"])
    prompt_template = _load_prompt(config["prompt_file"])

    # Fill in prompt template
    prompt = prompt_template.format(
        idea=idea,
        round=current_round,
        context=context,
        scores=scores_context,
    )

    # Stream the response
    full_response = ""
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content="Please begin your analysis now."),
    ]

    if on_event:
        await on_event({
            "type": "agent_start",
            "agent": agent_key,
            "agent_name": config["name"],
            "model_key": runtime_config["model_key"],
            "model_name": runtime_config["model_name"],
            "round": current_round,
        })

    async for chunk in llm.astream(messages):
        token = chunk.content
        full_response += token
        if on_event:
            await on_event({
                "type": "agent_token",
                "agent": agent_key,
                "agent_name": config["name"],
                "token": token,
                "round": current_round,
            })

    # Parse scores from response
    scores = _parse_scores(full_response)

    # Remove the scores block from display text
    display_text = re.sub(r"```scores\s*\n.*?\n```", "", full_response, flags=re.DOTALL).strip()

    if on_event:
        await on_event({
            "type": "agent_complete",
            "agent": agent_key,
            "agent_name": config["name"],
            "model_key": runtime_config["model_key"],
            "model_name": runtime_config["model_name"],
            "content": display_text,
            "scores": scores,
            "round": current_round,
        })

    return {
        "agent": agent_key,
        "agent_name": config["name"],
        "model_key": runtime_config["model_key"],
        "model_name": runtime_config["model_name"],
        "content": display_text,
        "scores": scores,
        "round": current_round,
    }


async def _invoke_orchestrator_summary(
    idea: str,
    current_round: int,
    round_responses: list[dict],
    all_scores: list[dict],
    on_event: Optional[Callable] = None,
) -> dict:
    """Have orchestrator summarize the round."""
    context = "\n\n".join(
        f"【{r['agent_name']}】:\n{r['content']}" for r in round_responses
    )
    scores_str = json.dumps(all_scores, ensure_ascii=False, indent=2)

    config = _get_agent_config("orchestrator")
    runtime_config = get_agent_runtime_config("orchestrator")
    llm = _get_llm(runtime_config["model_key"])
    prompt_template = _load_prompt(config["prompt_file"])

    prompt = prompt_template.format(
        idea=idea,
        round=current_round,
        context=context,
        scores=scores_str,
    )

    # Add instruction for summary vs report
    if current_round == -1:
        # Final report
        prompt += "\n\nThis is the FINAL round. Please produce the final report using the ```report``` format."
    else:
        prompt += "\n\nPlease produce the round summary using the ```summary``` format."

    full_response = ""
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content="Please produce your output now."),
    ]
    async for chunk in llm.astream(messages):
        full_response += chunk.content

    if current_round == -1:
        parsed = _parse_report(full_response)
        if on_event:
            await on_event({
                "type": "final_report",
                "report": parsed,
                "model_key": runtime_config["model_key"],
                "model_name": runtime_config["model_name"],
            })
        return parsed
    else:
        parsed = _parse_summary(full_response)
        if on_event:
            await on_event({
                "type": "round_summary",
                "round": current_round,
                "summary": parsed,
                "model_key": runtime_config["model_key"],
                "model_name": runtime_config["model_name"],
            })
        return parsed


def _aggregate_scores(all_scores: list[dict]) -> dict[str, float]:
    """Aggregate all agent scores into final dimension scores."""
    dim_totals: dict[str, list[float]] = {}
    for score_entry in all_scores:
        for dim, val in score_entry.items():
            if isinstance(val, (int, float)):
                dim_totals.setdefault(dim, []).append(val)

    return {
        dim: round(sum(vals) / len(vals), 1)
        for dim, vals in dim_totals.items()
        if vals
    }


async def run_debate(
    idea: str,
    max_rounds: int = 3,
    on_event: Optional[Callable] = None,
) -> dict[str, Any]:
    """
    Run the complete debate flow.
    Each round: agents speak sequentially, each seeing prior agents' responses (real debate).
    Returns: {transcript, final_scores, report}
    """
    transcript = []
    all_scores = []
    debate_agents = ["investor", "cto", "user_rep", "competitor"]

    for round_num in range(1, max_rounds + 1):
        if on_event:
            await on_event({
                "type": "round_start",
                "round": round_num,
                "max_rounds": max_rounds,
            })

        # Build context from previous rounds
        context = ""
        if transcript:
            recent = [t for t in transcript if t["round"] == round_num - 1]
            context = "\n\n".join(
                f"[Round {t['round']}] {t['agent_name']}: {t['content']}"
                for t in recent
            )

        # Run debate agents SEQUENTIALLY so each agent sees previous agents' responses
        # This creates a real debate: investor speaks → CTO rebuts → user reacts → competitor adds
        round_responses = []
        round_context = context  # Start with previous round context

        for agent in debate_agents:
            resp = await _invoke_agent(
                agent_key=agent,
                idea=idea,
                current_round=round_num,
                context=round_context,
                on_event=on_event,
            )
            round_responses.append(resp)

            # Append this agent's response to context so the NEXT agent can see it
            agent_line = f"[Round {round_num}] {resp['agent_name']}: {resp['content']}"
            round_context = f"{round_context}\n\n{agent_line}" if round_context else agent_line

        # Collect results
        for resp in round_responses:
            transcript.append(resp)
            if resp["scores"]:
                all_scores.append(resp["scores"])

        # Score update broadcast
        if on_event:
            aggregated = _aggregate_scores(all_scores)
            await on_event({
                "type": "score_update",
                "round": round_num,
                "scores": aggregated,
            })

        # Orchestrator summarizes the round
        summary = await _invoke_orchestrator_summary(
            idea=idea,
            current_round=round_num,
            round_responses=round_responses,
            all_scores=all_scores,
            on_event=on_event,
        )

        # Check convergence (simple: if all scores within 15 points of each other)
        if round_num >= 2 and _check_convergence(all_scores):
            logger.info(f"Debate converged at round {round_num}")
            if on_event:
                await on_event({
                    "type": "convergence",
                    "round": round_num,
                    "message": "Agents have reached sufficient consensus.",
                })
            break

    # Generate final report
    final_scores = _aggregate_scores(all_scores)
    report = await _invoke_orchestrator_summary(
        idea=idea,
        current_round=-1,  # Signal for final report
        round_responses=transcript,
        all_scores=all_scores,
        on_event=on_event,
    )

    return {
        "transcript": transcript,
        "final_scores": final_scores,
        "report": report,
    }


def _check_convergence(all_scores: list[dict], threshold: float = 15.0) -> bool:
    """Check if agent scores have converged (variance below threshold)."""
    if len(all_scores) < 4:
        return False

    # Get the last round's scores
    last_scores = all_scores[-4:]
    dims: dict[str, list[float]] = {}
    for s in last_scores:
        for dim, val in s.items():
            if isinstance(val, (int, float)):
                dims.setdefault(dim, []).append(val)

    for dim, vals in dims.items():
        if len(vals) >= 2:
            spread = max(vals) - min(vals)
            if spread > threshold:
                return False
    return True
