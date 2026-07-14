package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"helpdesk-server/db"
	"helpdesk-server/models"
)

func ListDepartmentsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query("SELECT id, name, COALESCE(description, ''), created_at FROM departments ORDER BY name ASC")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi lấy danh sách phòng ban")
		return
	}
	defer rows.Close()

	depts := []models.Department{}
	for rows.Next() {
		var d models.Department
		rows.Scan(&d.ID, &d.Name, &d.Description, &d.CreatedAt)
		depts = append(depts, d)
	}

	RespondJSON(w, http.StatusOK, depts)
}

func CreateDepartmentHandler(w http.ResponseWriter, r *http.Request) {
	var req models.Department
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng nhập tên phòng ban")
		return
	}

	res, err := db.DB.Exec("INSERT INTO departments (name, description) VALUES (?, ?)", req.Name, req.Description)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Tên phòng ban đã tồn tại")
		return
	}

	id, _ := res.LastInsertId()
	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      id,
		"message": "Thêm phòng ban thành công",
	})
}

func UpdateDepartmentHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	deptID, _ := strconv.ParseInt(pathParts[2], 10, 64)

	var req models.Department
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng nhập tên phòng ban")
		return
	}

	_, err := db.DB.Exec("UPDATE departments SET name = ?, description = ? WHERE id = ?", req.Name, req.Description, deptID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi cập nhật phòng ban")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Cập nhật phòng ban thành công"})
}

func DeleteDepartmentHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	deptID, _ := strconv.ParseInt(pathParts[2], 10, 64)

	_, err := db.DB.Exec("DELETE FROM departments WHERE id = ?", deptID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi xóa phòng ban")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Xóa phòng ban thành công"})
}

func ListCategoriesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query("SELECT id, name, icon, description FROM categories ORDER BY id ASC")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi lấy danh mục IT")
		return
	}
	defer rows.Close()

	cats := []models.Category{}
	for rows.Next() {
		var c models.Category
		rows.Scan(&c.ID, &c.Name, &c.Icon, &c.Description)
		cats = append(cats, c)
	}

	RespondJSON(w, http.StatusOK, cats)
}
