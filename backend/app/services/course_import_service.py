import io
import json
import os
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Partie, RevisionSlot, Schedule


async def import_course_and_create_parties(
    file_bytes: bytes,
    examen_id: uuid.UUID,
    eleve_id: uuid.UUID,
    total_hours: float,
    db: AsyncSession,
) -> list[Partie]:
    text = _extract_pdf_text(file_bytes)

    api_key = os.getenv("OPENAI_API_KEY")
    if api_key and text.strip():
        try:
            sections = await _parse_with_openai(text, total_hours, api_key)
        except Exception:
            sections = _split_equally(text, total_hours)
    else:
        sections = _split_equally(text, total_hours)

    # Delete existing revision slots + schedules before removing parties
    existing_result = await db.execute(
        select(Partie).where(Partie.examen_id == examen_id, Partie.eleve_id == eleve_id)
    )
    existing_parties = existing_result.scalars().all()

    if existing_parties:
        slots_result = await db.execute(
            select(RevisionSlot).where(
                RevisionSlot.eleve_id == eleve_id,
                RevisionSlot.partie_id.in_([p.id for p in existing_parties]),
            )
        )
        slots = slots_result.scalars().all()
        sched_ids = [s.schedule_id for s in slots]

        for slot in slots:
            await db.delete(slot)
        await db.flush()

        for sched_id in sched_ids:
            sched = await db.get(Schedule, sched_id)
            if sched:
                await db.delete(sched)
        await db.flush()

        for partie in existing_parties:
            await db.delete(partie)
        await db.flush()

    created: list[Partie] = []
    for i, s in enumerate(sections):
        partie = Partie(
            examen_id=examen_id,
            eleve_id=eleve_id,
            nom=s["nom"],
            description=s.get("description") or None,
            temps_requis_heures=s["temps_heures"],
            ordre=i,
        )
        db.add(partie)
        created.append(partie)

    await db.commit()
    for p in created:
        await db.refresh(p)
    return created


def _extract_pdf_text(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)
    except Exception:
        return ""


async def _parse_with_openai(text: str, total_hours: float, api_key: str) -> list[dict]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    text_truncated = text[:8000]

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1024,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Tu es un assistant pédagogique. Tu analyses des cours et tu identifies "
                    "les grandes sections à réviser. Tu réponds toujours en JSON valide."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Analyse ce cours et identifie les grandes sections ou chapitres à réviser.\n"
                    "Pour chaque section, donne :\n"
                    '- "nom" : titre court du chapitre (2-6 mots)\n'
                    '- "description" : ce qu\'il faut réviser dans cette section (1 phrase)\n\n'
                    "Réponds avec un objet JSON contenant une clé \"sections\" :\n"
                    '{"sections": [{"nom": "...", "description": "..."}, ...]}\n\n'
                    "Identifie entre 2 et 8 sections selon la longueur du cours.\n\n"
                    f"Cours :\n{text_truncated}"
                ),
            },
        ],
    )

    raw = response.choices[0].message.content or ""
    data = json.loads(raw)
    sections_raw = data.get("sections", data) if isinstance(data, dict) else data

    n = len(sections_raw)
    hours_each = round(total_hours / n, 1)
    total_assigned = round(hours_each * (n - 1), 1)
    last_hours = round(total_hours - total_assigned, 1)

    result = []
    for i, s in enumerate(sections_raw):
        result.append({
            "nom": s["nom"],
            "description": s.get("description", ""),
            "temps_heures": last_hours if i == n - 1 else hours_each,
        })
    return result


def _split_equally(text: str, total_hours: float) -> list[dict]:
    words = text.split()
    word_count = max(len(words), 1)
    num_sections = max(2, min(8, word_count // 300 + 1))
    hours_each = round(total_hours / num_sections, 1)

    return [
        {
            "nom": f"Partie {i + 1}",
            "description": f"Section {i + 1} du cours",
            "temps_heures": hours_each,
        }
        for i in range(num_sections)
    ]
