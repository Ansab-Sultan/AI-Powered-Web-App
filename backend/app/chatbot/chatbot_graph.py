from typing import TypedDict, Annotated, Sequence, Optional
from langgraph.graph import StateGraph, END
from langgraph.runtime import Runtime
from langchain_core.messages import BaseMessage, HumanMessage
import operator

from app.chatbot.chatbot_tools import (
    UserContext,
    retrieve_chat_history,
    save_chat_messages,
    update_chat_metadata,
)
from app.core.llm_config import get_llm
from app.core.logger import get_logger

logger = get_logger(__name__)


class GraphState(TypedDict):
    """State definition for the chatbot graph workflow."""

    messages: Annotated[Sequence[BaseMessage], operator.add]
    user_input: Optional[str]
    chat_id: Optional[str]
    usage_metadata: Optional[dict]
    model_name: Optional[str]


async def retrieve_history_node(
    state: GraphState,
    runtime: Runtime[UserContext],
) -> GraphState:
    """
    Retrieve chat history from MongoDB.

    Extracts user_id from runtime context and calls the retrieve_chat_history tool
    to fetch existing messages for the chat session.

    Args:
        state: Current graph state containing chat_id
        runtime: Runtime context containing user information

    Returns:
        Updated state with retrieved messages and preserved metadata
    """
    chat_id = state.get("chat_id")
    user_id = runtime.context.user_id

    result = await retrieve_chat_history.ainvoke(
        {
            "user_id": user_id,
            "chat_id": chat_id,
        }
    )

    return {
        "messages": result.get("messages", []),
        "chat_id": result.get("chat_id"),
        "user_input": state.get("user_input"),
        "model_name": state.get("model_name"),
        "usage_metadata": state.get("usage_metadata"),
    }


async def call_llm_node(state: GraphState, runtime: Runtime[UserContext]) -> GraphState:
    """
    Process user input with the configured LLM.

    Creates a HumanMessage from user input, appends it to conversation history,
    invokes the LLM, and extracts usage metadata from the response.

    Args:
        state: Current graph state with messages and user input
        runtime: Runtime context (unused in this node)

    Returns:
        Updated state with new messages, usage metadata, and model name
    """
    from app.core.llm_config import get_default_model

    messages = state.get("messages", [])
    user_input = state.get("user_input")
    model_name = state.get("model_name") or get_default_model()

    current_message = HumanMessage(content=user_input)
    messages_with_input = list(messages) + [current_message]

    llm_config = get_llm(model_name=model_name)
    response = await llm_config.ainvoke(messages_with_input)

    # Extract usage_metadata - consistent across OpenAI and Google models
    usage_metadata = dict(response.usage_metadata) if response.usage_metadata else {}

    return {
        "messages": [current_message, response],
        "user_input": user_input,
        "chat_id": state.get("chat_id"),
        "usage_metadata": usage_metadata,
        "model_name": model_name,
    }


async def save_history_node(
    state: GraphState,
    runtime: Runtime[UserContext],
) -> GraphState:
    """
    Save the conversation turn to MongoDB.

    Extracts the last two messages (user and assistant) and saves them to the
    database along with usage metadata for token tracking.

    Args:
        state: Current graph state with messages and metadata
        runtime: Runtime context containing user information

    Returns:
        Updated state with cleared messages and preserved metadata
    """
    messages = state.get("messages", [])
    chat_id = state.get("chat_id")
    usage_metadata = state.get("usage_metadata")
    model_name = state.get("model_name")
    user_id = runtime.context.user_id

    if not chat_id:
        logger.warning("Warning: No chat_id in state, cannot save.")
        return {
            "user_input": state.get("user_input"),
            "chat_id": state.get("chat_id"),
            "messages": [],
            "usage_metadata": usage_metadata,
            "model_name": model_name,
        }

    if len(messages) >= 2:
        from app.core.database import extract_message_text

        user_message = extract_message_text(messages[-2].content)
        assistant_message = extract_message_text(messages[-1].content)

        result = await save_chat_messages.ainvoke(
            {
                "user_id": user_id,
                "chat_id": chat_id,
                "user_message": user_message,
                "assistant_message": assistant_message,
                "usage_metadata": usage_metadata,
                "model_name": model_name,
            }
        )

        logger.info(result)

        # Update chat metadata
        message_count = len(messages)

        # Generate title for new chats (first message pair)
        title = None
        if message_count <= 2:
            input_words = state.get("user_input", "").split()
            title = " ".join(input_words[:5])
            if len(input_words) > 5:
                title += "..."

        await update_chat_metadata.ainvoke(
            {
                "user_id": user_id,
                "chat_id": chat_id,
                "message_count": message_count,
                "usage_metadata": usage_metadata,
                "title": title,
                "model_name": model_name,
            }
        )

    return {
        "user_input": state.get("user_input"),
        "chat_id": state.get("chat_id"),
        "messages": [],
        "usage_metadata": usage_metadata,
        "model_name": model_name,
    }


def create_chatbot_graph():
    """
    Create and compile the LangGraph chatbot workflow.

    Builds a state graph with three nodes: retrieve_history, call_llm, and save_history.
    The workflow retrieves chat history, processes user input with an LLM, and saves
    the conversation turn to MongoDB.

    Returns:
        Compiled LangGraph workflow ready for execution
    """
    workflow = StateGraph(GraphState, context_schema=UserContext)

    workflow.add_node("retrieve_history", retrieve_history_node)
    workflow.add_node("call_llm", call_llm_node)
    workflow.add_node("save_history", save_history_node)

    workflow.set_entry_point("retrieve_history")
    workflow.add_edge("retrieve_history", "call_llm")
    workflow.add_edge("call_llm", "save_history")
    workflow.add_edge("save_history", END)

    graph = workflow.compile()
    return graph
