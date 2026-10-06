from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Basin, BathReading, Filature, User


class CodeConflictError(Exception):
    """新盆码与同坞现有盆码撞码。"""


class StaleCodeError(Exception):
    """提交所基于的盆码已不是库里的现值：交叉改码时后到的一版必须被拒。"""


class UserRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def by_username(self, username: str) -> User | None:
        result = await self.session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()


class BasinRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def board(self) -> Filature | None:
        result = await self.session.execute(
            select(Filature).options(
                selectinload(Filature.basins).selectinload(Basin.readings)
            )
        )
        return result.scalars().first()

    async def get(self, basin_id: int) -> Basin | None:
        result = await self.session.execute(
            select(Basin)
            .options(selectinload(Basin.readings))
            .where(Basin.id == basin_id)
        )
        return result.scalar_one_or_none()

    async def change_code(
        self, basin_id: int, new_code: str, expected_code: str
    ) -> Basin | None:
        # 锁住该盆行：两名工交叉改同一盆时在此排队，后到者看到的是最新盆码。
        result = await self.session.execute(
            select(Basin)
            .options(selectinload(Basin.readings))
            .where(Basin.id == basin_id)
            .with_for_update()
        )
        basin = result.scalar_one_or_none()
        if basin is None:
            return None
        # 乐观校验：提交必须基于开改时看到的盆码，旧码已被改走则拒绝本版。
        if basin.code != expected_code:
            current_code = basin.code
            await self.session.rollback()
            raise StaleCodeError(
                f"盆码刚被他人改成「{current_code}」，请按最新盆码重新修改"
            )
        basin.code = new_code
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise CodeConflictError("同一缫丝坞内盆码不能重复")
        return basin

    async def add_reading(self, basin: Basin, temp_c: float, operator: str) -> BathReading:
        row = BathReading(basin=basin, water_temp_c=temp_c, operator=operator)
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def save_status(self, basin: Basin, status: str) -> None:
        basin.status = status
        await self.session.commit()
