# Backend Development Documentation

### Create a new DB schema migration

```bash
./scripts/db-new-migration.sh add_some_column
```

- Use-case: When you need a new DB schema change file.
- Usage: Replace `add_some_column` with your migration file name.
- Output: [sql/schema/](sql/schema/)

### Run DB migration

```bash
./scripts/db-migrate.sh up
```

- Use-case: When you need to apply, rollback, or inspect migrations.
- Usage: Replace `up` with `down`, `status`, or other Goose commands as needed.

Make sure `DATABASE_URL` is in `backend/.env`

### Generate type-safe SQL queries and models

```bash
./scripts/db-codegen.sh
```

- Use-case: After migration (up/down) or writing anything new into [sql/](sql/).
- Output: [database/dbgen/](database/dbgen/)

### Export Swagger (OpenAPI 2) schema

```bash
./scripts/export-swaggerr.sh
```

- Use-case: After making API changes and you need to refresh the schema.
- Output: [../shared-schemas/swagger.json](../shared-schemas/swagger.json).
