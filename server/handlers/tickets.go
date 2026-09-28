package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"
	"helpdesk-server/ws"
)

func GetTicketsHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)

	// Query params for filtering & searching
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")
	priority := r.URL.Query().Get("priority")
	categoryID := r.URL.Query().Get("category_id")
	myTicketsOnly := r.URL.Query().Get("my_tickets") // "true" or "false"
	unassignedOnly := r.URL.Query().Get("unassigned") // "true" or "false"

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	// Role-based scoping logic
	if role == "employee" {
		whereClauses = append(whereClauses, "t.reporter_id = ?")
		args = append(args, userID)
	} else if role == "it_support" {
		if myTicketsOnly == "true" {
			whereClauses = append(whereClauses, "t.assignee_id = ?")
			args = append(args, userID)
		} else if unassignedOnly == "true" {
			whereClauses = append(whereClauses, "t.assignee_id IS NULL")
		}
	} else if role == "admin" {
		if myTicketsOnly == "true" {
			whereClauses = append(whereClauses, "(t.reporter_id = ? OR t.assignee_id = ?)")
			args = append(args, userID, userID)
		}
	}

	if search != "" {
		whereClauses = append(whereClauses, "(t.code LIKE ? OR t.title LIKE ? OR u_rep.full_name LIKE ?)")
		searchTerm := "%" + search + "%"
		args = append(args, searchTerm, searchTerm, searchTerm)
	}

	if status != "" {
		whereClauses = append(whereClauses, "t.status = ?")
		args = append(args, status)
	}

	if priority != "" {
		whereClauses = append(whereClauses, "t.priority = ?")
		args = append(args, priority)
	}

	if categoryID != "" {
		whereClauses = append(whereClauses, "t.category_id = ?")
		args = append(args, categoryID)
	}

	query := fmt.Sprintf(`
		SELECT 
			t.id, t.code, t.title, t.description, t.category_id, c.name,
			t.priority, t.status, t.reporter_id, u_rep.full_name,
			t.assignee_id, COALESCE(u_ass.full_name, ''),
			t.department_id, COALESCE(d.name, ''),
			t.deadline, t.created_at, t.updated_at, t.resolved_at,
			(SELECT COUNT(*) FROM comments cm WHERE cm.ticket_id = t.id) as comments_count
		FROM tickets t
		JOIN categories c ON t.category_id = c.id
		JOIN users u_rep ON t.reporter_id = u_rep.id
		LEFT JOIN users u_ass ON t.assignee_id = u_ass.id
		LEFT JOIN departments d ON t.department_id = d.id
		WHERE %s
		ORDER BY t.created_at DESC`, strings.Join(whereClauses, " AND "))

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi lấy danh sách ticket")
		return
	}
	defer rows.Close()

	tickets := []models.Ticket{}
	for rows.Next() {
		var t models.Ticket
		var assigneeID sqlNullInt64
		var deptID sqlNullInt64
		var deadlineVal interface{}
		var createdAtVal interface{}
		var updatedAtVal interface{}
		var resolvedAtVal interface{}

		err := rows.Scan(
			&t.ID, &t.Code, &t.Title, &t.Description, &t.CategoryID, &t.CategoryName,
			&t.Priority, &t.Status, &t.ReporterID, &t.ReporterName,
			&assigneeID, &t.AssigneeName,
			&deptID, &t.DepartmentName,
			&deadlineVal, &createdAtVal, &updatedAtVal, &resolvedAtVal, &t.CommentsCount,
		)
		if err != nil {
			continue
		}

		if assigneeID.Valid {
			t.AssigneeID = &assigneeID.Int64
		}
		if deptID.Valid {
			t.DepartmentID = &deptID.Int64
		}
		t.CreatedAt = parseSQLiteTime(createdAtVal)
		t.UpdatedAt = parseSQLiteTime(updatedAtVal)

		if deadlineVal != nil {
			dTime := parseSQLiteTime(deadlineVal)
			if !dTime.IsZero() {
				t.Deadline = &dTime
			}
		}
		if resolvedAtVal != nil {
			rTime := parseSQLiteTime(resolvedAtVal)
			if !rTime.IsZero() {
				t.ResolvedAt = &rTime
			}
		}

		tickets = append(tickets, t)
	}

	RespondJSON(w, http.StatusOK, tickets)
}

func CreateTicketHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	claims := middleware.GetUserClaims(r)

	var req models.CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	if req.Title == "" || req.Description == "" || req.CategoryID <= 0 || req.Priority == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng nhập đầy đủ các trường bắt buộc")
		return
	}

	switch req.Priority {
	case "low", "medium", "high", "urgent":
	default:
		RespondError(w, http.StatusBadRequest, "Mức ưu tiên không hợp lệ")
		return
	}

	// Auto SLA deadline calculation based on priority
	var deadline time.Time
	now := time.Now()
	switch req.Priority {
	case "urgent":
		deadline = now.Add(4 * time.Hour)
	case "high":
		deadline = now.Add(24 * time.Hour)
	case "medium":
		deadline = now.Add(48 * time.Hour)
	default: // low
		deadline = now.Add(72 * time.Hour)
	}

	// Get user department if not provided
	var deptID *int64 = req.DepartmentID
	if deptID == nil {
		var userDeptID sqlNullInt64
		db.DB.QueryRow("SELECT department_id FROM users WHERE id = ?", userID).Scan(&userDeptID)
		if userDeptID.Valid {
			deptID = &userDeptID.Int64
		}
	}

	var deptVal interface{} = nil
	if deptID != nil && *deptID > 0 {
		deptVal = *deptID
	}

	var assetVal interface{} = nil
	if req.AssetID != nil && *req.AssetID > 0 {
		assetVal = *req.AssetID
	}

	// Generate temp code, insert, get ID, then update code TIC-100x
	res, err := db.DB.Exec(`
		INSERT INTO tickets (code, title, description, category_id, priority, status, reporter_id, department_id, asset_id, deadline, created_at, updated_at)
		VALUES ('TEMP', ?, ?, ?, ?, 'open', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		req.Title, req.Description, req.CategoryID, req.Priority, userID, deptVal, assetVal, deadline,
	)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi tạo ticket: "+err.Error())
		return
	}

	ticketID, _ := res.LastInsertId()
	ticketCode := fmt.Sprintf("TIC-%d", 1000+ticketID)
	db.DB.Exec("UPDATE tickets SET code = ? WHERE id = ?", ticketCode, ticketID)

	// Log activity
	db.DB.Exec("INSERT INTO activity_logs (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)",
		ticketID, userID, "Khởi tạo Ticket", fmt.Sprintf("Khởi tạo %s: %s", ticketCode, req.Title))

	// Realtime notification to IT Support & Admin
	wsPayload := map[string]interface{}{
		"ticket_id":    ticketID,
		"code":         ticketCode,
		"title":        req.Title,
		"reporter":     claims.FullName,
		"priority":     req.Priority,
		"created_at":   now.Format(time.RFC3339),
	}
	ws.GlobalHub.SendToRole("admin", "NEW_TICKET", wsPayload)
	ws.GlobalHub.SendToRole("it_support", "NEW_TICKET", wsPayload)

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      ticketID,
		"code":    ticketCode,
		"message": "Tạo ticket thành công",
	})
}

func parseSQLiteTime(val interface{}) time.Time {
	if val == nil {
		return time.Time{}
	}
	switch v := val.(type) {
	case time.Time:
		return v
	case string:
		v = strings.TrimSpace(v)
		formats := []string{
			time.RFC3339,
			"2006-01-02 15:04:05",
			"2006-01-02T15:04:05Z",
			"2006-01-02 15:04:05.999999999-07:00",
			"2006-01-02T15:04:05.999999999-07:00",
			"2006-01-02",
		}
		for _, f := range formats {
			if t, err := time.Parse(f, v); err == nil {
				return t
			}
		}
	}
	return time.Time{}
}

func GetTicketDetailHandler(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/tickets/")
	idStr = strings.Trim(idStr, "/")
	ticketID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "ID Ticket không hợp lệ")
		return
	}

	if _, denied := denyIfNoTicketAccess(w, r, ticketID); denied {
		return
	}

	var t models.Ticket
	var assigneeID sqlNullInt64
	var deptID sqlNullInt64
	var deadlineVal interface{}
	var createdAtVal interface{}
	var updatedAtVal interface{}
	var resolvedAtVal interface{}

	err = db.DB.QueryRow(`
		SELECT
			t.id, t.code, t.title, t.description, t.category_id, COALESCE(c.name, 'Chưa phân loại'),
			t.priority, t.status, t.reporter_id, COALESCE(u_rep.full_name, 'Người dùng'),
			t.assignee_id, COALESCE(u_ass.full_name, ''),
			t.department_id, COALESCE(d.name, ''),
			t.deadline, t.created_at, t.updated_at, t.resolved_at,
			COALESCE(t.rating, 0), COALESCE(t.rating_comment, '')
		FROM tickets t
		LEFT JOIN categories c ON t.category_id = c.id
		LEFT JOIN users u_rep ON t.reporter_id = u_rep.id
		LEFT JOIN users u_ass ON t.assignee_id = u_ass.id
		LEFT JOIN departments d ON t.department_id = d.id
		WHERE t.id = ?`, ticketID).Scan(
		&t.ID, &t.Code, &t.Title, &t.Description, &t.CategoryID, &t.CategoryName,
		&t.Priority, &t.Status, &t.ReporterID, &t.ReporterName,
		&assigneeID, &t.AssigneeName,
		&deptID, &t.DepartmentName,
		&deadlineVal, &createdAtVal, &updatedAtVal, &resolvedAtVal,
		&t.Rating, &t.RatingComment,
	)

	if err != nil {
		fmt.Printf("❌ ERROR GetTicketDetail ID %d: %v\n", ticketID, err)
		RespondError(w, http.StatusNotFound, fmt.Sprintf("Không tìm thấy thông tin ticket #%d", ticketID))
		return
	}

	if assigneeID.Valid {
		t.AssigneeID = &assigneeID.Int64
	}
	if deptID.Valid {
		t.DepartmentID = &deptID.Int64
	}

	t.CreatedAt = parseSQLiteTime(createdAtVal)
	t.UpdatedAt = parseSQLiteTime(updatedAtVal)

	if deadlineVal != nil {
		dTime := parseSQLiteTime(deadlineVal)
		if !dTime.IsZero() {
			t.Deadline = &dTime
		}
	}
	if resolvedAtVal != nil {
		rTime := parseSQLiteTime(resolvedAtVal)
		if !rTime.IsZero() {
			t.ResolvedAt = &rTime
		}
	}

	t.Attachments = []models.Attachment{}
	attRows, attErr := db.DB.Query(`
		SELECT a.id, a.ticket_id, a.file_name, a.file_path, a.file_type, a.file_size, a.uploaded_by, u.full_name, a.created_at
		FROM attachments a
		JOIN users u ON a.uploaded_by = u.id
		WHERE a.ticket_id = ? ORDER BY a.created_at DESC`, ticketID)
	if attErr == nil {
		defer attRows.Close()
		for attRows.Next() {
			var att models.Attachment
			attRows.Scan(&att.ID, &att.TicketID, &att.FileName, &att.FilePath, &att.FileType, &att.FileSize, &att.UploadedBy, &att.UploadedByName, &att.CreatedAt)
			t.Attachments = append(t.Attachments, att)
		}
	}

	RespondJSON(w, http.StatusOK, t)
}

func UpdateTicketStatusHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	claims := middleware.GetUserClaims(r)

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	ticketID, _ := strconv.ParseInt(pathParts[2], 10, 64)
	meta, denied := denyIfNoTicketAccess(w, r, ticketID)
	if denied {
		return
	}

	var req models.UpdateTicketStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	if !allowedTicketStatuses[req.Status] {
		RespondError(w, http.StatusBadRequest, "Trạng thái ticket không hợp lệ")
		return
	}

	ticketCode := meta.Code
	reporterID := meta.ReporterID
	oldStatus := meta.Status
	role := middleware.GetUserRole(r)
	if role == "employee" {
		if reporterID != userID || oldStatus != "open" || req.Status != "rejected" {
			RespondError(w, http.StatusForbidden, "Bạn chỉ có thể hủy ticket đang mở của chính mình")
			return
		}
	}

	if oldStatus == req.Status {
		RespondJSON(w, http.StatusOK, map[string]string{"message": "Trạng thái không đổi"})
		return
	}

	query := "UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP"
	if req.Status == "resolved" || req.Status == "closed" {
		query += ", resolved_at = CURRENT_TIMESTAMP"
	}
	query += " WHERE id = ?"

	_, err := db.DB.Exec(query, req.Status, ticketID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi cập nhật trạng thái")
		return
	}

	// Activity log
	actionDesc := fmt.Sprintf("Chuyển trạng thái từ [%s] ➔ [%s]", oldStatus, req.Status)
	db.DB.Exec("INSERT INTO activity_logs (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)",
		ticketID, userID, "Cập nhật trạng thái", actionDesc)

	// Realtime notification to reporter
	notifMsg := fmt.Sprintf("Ticket %s của bạn đã được chuyển sang trạng thái: %s bởi %s", ticketCode, req.Status, claims.FullName)
	db.DB.Exec("INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)",
		reporterID, "Cập nhật Ticket "+ticketCode, notifMsg, fmt.Sprintf("/tickets/%d", ticketID))

	ws.GlobalHub.SendToUser(reporterID, "STATUS_CHANGED", map[string]interface{}{
		"ticket_id": ticketID,
		"code":      ticketCode,
		"status":    req.Status,
		"message":   notifMsg,
	})

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Cập nhật trạng thái thành công"})
}

func AssignTicketHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	claims := middleware.GetUserClaims(r)

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	ticketID, _ := strconv.ParseInt(pathParts[2], 10, 64)
	meta, denied := denyIfNoTicketAccess(w, r, ticketID)
	if denied {
		return
	}
	if !isITStaff(r) {
		RespondError(w, http.StatusForbidden, "Chỉ bộ phận IT mới được phân công ticket")
		return
	}

	var req models.AssignTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	var assigneeName, assigneeRole string
	err := db.DB.QueryRow("SELECT full_name, role FROM users WHERE id = ? AND status = 'active'", req.AssigneeID).Scan(&assigneeName, &assigneeRole)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Người xử lý IT không tồn tại")
		return
	}
	if assigneeRole != "it_support" && assigneeRole != "admin" {
		RespondError(w, http.StatusBadRequest, "Chỉ có thể phân công cho tài khoản IT hoặc Admin")
		return
	}

	ticketCode := meta.Code

	_, err = db.DB.Exec("UPDATE tickets SET assignee_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.AssigneeID, ticketID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi phân công ticket")
		return
	}

	// Activity log
	db.DB.Exec("INSERT INTO activity_logs (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)",
		ticketID, userID, "Phân công Ticket", fmt.Sprintf("%s đã phân công cho %s", claims.FullName, assigneeName))

	// Notification to Assignee
	notifMsg := fmt.Sprintf("Bạn được %s phân công xử lý ticket %s", claims.FullName, ticketCode)
	db.DB.Exec("INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)",
		req.AssigneeID, "Ticket mới được phân công", notifMsg, fmt.Sprintf("/tickets/%d", ticketID))

	ws.GlobalHub.SendToUser(req.AssigneeID, "TICKET_ASSIGNED", map[string]interface{}{
		"ticket_id": ticketID,
		"code":      ticketCode,
		"message":   notifMsg,
	})

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Phân công ticket thành công"})
}

func GetActivityLogsHandler(w http.ResponseWriter, r *http.Request) {
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
		SELECT l.id, l.ticket_id, l.user_id, u.full_name, l.action, l.details, l.created_at
		FROM activity_logs l
		JOIN users u ON l.user_id = u.id
		WHERE l.ticket_id = ?
		ORDER BY l.created_at ASC`, ticketID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi lấy lịch sử thao tác")
		return
	}
	defer rows.Close()

	logs := []models.ActivityLog{}
	for rows.Next() {
		var logItem models.ActivityLog
		rows.Scan(&logItem.ID, &logItem.TicketID, &logItem.UserID, &logItem.UserName, &logItem.Action, &logItem.Details, &logItem.CreatedAt)
		logs = append(logs, logItem)
	}

	RespondJSON(w, http.StatusOK, logs)
}

func RateTicketHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	ticketID, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil || ticketID <= 0 {
		RespondError(w, http.StatusBadRequest, "ID Ticket không hợp lệ")
		return
	}

	meta, denied := denyIfNoTicketAccess(w, r, ticketID)
	if denied {
		return
	}
	if meta.ReporterID != userID {
		RespondError(w, http.StatusForbidden, "Chỉ người tạo ticket mới được đánh giá")
		return
	}
	if meta.Status != "resolved" && meta.Status != "closed" {
		RespondError(w, http.StatusBadRequest, "Chỉ đánh giá ticket đã xử lý xong")
		return
	}

	var req struct {
		Rating        int    `json:"rating"`
		RatingComment string `json:"rating_comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Rating < 1 || req.Rating > 5 {
		RespondError(w, http.StatusBadRequest, "Vui lòng chọn mức đánh giá từ 1 đến 5 sao")
		return
	}

	_, err = db.DB.Exec("UPDATE tickets SET rating = ?, rating_comment = ? WHERE id = ?",
		req.Rating, req.RatingComment, ticketID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi lưu đánh giá: "+err.Error())
		return
	}

	// Log activity
	db.DB.Exec("INSERT INTO activity_logs (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)",
		ticketID, userID, "Đánh giá chất lượng IT", fmt.Sprintf("Đánh giá %d/5 sao: %s", req.Rating, req.RatingComment))

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Cảm ơn bạn đã gửi đánh giá chất lượng hỗ trợ IT!"})
}
