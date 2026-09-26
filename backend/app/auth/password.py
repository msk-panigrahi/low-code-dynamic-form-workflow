from passlib.context import CryptContext

# Use pbkdf2_sha256 which is compatible, secure, and doesn't need external C extensions.
# The default rounds (29000) provides strong protection against brute-force attacks.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password using PBKDF2-SHA256."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)
