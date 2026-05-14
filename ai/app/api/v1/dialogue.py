import logging

from fastapi import APIRouter

from app.schemas.dialogue import (
    EmbedSessionRequest,
    EmbedSessionResponse,
    SearchMemoryRequest,
    SearchMemoryResponse,
    MemoryResult,
)
from app.schemas.dialogue_chat import ChatRequest, ChatResponse
from app.services.dialogue.vector_store import dialogue_vector_store
from app.services.dialogue.chat_service import generate_response

router = APIRouter(prefix="/dialogue", tags=["Dialogue RAG"])
logger = logging.getLogger(__name__)


@router.post("/embed-session", response_model=EmbedSessionResponse)
async def embed_session(request: EmbedSessionRequest) -> EmbedSessionResponse:
    turns = [t.model_dump() for t in request.turns]
    try:
        dialogue_vector_store.add_session(
            patient_profile_id=request.patient_profile_id,
            session_id=request.session_id,
            npc_name=request.npc_name,
            turns=turns,
        )
        return EmbedSessionResponse(
            success=True,
            session_id=request.session_id,
            embedded_turns=len(turns),
            message="임베딩 완료",
        )
    except Exception as e:
        logger.error("[EmbedSession] 실패 (session_id=%d): %s", request.session_id, e)
        return EmbedSessionResponse(
            success=False,
            session_id=request.session_id,
            embedded_turns=0,
            message=f"임베딩 실패: {str(e)}",
        )


@router.post("/search-memory", response_model=SearchMemoryResponse)
async def search_memory(request: SearchMemoryRequest) -> SearchMemoryResponse:
    results = dialogue_vector_store.search(
        patient_profile_id=request.patient_profile_id,
        query=request.query,
        top_k=request.top_k,
    )
    return SearchMemoryResponse(
        patient_profile_id=request.patient_profile_id,
        results=[
            MemoryResult(
                content=r["content"],
                npc_name=r["npc_name"],
                user_input=r["user_input"],
                npc_response=r.get("npc_response", ""),
                score=r["score"],
            )
            for r in results
        ],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    npc_message, is_fallback = generate_response(
        patient_profile_id=request.patient_profile_id,
        user_message=request.user_message,
        conversation_history=request.conversation_history,
    )
    return ChatResponse(npc_message=npc_message, is_fallback=is_fallback)
