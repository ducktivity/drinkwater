package api

import "encoding/json"

// UserSettings is the client-owned UI settings document (bottle size, daily goal,
// schedule, reminder). The backend persists it verbatim as JSON and never
// interprets the shape, so the frontend remains the single owner of the settings
// schema. swaggertype:"object" makes the generated OpenAPI/TS type a plain object.
type UserSettings struct {
	Settings json.RawMessage `json:"settings" validate:"required" swaggertype:"object"`
}
