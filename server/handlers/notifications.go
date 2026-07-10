package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"
	"helpdesk-server/ws"
)

func GetNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`
		SELECT id, user_id, title, message, link, is_read, created_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC LIMIT 30`, userID)

	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi lấy danh sách thông báo")
		return
	}
	defer rows.Close()

	notifs := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		rows.Scan(&n.ID, &n.UserID, &n.Title, &n.Message, &n.Link, &n.IsRead, &n.CreatedAt)
		notifs = append(notifs, n)
	}

	RespondJSON(w, http.StatusOK, notifs)
}

func MarkNotificationReadHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	notifID, _ := strconv.ParseInt(pathParts[2], 10, 64)

	db.DB.Exec("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", notifID, userID)
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Đã đánh dấu đã đọc"})
}

func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)

	ws.ServeWS(ws.GlobalHub, w, r, userID, role)
}
