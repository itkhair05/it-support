package main

import (
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"

	"helpdesk-server/db"
	"helpdesk-server/handlers"
	"helpdesk-server/middleware"
	"helpdesk-server/ws"
)

// CORS Middleware for development
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		switch origin {
		case "http://localhost:5173", "http://127.0.0.1:5173":
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	// Initialize SQLite Database
	dbPath := filepath.Join(".", "helpdesk.db")
	db.InitDB(dbPath)

	// Run WebSocket Hub background worker
	go ws.GlobalHub.Run()

	mux := http.NewServeMux()

	// Public Routes
	mux.HandleFunc("/api/auth/login", handlers.LoginHandler)
	mux.HandleFunc("/api/auth/register", handlers.RegisterHandler)

	// Static Files (Uploaded files)
	os.MkdirAll("uploads", 0755)
	fileServer := http.FileServer(http.Dir("uploads"))
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", fileServer))

	// Protected Routes (Require Token)
	// Profile & Auth
	mux.HandleFunc("/api/profile", middleware.AuthMiddleware(handlers.GetProfileHandler))
	mux.HandleFunc("/api/profile/update", middleware.AuthMiddleware(handlers.UpdateProfileHandler))
	mux.HandleFunc("/api/profile/change-password", middleware.AuthMiddleware(handlers.ChangePasswordHandler))

	// Tickets & Activity Logs
	mux.HandleFunc("/api/tickets", middleware.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			handlers.CreateTicketHandler(w, r)
		} else {
			handlers.GetTicketsHandler(w, r)
		}
	}))

	mux.HandleFunc("/api/tickets/", middleware.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		urlPath := r.URL.Path
		action := path.Base(urlPath)

		if action == "status" {
			handlers.UpdateTicketStatusHandler(w, r)
		} else if action == "assign" {
			handlers.AssignTicketHandler(w, r)
		} else if action == "comments" {
			if r.Method == "POST" {
				handlers.CreateCommentHandler(w, r)
			} else {
				handlers.GetCommentsHandler(w, r)
			}
		} else if action == "attachments" {
			handlers.UploadAttachmentHandler(w, r)
		} else if action == "logs" {
			handlers.GetActivityLogsHandler(w, r)
		} else if action == "rate" {
			handlers.RateTicketHandler(w, r)
		} else {
			handlers.GetTicketDetailHandler(w, r)
		}
	}))

	// Stats & Analytics
	mux.HandleFunc("/api/stats", middleware.AuthMiddleware(handlers.GetDashboardStatsHandler))

	// Notifications & WebSocket
	mux.HandleFunc("/api/notifications", middleware.AuthMiddleware(handlers.GetNotificationsHandler))
	mux.HandleFunc("/api/notifications/", middleware.AuthMiddleware(handlers.MarkNotificationReadHandler))
	mux.HandleFunc("/ws", middleware.AuthMiddleware(handlers.WebSocketHandler))

	// Departments & Categories
	mux.HandleFunc("/api/categories", middleware.AuthMiddleware(handlers.ListCategoriesHandler))
	mux.HandleFunc("/api/departments", middleware.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			middleware.RequireRole("admin")(handlers.CreateDepartmentHandler)(w, r)
		} else {
			handlers.ListDepartmentsHandler(w, r)
		}
	}))
	mux.HandleFunc("/api/departments/", middleware.RequireRole("admin")(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "DELETE" {
			handlers.DeleteDepartmentHandler(w, r)
		} else {
			handlers.UpdateDepartmentHandler(w, r)
		}
	}))

	// IT Asset Management
	mux.HandleFunc("/api/assets", middleware.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			middleware.RequireRole("admin", "it_support")(handlers.CreateAssetHandler)(w, r)
		} else {
			handlers.ListAssetsHandler(w, r)
		}
	}))
	mux.HandleFunc("/api/assets/", middleware.RequireRole("admin", "it_support")(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "DELETE" {
			handlers.DeleteAssetHandler(w, r)
		} else {
			handlers.UpdateAssetStatusHandler(w, r)
		}
	}))

	// Admin Users Management
	mux.HandleFunc("/api/users", middleware.AuthMiddleware(handlers.ListUsersHandler))
	mux.HandleFunc("/api/admin/users", middleware.RequireRole("admin")(handlers.AdminCreateUserHandler))
	mux.HandleFunc("/api/admin/users/", middleware.RequireRole("admin")(func(w http.ResponseWriter, r *http.Request) {
		action := path.Base(r.URL.Path)
		if action == "toggle-status" {
			handlers.AdminToggleUserStatusHandler(w, r)
		} else if action == "reset-password" {
			handlers.AdminResetPasswordHandler(w, r)
		}
	}))

	port := "8080"
	log.Printf("==================================================")
	log.Printf("   HelpDesk Go Backend is running on port %s", port)
	log.Printf("==================================================")

	err := http.ListenAndServe(":"+port, corsMiddleware(mux))
	if err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
