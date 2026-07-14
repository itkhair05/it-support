package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
)

type Asset struct {
	ID               int64  `json:"id"`
	AssetTag         string `json:"asset_tag"`
	Name             string `json:"name"`
	Category         string `json:"category"`
	SerialNumber     string `json:"serial_number"`
	Status           string `json:"status"` // "active", "repairing", "decommissioned"
	AssignedToUserID *int64 `json:"assigned_to_user_id,omitempty"`
	AssignedToName   string `json:"assigned_to_name,omitempty"`
}

func ListAssetsHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	assignedToMe := r.URL.Query().Get("assigned_to_me")

	query := `
		SELECT a.id, a.asset_tag, a.name, a.category, a.serial_number, a.status, a.assigned_to_user_id, COALESCE(u.full_name, '')
		FROM assets a
		LEFT JOIN users u ON a.assigned_to_user_id = u.id`

	args := []interface{}{}
	if role == "employee" || assignedToMe == "true" {
		query += " WHERE a.assigned_to_user_id = ?"
		args = append(args, userID)
	}
	query += " ORDER BY a.asset_tag ASC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi lấy danh sách tài sản IT: "+err.Error())
		return
	}
	defer rows.Close()

	assets := []Asset{}
	for rows.Next() {
		var a Asset
		var uID sqlNullInt64
		rows.Scan(&a.ID, &a.AssetTag, &a.Name, &a.Category, &a.SerialNumber, &a.Status, &uID, &a.AssignedToName)
		if uID.Valid {
			a.AssignedToUserID = &uID.Int64
		}
		assets = append(assets, a)
	}

	RespondJSON(w, http.StatusOK, assets)
}

func CreateAssetHandler(w http.ResponseWriter, r *http.Request) {
	var req Asset
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	if strings.TrimSpace(req.AssetTag) == "" || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Category) == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng nhập Mã tài sản, Tên thiết bị và Danh mục")
		return
	}

	if req.Status == "" {
		req.Status = "active"
	}

	var assignedToVal interface{} = nil
	if req.AssignedToUserID != nil && *req.AssignedToUserID > 0 {
		assignedToVal = *req.AssignedToUserID
	}

	res, err := db.DB.Exec(`
		INSERT INTO assets (asset_tag, name, category, serial_number, status, assigned_to_user_id)
		VALUES (?, ?, ?, ?, ?, ?)`,
		req.AssetTag, req.Name, req.Category, req.SerialNumber, req.Status, assignedToVal)

	if err != nil {
		RespondError(w, http.StatusBadRequest, "Mã tài sản IT đã tồn tại hoặc dữ liệu không hợp lệ: "+err.Error())
		return
	}

	id, _ := res.LastInsertId()
	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      id,
		"message": "Thêm tài sản IT thành công",
	})
}

func DeleteAssetHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	assetID, _ := strconv.ParseInt(pathParts[2], 10, 64)

	_, err := db.DB.Exec("DELETE FROM assets WHERE id = ?", assetID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi xóa tài sản IT")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Xóa tài sản IT thành công",
	})
}

func UpdateAssetStatusHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	var assetID int64
	for i, part := range parts {
		if part == "assets" && i+1 < len(parts) {
			assetID, _ = strconv.ParseInt(parts[i+1], 10, 64)
			break
		}
	}

	if assetID <= 0 {
		RespondError(w, http.StatusBadRequest, "ID Tài sản IT không hợp lệ")
		return
	}

	var req struct {
		Status           string `json:"status"`
		AssignedToUserID *int64 `json:"assigned_to_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	if strings.TrimSpace(req.Status) == "" {
		RespondError(w, http.StatusBadRequest, "Vui lòng chọn trạng thái mới")
		return
	}

	if req.AssignedToUserID != nil {
		var assignedToVal interface{} = nil
		if *req.AssignedToUserID > 0 {
			assignedToVal = *req.AssignedToUserID
		}
		_, err := db.DB.Exec("UPDATE assets SET status = ?, assigned_to_user_id = ? WHERE id = ?", req.Status, assignedToVal, assetID)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "Lỗi cập nhật tài sản IT: "+err.Error())
			return
		}
	} else {
		_, err := db.DB.Exec("UPDATE assets SET status = ? WHERE id = ?", req.Status, assetID)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "Lỗi cập nhật trạng thái tài sản IT: "+err.Error())
			return
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":      assetID,
		"status":  req.Status,
		"message": "Cập nhật trạng thái tài sản IT thành công",
	})
}
