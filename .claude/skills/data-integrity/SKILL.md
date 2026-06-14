# Data Integrity Testing Skill

Invokes `data-integrity-agent` para una feature específica (o todas) — escribe o actualiza `tests/api/data-integrity/<feature>.spec.ts`.

## Uso

```
/data-integrity transaction      ← solo transaction
/data-integrity signup           ← solo user/signup
/data-integrity home             ← solo home (read-only, API vs DB consistency)
/data-integrity                  ← todas las features existentes (una por agente, en paralelo)
```

## Cuándo usar

- **Automático**: `gen-test` lo invoca como Wave C después de Wave B — no necesitas llamarlo manualmente cuando usas gen-test.
- **Manual**: cuando agregas lógica de negocio a una feature ya existente y quieres actualizar sus tests de integridad sin regenerar todo.
- **Sweep completo**: `/data-integrity` sin argumentos re-ejecuta todos los archivos de `tests/api/data-integrity/` para detectar regresiones de DB.

## Qué hace

1. **Lee el context brief** — lista de endpoints API de la feature para saber qué tablas escribe
2. **Crea `tests/helpers/db-helpers.ts`** si no existe (una sola vez, compartido por todas las features)
3. **Escribe `tests/api/data-integrity/<feature>.spec.ts`** con:
   - Write-then-SQL-read: `POST /endpoint` → `SELECT * FROM table WHERE id = '...'` → compare campo a campo
   - API vs DB consistency: IDs del API existen en DB, counts coherentes
   - Orphan checks: LEFT JOINs que detectan FKs rotas
   - Schema validation: constraints de DB existen (UNIQUE, FK)
4. **TypeScript check**: `npx tsc --noEmit`

## Por qué SQL y no solo API round-trip

Los API tests son circulares — si la API tiene un bug en write Y en read, el test pasa.
SQL rompe esa circularidad: es una fuente de verdad independiente.

```
API test:    POST /tx → GET /tx → ✅ (ambos tienen el mismo bug)
Integridad:  POST /tx → SELECT FROM transactions → ❌ detecta el bug
```

Bugs que SQL captura y los API tests NO:

- Amount serializado como `4999.9999` por float precision en DB
- FK violada — registro existe en API pero orphan en DB
- Campo truncado por el ORM antes de guardar
- Constraint no aplicado a nivel de DB (solo a nivel de API)
- `isRead` en cache ≠ valor real en DB

## Estructura de archivos

```
tests/
  helpers/
    db-helpers.ts              ← escrito una vez, compartido
  api/
    data-integrity/
      transaction.spec.ts      ← /gen-test transaction  o  /data-integrity transaction
      signup.spec.ts           ← /gen-test signup        o  /data-integrity signup
      home.spec.ts             ← /gen-test home          o  /data-integrity home
      bankaccounts.spec.ts     ← /gen-test bankaccounts  o  /data-integrity bankaccounts
```

## Flujo gen-test con Wave C

```
Wave A (parallel): pom-agent + support-agent + gherkin-agent
        ↓
Wave B (parallel): ui-test-agent + api-test-agent
        ↓
Wave C (sequential): data-integrity-agent   ← escribe tests/api/data-integrity/<feature>.spec.ts
```

## DB connection (proyecto actual)

```bash
docker exec cypress-app-postgres-1 psql -U postgres -d rwa_dev -c "SELECT 1"
```

- Container: `cypress-app-postgres-1`
- DB: `rwa_dev` · User: `postgres` (sin contraseña)
- Tables: `users`, `transactions`, `likes`, `comments`, `notifications`, `bankaccounts`

## Running solo

```bash
# Una feature
npx playwright test tests/api/data-integrity/transaction.spec.ts

# Todas
npx playwright test tests/api/data-integrity/

# Tag
npx playwright test --grep @data-integrity
```

## Prerequisitos

- App corriendo: `docker compose up -d`
- DB en estado conocido: `npm run db:seed`
- Docker disponible en shell: `docker ps` funciona

ARGUMENTS: $ARGUMENTS
