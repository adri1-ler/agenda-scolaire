import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


async def get_token(client: AsyncClient, email: str, role: str = "eleve") -> str:
    await client.post("/auth/register", json={
        "nom": "Test", "prenom": "User", "email": email,
        "mot_de_passe": "password123", "role": role
    })
    res = await client.post("/auth/login", json={"email": email, "mot_de_passe": "password123"})
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_create_and_list_schedule():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_token(client, "schedule_test@test.fr")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post("/schedule", json={
            "titre": "Cours de maths",
            "periode_debut": "2026-09-01T09:00:00Z",
            "periode_fin": "2026-09-01T10:00:00Z",
        }, headers=headers)
        assert res.status_code == 201

        res2 = await client.get("/schedule", headers=headers)
        assert res2.status_code == 200
        items = res2.json()
        assert any(i["titre"] == "Cours de maths" for i in items)


@pytest.mark.asyncio
async def test_conflict_detection():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_token(client, "conflict_test@test.fr")
        headers = {"Authorization": f"Bearer {token}"}

        await client.post("/schedule", json={
            "titre": "Événement A",
            "periode_debut": "2026-10-01T10:00:00Z",
            "periode_fin": "2026-10-01T12:00:00Z",
        }, headers=headers)

        await client.post("/schedule", json={
            "titre": "Événement B (conflicting)",
            "periode_debut": "2026-10-01T11:00:00Z",
            "periode_fin": "2026-10-01T13:00:00Z",
        }, headers=headers)

        res = await client.get("/schedule/conflicts", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2
