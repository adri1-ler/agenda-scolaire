import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.messaging import Channel, ChannelMember, ChannelType
from app.models.user import Eleve, User


async def create_classe_channel(classe_id: uuid.UUID, created_by: uuid.UUID, db: AsyncSession) -> Channel:
    channel = Channel(
        type=ChannelType.groupe_classe,
        nom=f"Classe",
        classe_id=classe_id,
        created_by=created_by,
    )
    db.add(channel)
    await db.flush()

    # Add all students of this class
    eleves_result = await db.execute(select(Eleve).where(Eleve.classe_id == classe_id))
    for eleve in eleves_result.scalars().all():
        db.add(ChannelMember(channel_id=channel.id, user_id=eleve.user_id))

    # Add the prof
    db.add(ChannelMember(channel_id=channel.id, user_id=created_by))
    await db.flush()
    return channel


async def get_or_create_direct_channel(user1_id: uuid.UUID, user2_id: uuid.UUID, db: AsyncSession) -> Channel:
    # Check if direct channel already exists
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(Channel.type == ChannelType.direct, ChannelMember.user_id == user1_id)
    )
    candidates = result.scalars().all()

    for ch in candidates:
        member_result = await db.execute(
            select(ChannelMember).where(
                ChannelMember.channel_id == ch.id,
                ChannelMember.user_id == user2_id
            )
        )
        if member_result.scalar_one_or_none():
            return ch

    channel = Channel(type=ChannelType.direct, created_by=user1_id)
    db.add(channel)
    await db.flush()
    db.add(ChannelMember(channel_id=channel.id, user_id=user1_id))
    db.add(ChannelMember(channel_id=channel.id, user_id=user2_id))
    await db.flush()
    return channel


async def add_student_to_classe_channels(user_id: uuid.UUID, classe_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(Channel).where(Channel.classe_id == classe_id)
    )
    for channel in result.scalars().all():
        existing = await db.execute(
            select(ChannelMember).where(
                ChannelMember.channel_id == channel.id,
                ChannelMember.user_id == user_id
            )
        )
        if not existing.scalar_one_or_none():
            db.add(ChannelMember(channel_id=channel.id, user_id=user_id))
