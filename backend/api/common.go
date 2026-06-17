package api

// MessageResponse is a generic single-message body (e.g. the deliberately vague
// acknowledgement returned by POST /auth/request).
type MessageResponse struct {
	Message string `json:"message" validate:"required"`
}
