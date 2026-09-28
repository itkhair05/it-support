package handlers

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"strings"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"

	"golang.org/x/crypto/bcrypt"
)

func ListUsersHandler(w http.ResponseWriter, r *http.Request) {
	roleFilter := r.URL.Query().Get("role")
	requesterRole := middleware.GetUserRole(r)
	// The list powers the @mention menu for every user, but contact
	// details are only exposed to IT staff and admins.
	includeContact := requesterRole == "admin" || requesterRole == "it_support"

	query := `
		SELECT u.id, u.email, u.full_name, u.role, u.department_id, COALESCE(d.name, ''), u.status, u.avatar_url, u.created_at
		FROM users u
		LEFT JOIN departments d ON u.department_id = d.id`

	args := []interface{}{}
	if roleFilter != "" {
		query += " WHERE u.role = ?"
		args = append(args, roleFilter)
	}
	query += " ORDER BY u.created_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi lấy danh sách user: "+err.Error())
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		var deptID sqlNullInt64
		rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &deptID, &u.DepartmentName, &u.Status, &u.AvatarURL, &u.CreatedAt)
		if deptID.Valid {
			u.DepartmentID = &deptID.Int64
		}
		if !includeContact {
			u.Email = ""
		}
		users = append(users, u)
	}

	RespondJSON(w, http.StatusOK, users)
}

func AdminCreateUserHandler(w http.ResponseWriter, r *http.Request) {
	var req models.AdminCreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	if req.Email == "" || req.Password == "" || req.FullName == "" || req.Role == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng điền đầy đủ các thông tin bắt buộc")
		return
	}

	if req.Role != "employee" && req.Role != "it_support" && req.Role != "admin" {
		RespondError(w, http.StatusBadRequest, "Vai trò không hợp lệ")
		return
	}

	if len(req.Password) < 5 {
		RespondError(w, http.StatusBadRequest, "Mật khẩu phải có ít nhất 5 ký tự")
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi mã hóa mật khẩu")
		return
	}

	res, err := db.DB.Exec(`
		INSERT INTO users (email, password_hash, full_name, role, department_id, status)
		VALUES (?, ?, ?, ?, ?, 'active')`,
		req.Email, string(hashed), req.FullName, req.Role, req.DepartmentID)

	if err != nil {
		RespondError(w, http.StatusBadRequest, "Email đã được sử dụng hoặc dữ liệu không hợp lệ")
		return
	}

	userID, _ := res.LastInsertId()
	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      userID,
		"message": "Tạo tài khoản người dùng thành công",
	})
}

func extractUserIDFromAdminPath(r *http.Request) int64 {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	for i, part := range parts {
		if part == "users" && i+1 < len(parts) {
			if id, err := strconv.ParseInt(parts[i+1], 10, 64); err == nil {
				return id
			}
		}
	}
	return 0
}

func AdminToggleUserStatusHandler(w http.ResponseWriter, r *http.Request) {
	actorID := middleware.GetUserID(r)
	userID := extractUserIDFromAdminPath(r)
	if userID <= 0 {
		RespondError(w, http.StatusBadRequest, "ID người dùng không hợp lệ")
		return
	}
	if userID == actorID {
		RespondError(w, http.StatusBadRequest, "Bạn không thể khóa chính tài khoản đang đăng nhập")
		return
	}

	var currentStatus string
	err := db.DB.QueryRow("SELECT status FROM users WHERE id = ?", userID).Scan(&currentStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Không tìm thấy người dùng trong CSDL")
		return
	}

	newStatus := "locked"
	if currentStatus == "locked" {
		newStatus = "active"
	}

	db.DB.Exec("UPDATE users SET status = ? WHERE id = ?", newStatus, userID)
	RespondJSON(w, http.StatusOK, map[string]string{
		"status":  newStatus,
		"message": "Đã chuyển trạng thái tài khoản thành " + newStatus,
	})
}

// generateTempPassword returns a random password from an unambiguous
// character set. It is shown to the admin once and the user should change
// it after signing in.
func generateTempPassword(length int) string {
	const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, length)
	for i := range b {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			idx = big.NewInt(0)
		}
		b[i] = charset[idx.Int64()]
	}
	return string(b)
}

func AdminResetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	userID := extractUserIDFromAdminPath(r)
	if userID <= 0 {
		RespondError(w, http.StatusBadRequest, "ID người dùng không hợp lệ")
		return
	}

	newPassword := generateTempPassword(10)
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi mã hóa mật khẩu")
		return
	}
	res, err := db.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hashed), userID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi đặt lại mật khẩu")
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		RespondError(w, http.StatusNotFound, "Không tìm thấy người dùng trong CSDL")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message":      "Đã tạo mật khẩu tạm thời. Hãy gửi cho người dùng và yêu cầu họ đổi mật khẩu sau khi đăng nhập.",
		"new_password": newPassword,
	})
}
