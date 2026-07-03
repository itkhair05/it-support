package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var JwtSecret = []byte("dev-only-helpdesk-change-me")

func init() {
	if s := strings.TrimSpace(os.Getenv("JWT_SECRET")); s != "" {
		JwtSecret = []byte(s)
	}
}

type Claims struct {
	UserID   int64  `json:"user_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	FullName string `json:"full_name"`
	jwt.RegisteredClaims
}

type contextKey string

const (
	UserIDKey   contextKey = "userID"
	UserRoleKey contextKey = "userRole"
	UserKey     contextKey = "userClaims"
)

func GenerateToken(userID int64, email, role, fullName string) (string, error) {
	expirationTime := time.Now().Add(72 * time.Hour)
	claims := &Claims{
		UserID:   userID,
		Email:    email,
		Role:     role,
		FullName: fullName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JwtSecret)
}

func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		tokenStr := ""

		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		} else if qToken := r.URL.Query().Get("token"); qToken != "" {
			tokenStr = qToken // Support WebSocket query token
		}

		if tokenStr == "" {
			http.Error(w, `{"error":"Unauthorized: Missing token"}`, http.StatusUnauthorized)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return JwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error":"Unauthorized: Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
		ctx = context.WithValue(ctx, UserKey, claims)

		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func RequireRole(roles ...string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value(UserRoleKey).(string)
			if !ok {
				http.Error(w, `{"error":"Forbidden: Role not found"}`, http.StatusForbidden)
				return
			}

			allowed := false
			for _, r := range roles {
				if r == userRole {
					allowed = true
					break
				}
			}

			if !allowed {
				http.Error(w, `{"error":"Forbidden: Insufficient permissions"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetUserID(r *http.Request) int64 {
	if val, ok := r.Context().Value(UserIDKey).(int64); ok {
		return val
	}
	return 0
}

func GetUserRole(r *http.Request) string {
	if val, ok := r.Context().Value(UserRoleKey).(string); ok {
		return val
	}
	return ""
}

func GetUserClaims(r *http.Request) *Claims {
	if val, ok := r.Context().Value(UserKey).(*Claims); ok {
		return val
	}
	return nil
}
