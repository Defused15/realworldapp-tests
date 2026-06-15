# Security Scan Skill

Invoca `security-agent` para correr y triagear scans de seguridad black-box (DAST/SCA/secrets).

## Uso

```
/security-scan zap           ← OWASP ZAP baseline contra la app corriendo
/security-scan deps          ← Trivy (vulns + misconfig + secrets) de este repo
/security-scan secrets       ← Gitleaks sobre git history
/security-scan               ← corre las 3 capas y escribe reportes
```

## Capas

| Capa    | Tool               | Target                 | Script                     |
| ------- | ------------------ | ---------------------- | -------------------------- |
| DAST    | OWASP ZAP baseline | app corriendo (UI+API) | `npm run security:zap`     |
| SCA     | Trivy + npm audit  | este repo + imagen app | `npm run security:deps`    |
| Secrets | Gitleaks           | git history            | `npm run security:secrets` |

> Los asserts in-test (XSS, SQLi, IDOR, auth) ya están con el tag `@security`:
> `npm run test:security`. ZAP los complementa escaneando toda respuesta.

## Estructura

```
security/
  zap/rules.tsv        ← qué alertas FAIL / WARN / IGNORE
  trivy/trivy.yaml     ← severidades + exit-code gate
.gitleaks.toml         ← reglas + allowlist de creds de test intencionales
docs/security-reports/ ← reportes triageados (espejo de docs/bug-reports/)
```

## Qué hace el agente

1. Verifica app corriendo + docker
2. Corre el scan pedido
3. Triagea findings: ¿app bug? ¿riesgo aceptado? ¿falso positivo? ¿ruido?
4. Ajusta `rules.tsv` / allowlist con justificación, o abre bug-report
5. Escribe `docs/security-reports/<scan>-<fecha>.md`

## REGLA #1

DAST es black-box (ZAP no ve el source de la app). **SAST sobre la app está prohibido.**
SCA/secrets aplican solo a NUESTRO repo y a la imagen Docker publicada.

## Prerequisitos

- App corriendo + `npm run db:seed` (para ZAP)
- Docker disponible (ZAP y Trivy corren como contenedores)

ARGUMENTS: $ARGUMENTS
