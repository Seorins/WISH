"""
대화 임베딩 API 엔드포인트.

BE(Spring Boot)가 세션 종료 시 호출하여 대화 데이터를 임베딩한다.
임베딩 실패 시에도 200을 반환하여 BE 흐름을 막지 않는다 (fire-and-forget 정책).
"""
import logging

from fastapi import APIRouter

from app.schemas.dialogue import (
    EmbedSessionRequest,
    EmbedSessionResponse,
    SearchMemoryRequest,
    SearchMemoryResponse,
    MemoryResult,
)
from app.services.dialogue.vector_store import dialogue_vector_store

router = APIRouter(prefix="/dialogue", tags=["Dialogue RAG"])
logger = logging.getLogger(__name__)


@router.post("/embed-session", response_model=EmbedSessionResponse)
async def embed_session(request: EmbedSessionRequest) -> EmbedSessionResponse:
    """
    세션 종료 시 대화 턴들을 임베딩하여 아이별 벡터 DB에 저장.

    BE가 /dialogue/sessions/{id}/finish 처리 후 비동기로 호출한다.
    실패 시에도 success=False로 응답하며 BE 흐름을 막지 않는다.
    """
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
    """
    아이 발화와 유사한 과거 대화 기억 검색.

    785번 RAG API에서 내부적으로 호출하거나,
    직접 테스트용으로 사용한다.
    """
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
