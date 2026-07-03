package handlers

import (
	"net/http"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
)

type ticketMeta struct {
	ID         int64
	Code       string
	ReporterID int64
	AssigneeID sqlNullInt64
	Status     string
}

var allowedTicketStatuses = map[string]bool{
	"open":        true,
	"assigned":    true,
	"in_progress": true,
	"waiting":     true,
	"resolved":    true,
	"closed":      true,
	"rejected":    true,
}

func loadTicketMeta(ticketID int64) (*ticketMeta, error) {
	var t ticketMeta
	err := db.DB.QueryRow(
		"SELECT id, code, reporter_id, assignee_id, status FROM tickets WHERE id = ?",
		ticketID,
	).Scan(&t.ID, &t.Code, &t.ReporterID, &t.AssigneeID, &t.Status)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func canAccessTicket(r *http.Request, ticketID int64) (*ticketMeta, bool) {
	if ticketID <= 0 {
		return nil, false
	}
	meta, err := loadTicketMeta(ticketID)
	if err != nil {
		return nil, false
	}

	role := middleware.GetUserRole(r)
	userID := middleware.GetUserID(r)

	if role == "admin" || role == "it_support" {
		return meta, true
	}
	if meta.ReporterID == userID {
		return meta, true
	}
	return nil, false
}

func denyIfNoTicketAccess(w http.ResponseWriter, r *http.Request, ticketID int64) (*ticketMeta, bool) {
	meta, ok := canAccessTicket(r, ticketID)
	if !ok {
		RespondError(w, http.StatusNotFound, "Không tìm thấy ticket")
		return nil, true
	}
	return meta, false
}

func isITStaff(r *http.Request) bool {
	role := middleware.GetUserRole(r)
	return role == "admin" || role == "it_support"
}
