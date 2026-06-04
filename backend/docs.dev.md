### Backend Development Documentation

##### Run DB migration

```bash
./scripts/db-migrate.sh up
```

Make sure `DATABASE_URL` is in `backend/.env`

##### Generate type-safe SQL queries and models

```bash
./scripts/db-codegen.sh
```

Usage: After migration (up/down) or writing anything new into `sql/`.
Output: database/dbgen/.

##### Export OpenAPI schema

```bash
./scripts/export-openapi.sh
```

Output: shared-schemas/openapi.json.
