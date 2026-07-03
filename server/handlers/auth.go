package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"

	"golang.org/x/crypto/bcrypt"
)

func RespondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func RespondError(w http.ResponseWriter, status int, message string) {
	RespondJSON(w, status, map[string]string{"error": message})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu yêu cầu không hợp lệ")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	var deptID sqlNullInt64

	err := db.DB.QueryRow(`
		SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.department_id, COALESCE(d.name, ''), u.status, u.avatar_url, u.created_at
		FROM users u
		LEFT JOIN departments d ON u.department_id = d.id
		WHERE u.email = ?`, req.Email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.FullName, &user.Role, &deptID, &user.DepartmentName, &user.Status, &user.AvatarURL, &user.CreatedAt,
	)

	if err != nil {
		RespondError(w, http.StatusUnauthorized, "Email hoặc mật khẩu không chính xác")
		return
	}

	if deptID.Valid {
		user.DepartmentID = &deptID.Int64
	}

	if user.Status == "locked" {
		RespondError(w, http.StatusForbidden, "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		RespondError(w, http.StatusUnauthorized, "Email hoặc mật khẩu không chính xác")
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Email, user.Role, user.FullName)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Không thể tạo mã xác thực JWT")
		return
	}

	RespondJSON(w, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  user,
	})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)

	if req.Email == "" || req.Password == "" || req.FullName == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng điền đầy đủ họ tên, email và mật khẩu")
		return
	}

	if len(req.Password) < 5 {
		RespondError(w, http.StatusBadRequest, "Mật khẩu phải có ít nhất 5 ký tự")
		return
	}

	// Check email already exists
	var existingID int64
	err := db.DB.QueryRow("SELECT id FROM users WHERE email = ?", req.Email).Scan(&existingID)
	if err == nil {
		RespondError(w, http.StatusConflict, "Email này đã được sử dụng. Vui lòng dùng email khác.")
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi tạo tài khoản")
		return
	}

	res, err := db.DB.Exec(`
		INSERT INTO users (email, password_hash, full_name, role, status)
		VALUES (?, ?, ?, 'employee', 'active')`, req.Email, string(hashed), req.FullName)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi tạo tài khoản")
		return
	}

	userID, _ := res.LastInsertId()

	token, err := middleware.GenerateToken(userID, req.Email, "employee", req.FullName)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Tài khoản đã tạo nhưng lỗi xác thực")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":        userID,
			"email":     req.Email,
			"full_name": req.FullName,
			"role":      "employee",
			"status":    "active",
		},
		"message": "Đăng ký thành công! Chào mừng bạn đến với HelpDesk IT.",
	})
}

func GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var user models.User
	var deptID sqlNullInt64

	err := db.DB.QueryRow(`
		SELECT u.id, u.email, u.full_name, u.role, u.department_id, COALESCE(d.name, ''), u.status, u.avatar_url, u.created_at
		FROM users u
		LEFT JOIN departments d ON u.department_id = d.id
		WHERE u.id = ?`, userID).Scan(
		&user.ID, &user.Email, &user.FullName, &user.Role, &deptID, &user.DepartmentName, &user.Status, &user.AvatarURL, &user.CreatedAt,
	)

	if err != nil {
		RespondError(w, http.StatusNotFound, "Không tìm thấy người dùng")
		return
	}

	if deptID.Valid {
		user.DepartmentID = &deptID.Int64
	}

	RespondJSON(w, http.StatusOK, user)
}

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		FullName  string `json:"full_name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	_, err := db.DB.Exec("UPDATE users SET full_name = ?, avatar_url = ? WHERE id = ?", req.FullName, req.AvatarURL, userID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi cập nhật hồ sơ")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Cập nhật hồ sơ thành công"})
}

func ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	var hashPass string
	err := db.DB.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&hashPass)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Không tìm thấy tài khoản")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashPass), []byte(req.OldPassword)); err != nil {
		RespondError(w, http.StatusBadRequest, "Mật khẩu hiện tại không đúng")
		return
	}

	newHash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	_, err = db.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(newHash), userID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi đổi mật khẩu")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Đổi mật khẩu thành công"})
}

type sqlNullInt64 struct {
	Int64 int64
	Valid bool
}

func (n *sqlNullInt64) Scan(value interface{}) error {
	if value == nil {
		n.Int64, n.Valid = 0, false
		return nil
	}
	n.Valid = true
	switch v := value.(type) {
	case int64:
		n.Int64 = v
	case int:
		n.Int64 = int64(v)
	}
	return nil
}
