import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_register_and_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register
        res = await client.post("/auth/register", json={
            "nom": "Dupont", "prenom": "Jean",
            "email": "jean@test.fr", "mot_de_passe": "secret123",
            "role": "eleve"
        })
        assert res.status_code == 201
        data = res.json()
        assert data["email"] == "jean@test.fr"
        assert data["role"] == "eleve"

        # Duplicate email
        res2 = await client.post("/auth/register", json={
            "nom": "Dupont", "prenom": "Jean",
            "email": "jean@test.fr", "mot_de_passe": "secret123",
            "role": "eleve"
        })
        assert res2.status_code == 409

        # Login
        res3 = await client.post("/auth/login", json={"email": "jean@test.fr", "mot_de_passe": "secret123"})
        assert res3.status_code == 200
        tokens = res3.json()
        assert "access_token" in tokens

        # /me
        res4 = await client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert res4.status_code == 200
        assert res4.json()["email"] == "jean@test.fr"


@pytest.mark.asyncio
async def test_wrong_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/auth/login", json={"email": "unknown@test.fr", "mot_de_passe": "wrong"})
        assert res.status_code == 401
