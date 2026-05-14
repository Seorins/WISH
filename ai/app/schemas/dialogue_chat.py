from typing import List, Optional
from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    patient_profile_id: int
    session_id: int
    user_message: str
    conversation_history: List[ConversationTurn] = Field(default_factory=list)


class ChatResponse(BaseModel):
    npc_message: str
    is_fallback: bool = False
