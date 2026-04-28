from fastapi import APIRouter

from app.api.v1 import gymnastics, health, taekwondo

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(gymnastics.router)
api_router.include_router(taekwondo.router)