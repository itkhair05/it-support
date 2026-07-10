package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"
	"helpdesk-server/ws"
)

func GetCommentsHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	ticketID, _ := strconv.ParseInt(pathParts[2], 10, 64)
	if _, denied := denyIfNoTicketAccess(w, r, ticketID); denied {
		return
	}

	rows, err := db.DB.Query(`
		SELECT c.id, c.ticket_id, c.user_id, u.full_name, u.role, u.avatar_url, c.parent_id, c.content, c.created_at
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.ticket_id = ?
		ORDER BY c.created_at ASC`, ticketID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi tải bình luận")
		return
	}
	defer rows.Close()

	comments := []models.Comment{}
	for rows.Next() {
		var cm models.Comment
		var parentID sqlNullInt64
		rows.Scan(&cm.ID, &cm.TicketID, &cm.UserID, &cm.UserName, &cm.UserRole, &cm.UserAvatar, &parentID, &cm.Content, &cm.CreatedAt)
		if parentID.Valid {
			cm.ParentID = &parentID.Int64
		}
		comments = append(comments, cm)
	}

	RespondJSON(w, http.StatusOK, comments)
}

func CreateCommentHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	claims := middleware.GetUserClaims(r)

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	ticketID, _ := strconv.ParseInt(pathParts[2], 10, 64)
	meta, denied := denyIfNoTicketAccess(w, r, ticketID)
	if denied {
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		RespondError(w, http.StatusBadRequest, "Nội dung bình luận không được rỗng")
		return
	}

	var parentIDVal interface{} = nil
	if req.ParentID != nil && *req.ParentID > 0 {
		parentIDVal = *req.ParentID
	}

	res, err := db.DB.Exec("INSERT INTO comments (ticket_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)",
		ticketID, userID, parentIDVal, req.Content)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi lưu bình luận")
		return
	}

	commentID, _ := res.LastInsertId()

	ticketCode := meta.Code
	reporterID := meta.ReporterID
	assigneeID := meta.AssigneeID

	// Fetch created comment object first
	var cm models.Comment
	var pID sqlNullInt64
	err = db.DB.QueryRow(`
		SELECT c.id, c.ticket_id, c.user_id, u.full_name, u.role, u.avatar_url, c.parent_id, c.content, c.created_at
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.id = ?`, commentID).Scan(&cm.ID, &cm.TicketID, &cm.UserID, &cm.UserName, &cm.UserRole, &cm.UserAvatar, &pID, &cm.Content, &cm.CreatedAt)
	if pID.Valid {
		cm.ParentID = &pID.Int64
	}

	// Realtime chat only to people who can see this ticket
	ws.GlobalHub.SendToUser(reporterID, "CHAT_STREAM_UPDATE", cm)
	if assigneeID.Valid {
		ws.GlobalHub.SendToUser(assigneeID.Int64, "CHAT_STREAM_UPDATE", cm)
	}
	ws.GlobalHub.SendToRole("admin", "CHAT_STREAM_UPDATE", cm)
	ws.GlobalHub.SendToRole("it_support", "CHAT_STREAM_UPDATE", cm)

	// Detect @Mentions
	re := regexp.MustCompile(`@([\p{L}\w\s]+?)(?:[.,!?\s]|$)`)
	matches := re.FindAllStringSubmatch(req.Content, -1)
	mentionedUserIDs := make(map[int64]bool)

	for _, m := range matches {
		if len(m) > 1 {
			mentionedName := strings.TrimSpace(m[1])
			var mID int64
			err := db.DB.QueryRow("SELECT id FROM users WHERE LOWER(full_name) LIKE LOWER(?)", "%"+mentionedName+"%").Scan(&mID)
			if err == nil && mID != userID {
				mentionedUserIDs[mID] = true
			}
		}
	}

	// Send targeted notifications ONLY to mentioned users
	for mID := range mentionedUserIDs {
		notifMsg := fmt.Sprintf("%s đã nhắc tới bạn trong bình luận của ticket %s", claims.FullName, ticketCode)
		db.DB.Exec("INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)",
			mID, "Được nhắc tới trong Ticket "+ticketCode, notifMsg, fmt.Sprintf("/tickets/%d", ticketID))

		ws.GlobalHub.SendToUser(mID, "NEW_COMMENT_MENTION", map[string]interface{}{
			"user_id":   mID,
			"ticket_id": ticketID,
			"code":      ticketCode,
			"sender":    claims.FullName,
			"content":   req.Content,
			"comment":   cm,
		})
	}

	// Send targeted notifications ONLY to ticket participants
	participants := map[int64]bool{reporterID: true}
	if assigneeID.Valid {
		participants[assigneeID.Int64] = true
	}

	for pIDItem := range participants {
		if pIDItem != userID && !mentionedUserIDs[pIDItem] {
			notifMsg := fmt.Sprintf("%s đã bình luận trong ticket %s", claims.FullName, ticketCode)
			db.DB.Exec("INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)",
				pIDItem, "Bình luận mới trong Ticket "+ticketCode, notifMsg, fmt.Sprintf("/tickets/%d", ticketID))

			ws.GlobalHub.SendToUser(pIDItem, "NEW_COMMENT", map[string]interface{}{
				"user_id":   pIDItem,
				"ticket_id": ticketID,
				"code":      ticketCode,
				"sender":    claims.FullName,
				"content":   req.Content,
				"comment":   cm,
			})
		}
	}

	RespondJSON(w, http.StatusCreated, cm)
}
