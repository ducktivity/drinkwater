// Package email delivers transactional mail (currently just login codes) via
// Resend's REST API. It is configured once at startup; when no API key is set
// (local dev) it falls back to logging the code so the auth flow works without
// any email provider.
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// resendEndpoint is Resend's transactional send endpoint.
const resendEndpoint = "https://api.resend.com/emails"

// Sender holds the delivery configuration. A zero/empty apiKey puts the sender
// in dev mode, where codes are logged instead of emailed.
type Sender struct {
	apiKey string // RESEND_API_KEY; empty disables real sending (dev mode)
	from   string // AUTH_EMAIL_FROM, e.g. "Drinkwater <login@example.com>"
	client *http.Client
}

// NewSender builds a Sender from the Resend API key and the From address.
func NewSender(apiKey, from string) *Sender {
	return &Sender{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// resendRequest is the JSON body Resend's /emails endpoint expects.
type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

// SendLoginCode emails a one-time login code to the recipient. In dev mode (no
// API key) it logs the code at info level and returns nil so the flow still
// completes locally.
func (s *Sender) SendLoginCode(ctx context.Context, to, code string) error {
	if s.apiKey == "" {
		// Dev fallback: surface the code in the server log so a developer can
		// complete login without configuring Resend.
		slog.Info("login code (dev mode, email not sent)", "to", to, "code", code)
		return nil
	}

	subject := "Your Drinkwater login code"
	text := fmt.Sprintf("Your Drinkwater login code is %s. It expires in 10 minutes.", code)
	html := fmt.Sprintf(
		`<p>Your Drinkwater login code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">%s</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
		code,
	)

	body, err := json.Marshal(resendRequest{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
		Text:    text,
	})
	if err != nil {
		return fmt.Errorf("marshal resend request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendEndpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send via resend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		// Read a bounded slice of the error body to keep the log line useful but
		// not unbounded.
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resend returned %d: %s", resp.StatusCode, string(snippet))
	}
	return nil
}
