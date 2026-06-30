# AI-Powered Chat Workspace

[![Python](https://img.shields.io/badge/Python-3.12%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.124%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15%2B-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.15%2B-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.0%2B-8A2BE2)](https://github.com/langchain-ai/langgraph)

A premium, full-stack AI-powered chat application that combines a clean, responsive conversational interface with agent workflows and real-time audit tools. Built with a modern **Next.js** frontend, a scalable **FastAPI** backend, and a robust **LangGraph** orchestration layer backed by **MongoDB**.

## Key Features

- **Dynamic Chat Workspace**: Clean, interactive messaging console supporting session history, real-time message streaming, and multiple AI models.
- **State-Driven AI Workflows**: Engineered using LangGraph to manage complex state transitions, validating data flows and tool invocations dynamically.
- **Workspace Control Center**: A dual-purpose dashboard featuring:
  - **Token Analytics**: Detailed token consumption metrics (prompt, completion, total), model breakdowns, and pagination-supported API logs.
  - **Account Preferences**: A responsive 2-column layout to update profile details, adjust passwords with visibility toggles, and manage self-deletion workflows.
- **Robust Authentication**: Secure registration and login flows implementing state-of-the-art JWT credential tokens and password hashing.
- **Dynamic Database Layer**: MongoDB engine using async drivers (motor) with automated index creation for launching the application cleanly.

---

## 🚀 Quick Start

### Prerequisites

Make sure you have the following installed on your local machine:
- **Node.js** (v18.x or newer)
- **Python** (v3.12 or newer)
- **MongoDB** (Running locally on `mongodb://localhost:27017` or a cloud-hosted URI)

### 1. Environment Setup

Configure environment variables for both the backend and frontend.

#### Backend
Navigate to the `backend` directory and set up the env file:
```bash
cd backend
cp .env.example .env
```
Open the `.env` file and populate it with your keys:
```env
MONGO_URL=mongodb://localhost:27017/
DB_NAME=ai_powered_web_app
GOOGLE_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_jwt_secret_token
```

#### Frontend
Navigate to the `frontend` directory and set up the env file:
```bash
cd ../frontend
cp .env.example .env
```
Open the `.env` file and configure the API URL:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### 2. Backend Startup

Set up a virtual environment and run the FastAPI server:

```bash
cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
python main.py
```
*Note: If you have `uv` installed, you can simply run `uv run python main.py`.*

The backend server will start at **`http://localhost:8000`**.

---

### 3. Frontend Startup

Install dependencies and start the Next.js development server:

```bash
cd ../frontend
npm install
npm run dev
```

The frontend application will start at **`http://localhost:3000`**.

---

## 🏃‍♂️ Usage

1. Open your browser and navigate to **`http://localhost:3000`**.
2. Create an account via the **Sign Up** tab.
3. Start talking to the AI! You can create new conversations, switch between active chats, and choose your preferred model from the models dropdown.
4. Click on your profile block in the bottom-left corner of the sidebar to access the **Workspace Control Center** to monitor token usage and manage your profile settings.
5. Interactive API documentation is available at **`http://localhost:8000/docs`**.

---

## 📚 Documentation

For deeper details regarding the project's internal structure and APIs, refer to the files in the directory:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
