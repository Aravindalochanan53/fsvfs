"""Safe deployment failures; messages contain setting names, never values."""


class DeploymentConfigurationError(RuntimeError):
    def __init__(self, messages: list[str]):
        self.messages = tuple(messages)
        super().__init__("Deployment configuration: " + "; ".join(messages))
