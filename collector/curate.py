"""Claude API curation mode (paid). The default routine mode uses Claude Code instead; see CURATE.md."""

import json

import anthropic

from collector import config, editorial


def curate(candidates: list[dict]) -> dict:
    client = anthropic.Anthropic()
    listing = [{"id": i, **c} for i, c in enumerate(candidates)]

    response = client.beta.messages.create(
        model=config.CLAUDE_MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=editorial.GUIDELINES,
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": editorial.SCHEMA}},
        messages=[{
            "role": "user",
            "content": "Candidates:\n" + json.dumps(listing, ensure_ascii=False),
        }],
    )

    if response.stop_reason == "refusal":
        raise RuntimeError(f"Claude refused: {response.stop_details}")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("Claude output truncated (max_tokens)")

    text = next(b.text for b in response.content if b.type == "text")
    result = json.loads(text)
    errors = editorial.validate(result, len(candidates))
    if errors:
        raise RuntimeError("invalid curation result: " + "; ".join(errors[:5]))
    return editorial.assemble(candidates, result)
