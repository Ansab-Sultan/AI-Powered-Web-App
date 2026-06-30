# LangGraph ChatBot Template

This is a comprehensive template for building AI-powered chatbots using **FastAPI**, **LangGraph**, and **MongoDB**. It provides a solid foundation with built-in features for authentication, chat history management, token usage tracking, and a scalable graph-based workflow.

## 📂 Project Structure

- **`app/`**: Contains the core application logic.
    - **`routers/`**: Defines the API endpoints.
        - `auth_router.py`: Handles user authentication (registration, login).
        - `chat_router.py`: Manages chat sessions and interactions.
        - `user_management_router.py`: Handles user profile and management operations.
        - `token_usage_router.py`: Tracks and reports LLM token usage.
    - **`chatbot/`**: Contains the chatbot logic.
        - `tools.py`: Defines the tools available to the chatbot (e.g., history retrieval, saving messages).
        - `chatbot_graph.py`: Defines the LangGraph workflow (nodes and edges).
- **`main.py`**: The entry point of the application. It initializes the FastAPI app, sets up middleware (CORS), includes routers, and handles database connection lifecycles.
- **`create_indexes.py`**: A utility script to create necessary MongoDB indexes for performance optimization. These are also automatically created on application startup.

## 🚀 Setup & Configuration

### Environment Variables
You need to configure your environment variables for the application to run correctly. Create a `.env` file in the root directory and add the following:

```env
# Application Configuration
APP_NAME=YourAppName

# Database Configuration
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=YourDatabaseName

# Add other necessary keys (e.g., OpenAI API Key, JWT Secret)
OPENAI_API_KEY=sk-...
SECRET_KEY=...
```

**Note:** It is crucial to define the **APP Name** and **DATABASE Name** in your `.env` file for the application to function properly.


## 🏃‍♂️ Usage

### Running the Application
You can start the server using Uvicorn:

```bash
python main.py
```
Or directly via the command line:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

### API Documentation
Once the server is running, you can access the interactive API documentation (Swagger UI) at:
- **http://localhost:8000/docs**

## 🛠️ Customization Guide

This template is designed to be easily extensible.

### Adding New Tools
To add new capabilities to your chatbot:
1.  Open **`app/chatbot/tools.py`**.
2.  Define your new tool using the `@tool` decorator from LangChain.
3.  Implement the tool's logic.
4.  **Important:** Ensure your tool's docstring follows the format used in `app/chatbot/tools.py`, including `Args` and `Returns` sections. This helps the LLM understand how to use the tool correctly.

Example:
```python
@tool
async def my_custom_tool(param: str):
    """Description of what the tool does."""
    # Your logic here
    return "Result"
```

### Adjusting the Workflow
To modify how the chatbot processes messages:
1.  Open **`app/chatbot/chatbot_graph.py`**.
2.  Import your new tools.
3.  Update the `create_chatbot_graph` function to include new nodes or modify existing edges.
4.  You can add conditional logic or new steps to the `StateGraph`.

## 📡 API Routers Overview

- **`auth_router`**: Provides endpoints for user signup and login, issuing JWT tokens.
- **`chat_router`**: The main interface for sending messages to the chatbot and retrieving chat history.
- **`user_management_router`**: Allows users to manage their account details.
- **`token_usage_router`**: Provides insights into token consumption, helpful for monitoring costs and usage patterns.
