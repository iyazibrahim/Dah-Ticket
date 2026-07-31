package services

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

const temporaryPasswordLength = 14

var temporaryPasswordAlphabet = []byte("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%")

// GenerateTemporaryPassword returns a cryptographically random password suitable for first login.
func GenerateTemporaryPassword() (string, error) {
	buf := make([]byte, temporaryPasswordLength)
	for i := range buf {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(temporaryPasswordAlphabet))))
		if err != nil {
			return "", fmt.Errorf("generate password: %w", err)
		}
		buf[i] = temporaryPasswordAlphabet[n.Int64()]
	}
	return string(buf), nil
}
