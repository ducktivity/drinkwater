package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"math/big"
)

// CodeLength is the number of digits in a login code. Six digits balances
// usability (easy to type) against brute-force resistance, which the 5-attempt
// cap and 10-minute expiry enforced by the handler make negligible.
const CodeLength = 6

// GenerateCode returns a cryptographically random CodeLength-digit numeric code,
// zero-padded so every code is exactly CodeLength characters (e.g. "004217").
func GenerateCode() (string, error) {
	const digits = "0123456789"
	buf := make([]byte, CodeLength)
	for i := range buf {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		buf[i] = digits[n.Int64()]
	}
	return string(buf), nil
}

// HashCode returns the hex SHA-256 of the code peppered with the server secret.
// We store only this hash, never the raw code, so a database leak cannot reveal
// in-flight codes. The pepper means the hash also cannot be brute-forced offline
// without the secret.
func HashCode(code string) string {
	h := sha256.New()
	h.Write([]byte(code))
	h.Write(secret)
	return hex.EncodeToString(h.Sum(nil))
}

// CodeMatches reports whether a candidate code hashes to the stored hash, using
// a constant-time comparison so verification time does not leak how many leading
// characters were correct.
func CodeMatches(candidate, storedHash string) bool {
	candidateHash := HashCode(candidate)
	return subtle.ConstantTimeCompare([]byte(candidateHash), []byte(storedHash)) == 1
}
