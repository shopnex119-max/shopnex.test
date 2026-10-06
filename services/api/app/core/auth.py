from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

_bearer = HTTPBearer(auto_error=False)
ADMIN_ROLES = frozenset({'super admin', 'company admin', 'admin', 'owner'})


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in to access local business data")
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Session expired; sign in again")
    user = db.get(User, user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="User session is no longer valid")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role.strip().casefold() not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Administrator permission is required")
    return user
