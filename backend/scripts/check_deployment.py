"""Read-only production preflight. Prints setting names, never their values."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    try:
        from app.core.config import Settings
        config = Settings()
        # Check the currently supplied environment as a Vercel deployment even
        # when this command is run locally; never silently approve dev defaults.
        config.IS_PRODUCTION = True
        config.IS_VERCEL = True
        problems = config.deployment_errors()
        if len(config.SECRET_KEY) < 32:
            problems.append("Set a stable SECRET_KEY of at least 32 random characters")
    except Exception as exc:
        print(f"Configuration cannot load ({type(exc).__name__}). Check production environment settings.")
        return 2
    if problems:
        print("Not ready for Vercel:")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("Production configuration passed. Next run: python scripts/verify_schema.py")
    print("This check does not prove cloud networking, Blob access or a deployed build.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
