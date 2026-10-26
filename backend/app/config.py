from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Ruveon AI"
    app_env: str = "development"
    database_url: str = "sqlite:///./ruveon.db"
    api_v1_prefix: str = "/api/v1"
    auth_secret: str = "ruveon-development-secret-do-not-use-in-production"
    cors_origins: str = "*"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    whatsapp_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_display_number: str = ""
    whatsapp_api_version: str = "v23.0"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
