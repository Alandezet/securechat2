# Security

SecureChat is an experimental project.

Do not use it for sensitive communications until the cryptographic protocol,
implementation, dependency chain, and build process have undergone appropriate
security review.

## Design rules

- Never invent a cryptographic primitive.
- Never store private identity keys on a server.
- Never commit API keys, passwords, signing keys, or private cryptographic keys.
- Prefer established protocols and audited implementations.
- Treat metadata as sensitive.
- Verify cryptographic identity keys when possible.
- Keep cryptographic operations isolated from UI/network code.
