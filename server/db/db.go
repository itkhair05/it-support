package db

import (
	"database/sql"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) {
	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Failed to open SQLite database: %v", err)
	}

	// Enable Foreign Keys & Write-Ahead Logging for performance
	if _, err := DB.Exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;"); err != nil {
		log.Printf("Warning setting PRAGMA: %v", err)
	}

	createTables()
	seedData()
	log.Println("Database initialized successfully!")
}

func createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS departments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		description TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		full_name TEXT NOT NULL,
		role TEXT NOT NULL CHECK(role IN ('employee', 'it_support', 'admin')),
		department_id INTEGER,
		status TEXT DEFAULT 'active' CHECK(status IN ('active', 'locked')),
		avatar_url TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS categories (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		icon TEXT DEFAULT '',
		description TEXT DEFAULT ''
	);

	CREATE TABLE IF NOT EXISTS tickets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		category_id INTEGER NOT NULL,
		priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
		status TEXT NOT NULL CHECK(status IN ('open', 'assigned', 'in_progress', 'waiting', 'resolved', 'closed', 'rejected')),
		reporter_id INTEGER NOT NULL,
		assignee_id INTEGER,
		department_id INTEGER,
		deadline DATETIME,
		rating INTEGER DEFAULT 0,
		rating_comment TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		resolved_at DATETIME,
		FOREIGN KEY(category_id) REFERENCES categories(id),
		FOREIGN KEY(reporter_id) REFERENCES users(id),
		FOREIGN KEY(assignee_id) REFERENCES users(id),
		FOREIGN KEY(department_id) REFERENCES departments(id)
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ticket_id INTEGER NOT NULL,
		file_name TEXT NOT NULL,
		file_path TEXT NOT NULL,
		file_type TEXT NOT NULL,
		file_size INTEGER NOT NULL,
		uploaded_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
		FOREIGN KEY(uploaded_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS comments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ticket_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		parent_id INTEGER,
		content TEXT NOT NULL,
		is_internal BOOLEAN DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
		FOREIGN KEY(user_id) REFERENCES users(id),
		FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS assets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		asset_tag TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		category TEXT NOT NULL,
		serial_number TEXT DEFAULT '',
		status TEXT DEFAULT 'active' CHECK(status IN ('active', 'repairing', 'decommissioned')),
		assigned_to_user_id INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS activity_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ticket_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		action TEXT NOT NULL,
		details TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		link TEXT DEFAULT '',
		is_read BOOLEAN DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);`

	_, err := DB.Exec(schema)
	if err != nil {
		log.Fatalf("Failed to execute database schema: %v", err)
	}

	// Safe migrations
	DB.Exec("ALTER TABLE tickets ADD COLUMN asset_id INTEGER")
	DB.Exec("ALTER TABLE comments ADD COLUMN is_internal BOOLEAN DEFAULT 0")
}

func seedData() {
	// Seed Departments
	depts := []struct {
		name string
		desc string
	}{
		{"Ban Giám đốc (Executive)", "Ban Điều hành & Quản trị doanh nghiệp"},
		{"Phòng Công nghệ thông tin (IT)", "Quản lý hạ tầng, hệ thống & phần mềm"},
		{"Phòng Nhân sự (HR)", "Quản trị nhân sự & tuyển dụng"},
		{"Phòng Kinh doanh (Sales)", "Phát triển thị trường & doanh số"},
		{"Phòng Marketing", "Quảng bá thương hiệu & truyền thông"},
		{"Phòng Kế toán (Accounting)", "Quản lý tài chính & kế toán"},
	}

	for _, d := range depts {
		DB.Exec("INSERT OR IGNORE INTO departments (name, description) VALUES (?, ?)", d.name, d.desc)
	}

	// Guarantee "Ban Giám đốc (Executive)" exists and assign it directly to all Admin users
	var execDeptID int64
	err := DB.QueryRow("SELECT id FROM departments WHERE name LIKE '%Giám đốc%' LIMIT 1").Scan(&execDeptID)
	if err != nil || execDeptID == 0 {
		res, _ := DB.Exec("INSERT INTO departments (name, description) VALUES ('Ban Giám đốc (Executive)', 'Ban Điều hành & Quản trị doanh nghiệp')")
		execDeptID, _ = res.LastInsertId()
	}

	if execDeptID > 0 {
		DB.Exec("UPDATE users SET department_id = ? WHERE role = 'admin'", execDeptID)
	}

	// Seed Categories
	cats := []struct {
		name string
		icon string
		desc string
	}{
		{"Máy tính", "Laptop", "Máy tính bàn, Laptop, phụ kiện bàn phím chuột"},
		{"Máy in", "Printer", "Máy in văn phòng, kẹt giấy, hết mực"},
		{"Email", "Mail", "Email công ty, Outlook, cấp lại mật khẩu email"},
		{"Website", "Globe", "Hệ thống Web nội bộ, cổng thông tin"},
		{"Internet", "Wifi", "Mạng Wifi, Mạng dây LAN, VPN công ty"},
		{"Phần mềm", "AppWindow", "Phần mềm văn phòng, bản quyền, cài đặt mới"},
		{"Tài khoản", "UserCheck", "Tài khoản đăng nhập PC, phần mềm, ERP"},
		{"Khác", "HelpCircle", "Các yêu cầu hỗ trợ IT khác"},
	}

	for _, c := range cats {
		DB.Exec("INSERT OR IGNORE INTO categories (name, icon, description) VALUES (?, ?, ?)", c.name, c.icon, c.desc)
	}

	// Seed only admin account — the single default account
	hashPass := func(pass string) string {
		bytes, _ := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
		return string(bytes)
	}

	adminEmail := "admin@company.com"
	var adminCount int
	DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = ?", adminEmail).Scan(&adminCount)
	if adminCount == 0 {
		adminHash := hashPass("12345")
		DB.Exec(`INSERT INTO users (email, password_hash, full_name, role, department_id, status)
			VALUES (?, ?, ?, 'admin', 1, 'active')`, adminEmail, adminHash, "Quản trị viên Hệ thống")
	}

	// Create uploads directory
	os.MkdirAll("uploads", 0755)
}
