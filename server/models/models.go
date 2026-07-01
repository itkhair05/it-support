package models

import "time"

type Department struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type User struct {
	ID             int64     `json:"id"`
	Email          string    `json:"email"`
	PasswordHash   string    `json:"-"`
	FullName       string    `json:"full_name"`
	Role           string    `json:"role"` // "employee", "it_support", "admin"
	DepartmentID   *int64    `json:"department_id"`
	DepartmentName string    `json:"department_name,omitempty"`
	Status         string    `json:"status"` // "active", "locked"
	AvatarURL      string    `json:"avatar_url"`
	CreatedAt      time.Time `json:"created_at"`
}

type Category struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description"`
}

type Ticket struct {
	ID             int64         `json:"id"`
	Code           string        `json:"code"`
	Title          string        `json:"title"`
	Description    string        `json:"description"`
	CategoryID     int64         `json:"category_id"`
	CategoryName   string        `json:"category_name,omitempty"`
	Priority       string        `json:"priority"` // "low", "medium", "high", "urgent"
	Status         string        `json:"status"`   // "open", "assigned", "in_progress", "waiting", "resolved", "closed", "rejected"
	ReporterID     int64         `json:"reporter_id"`
	ReporterName   string        `json:"reporter_name,omitempty"`
	AssigneeID     *int64        `json:"assignee_id"`
	AssigneeName   string        `json:"assignee_name,omitempty"`
	DepartmentID   *int64        `json:"department_id"`
	DepartmentName string        `json:"department_name,omitempty"`
	Deadline       *time.Time    `json:"deadline,omitempty"`
	Rating         int           `json:"rating,omitempty"`
	RatingComment  string        `json:"rating_comment,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
	ResolvedAt     *time.Time    `json:"resolved_at,omitempty"`
	Attachments    []Attachment  `json:"attachments,omitempty"`
	CommentsCount  int           `json:"comments_count,omitempty"`
}

type Attachment struct {
	ID             int64     `json:"id"`
	TicketID       int64     `json:"ticket_id"`
	FileName       string    `json:"file_name"`
	FilePath       string    `json:"file_path"`
	FileType       string    `json:"file_type"`
	FileSize       int64     `json:"file_size"`
	UploadedBy     int64     `json:"uploaded_by"`
	UploadedByName string    `json:"uploaded_by_name,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type Comment struct {
	ID         int64     `json:"id"`
	TicketID   int64     `json:"ticket_id"`
	UserID     int64     `json:"user_id"`
	UserName   string    `json:"user_name,omitempty"`
	UserRole   string    `json:"user_role,omitempty"`
	UserAvatar string    `json:"user_avatar,omitempty"`
	ParentID   *int64    `json:"parent_id,omitempty"`
	Content    string    `json:"content"`
	IsInternal bool      `json:"is_internal"`
	CreatedAt  time.Time `json:"created_at"`
}

type ActivityLog struct {
	ID        int64     `json:"id"`
	TicketID  int64     `json:"ticket_id"`
	UserID    int64     `json:"user_id"`
	UserName  string    `json:"user_name,omitempty"`
	Action    string    `json:"action"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

type Notification struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Link      string    `json:"link"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type CreateTicketRequest struct {
	Title        string `json:"title"`
	Description  string `json:"description"`
	CategoryID   int64  `json:"category_id"`
	Priority     string `json:"priority"`
	DepartmentID *int64 `json:"department_id,omitempty"`
	AssetID      *int64 `json:"asset_id,omitempty"`
}

type UpdateTicketStatusRequest struct {
	Status string `json:"status"`
}

type AssignTicketRequest struct {
	AssigneeID int64 `json:"assignee_id"`
}

type CreateCommentRequest struct {
	Content    string `json:"content"`
	ParentID   *int64 `json:"parent_id,omitempty"`
	IsInternal bool   `json:"is_internal,omitempty"`
}

type AdminCreateUserRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	FullName     string `json:"full_name"`
	Role         string `json:"role"`
	DepartmentID *int64 `json:"department_id"`
}

type StatsSummary struct {
	TotalTickets     int            `json:"total_tickets"`
	OpenTickets      int            `json:"open_tickets"`
	AssignedTickets  int            `json:"assigned_tickets"`
	InProgress       int            `json:"in_progress"`
	Waiting          int            `json:"waiting"`
	ResolvedTickets  int            `json:"resolved_tickets"`
	ClosedTickets    int            `json:"closed_tickets"`
	RejectedTickets  int            `json:"rejected_tickets"`
	UrgentTickets    int            `json:"urgent_tickets"`
	OverdueTickets   int            `json:"overdue_tickets"`
	ByMonth          []MonthStat    `json:"by_month"`
	ByDepartment     []DeptStat     `json:"by_department"`
	ByPriority       []PriorityStat `json:"by_priority"`
	ByStatus         []StatusStat   `json:"by_status"`
}

type MonthStat struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type DeptStat struct {
	DepartmentName string `json:"department_name"`
	Count          int    `json:"count"`
}

type PriorityStat struct {
	Priority string `json:"priority"`
	Count    int    `json:"count"`
}

type StatusStat struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}
