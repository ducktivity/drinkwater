### Backend Development Documentation

##### Generate OpenAPI schema in Go

```bash
go tool oapi-codegen -generate types,skip-prune -package models ../shared-schemas/openapi.yaml > models/models.gen.go
```

Output: models/models.gen.go
