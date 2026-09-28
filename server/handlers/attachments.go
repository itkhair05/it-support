package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"
)

var AllowedExtensions = map[string]bool{
	".pdf":  true,
	".docx": true,
	".xlsx": true,
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".zip":  true,
}

func UploadAttachmentHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	claims := middleware.GetUserClaims(r)

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 {
		RespondError(w, http.StatusBadRequest, "URL không hợp lệ")
		return
	}
	ticketID, _ := strconv.ParseInt(pathParts[2], 10, 64)
	if _, denied := denyIfNoTicketAccess(w, r, ticketID); denied {
		return
	}

	// Hard cap the request body so oversized uploads are rejected early
	r.Body = http.MaxBytesReader(w, r.Body, 20<<20)

	// Parse multipart form (max 20MB)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		RespondError(w, http.StatusBadRequest, "Tệp tải lên quá lớn (tối đa 20MB) hoặc dữ liệu không hợp lệ")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Không tìm thấy tệp đính kèm trong request")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !AllowedExtensions[ext] {
		RespondError(w, http.StatusBadRequest, "Định dạng tệp không được hỗ trợ. Chỉ hỗ trợ PDF, DOCX, XLSX, PNG, JPG, ZIP")
		return
	}

	safeName := filepath.Base(header.Filename)
	if safeName == "." || safeName == ".." || strings.TrimSpace(safeName) == "" {
		safeName = "file" + ext
	}

	// Create unique filename
	os.MkdirAll("uploads", 0755)
	uniqueName := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dstPath := filepath.Join("uploads", uniqueName)

	dst, err := os.Create(dstPath)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi tạo tệp trên server")
		return
	}
	defer dst.Close()

	fileSize, err := io.Copy(dst, file)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi ghi tệp đính kèm")
		return
	}

	webPath := "/uploads/" + uniqueName

	res, err := db.DB.Exec(`
		INSERT INTO attachments (ticket_id, file_name, file_path, file_type, file_size, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		ticketID, safeName, webPath, header.Header.Get("Content-Type"), fileSize, userID)

	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Lỗi khi lưu thông tin tệp vào CSDL")
		return
	}

	attID, _ := res.LastInsertId()

	// Activity log
	db.DB.Exec("INSERT INTO activity_logs (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)",
		ticketID, userID, "Đính kèm Tệp", fmt.Sprintf("%s đã đính kèm tệp: %s", claims.FullName, safeName))

	RespondJSON(w, http.StatusCreated, models.Attachment{
		ID:             attID,
		TicketID:       ticketID,
		FileName:       safeName,
		FilePath:       webPath,
		FileType:       header.Header.Get("Content-Type"),
		FileSize:       fileSize,
		UploadedBy:     userID,
		UploadedByName: claims.FullName,
		CreatedAt:      time.Now(),
	})
}
