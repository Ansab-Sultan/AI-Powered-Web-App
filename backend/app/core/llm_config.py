from typing import Union, Dict, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from app.core.config import settings

GOOGLE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.1-pro",
    "gemini-3.1-flash-lite",
]
GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
]


def get_available_models() -> Dict[str, List[str]]:
    """
    Get available models based on configured API keys.
    Only returns models for providers that have API keys configured.

    Returns:
        Dictionary with provider names as keys and lists of available models as values
    """
    available = {}

    if settings.GOOGLE_API_KEY:
        available["google"] = GOOGLE_MODELS

    if settings.GROQ_API_KEY:
        available["groq"] = GROQ_MODELS

    return available


def get_valid_models() -> List[str]:
    """
    Get a flat list of all valid model names based on configured API keys.

    Returns:
        List of valid model names
    """
    valid = []

    if settings.GOOGLE_API_KEY:
        valid.extend(GOOGLE_MODELS)

    if settings.GROQ_API_KEY:
        valid.extend(GROQ_MODELS)

    return valid


def get_default_model() -> str:
    """
    Get the default model based on available API keys.

    Priority order: Google > Groq

    Returns:
        Default model name

    Raises:
        ValueError: If no API keys are configured
    """
    if settings.GOOGLE_API_KEY and GOOGLE_MODELS:
        return GOOGLE_MODELS[0]

    if settings.GROQ_API_KEY and GROQ_MODELS:
        return GROQ_MODELS[0]

    raise ValueError(
        "No LLM API keys configured. Please set at least one API key in settings."
    )


DEFAULT_MODEL = get_default_model()


def get_llm(
    model_name: str = DEFAULT_MODEL, 
    temperature: float = 1.0,
    reasoning_effort: str = "low"
) -> Union[ChatGoogleGenerativeAI, ChatGroq]:
    """
    Factory function that returns the appropriate LangChain chat model instance.

    Args:
        model_name: Name of the model to instantiate
        temperature: Sampling temperature for response generation
        reasoning_effort: Reasoning effort level ('low', 'medium', 'high'). Defaults to 'low'.

    Returns:
        Configured LangChain chat model instance

    Raises:
        ValueError: If model name is invalid or required API key is missing
    """
    valid_models = get_valid_models()
    if model_name not in valid_models:
        available_models = get_available_models()
        raise ValueError(
            f"Invalid model name: '{model_name}'.\n"
            f"Available models: {available_models}"
        )

    if model_name in GOOGLE_MODELS:
        if not settings.GOOGLE_API_KEY:
            raise ValueError("Google API Key is missing in settings.")

        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=settings.GOOGLE_API_KEY,
            model_kwargs={"reasoning_effort": reasoning_effort}
        )

    if model_name in GROQ_MODELS:
        if not settings.GROQ_API_KEY:
            raise ValueError("Groq API Key is missing in settings.")

        return ChatGroq(
            model=model_name,
            temperature=temperature,
            groq_api_key=settings.GROQ_API_KEY
        )

    raise ValueError(f"Model provider for '{model_name}' not implemented.")
