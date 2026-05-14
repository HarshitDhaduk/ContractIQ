"""Shared helpers used across all worker stages."""
import json
import os
from google import genai
from google.genai import types
from config import settings

os.environ["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY


def gemini_client() -> genai.Client:
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def parse_json_response(text: str) -> dict | list:
    """Strip markdown fences and parse JSON from Gemini responses."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)
