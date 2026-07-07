package handlers

import (
	"net/http"
	"time"

	"helpdesk-server/db"
	"helpdesk-server/middleware"
	"helpdesk-server/models"
)

func GetDashboardStatsHandler(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)

	var stats models.StatsSummary

	if role == "employee" {
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE reporter_id = ?", userID).Scan(&stats.TotalTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE reporter_id = ? AND status = 'open'", userID).Scan(&stats.OpenTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE reporter_id = ? AND status = 'in_progress'", userID).Scan(&stats.InProgress)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE reporter_id = ? AND status IN ('resolved', 'closed')", userID).Scan(&stats.ResolvedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE reporter_id = ? AND status = 'rejected'", userID).Scan(&stats.RejectedTickets)
	} else if role == "it_support" {
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE assignee_id = ?", userID).Scan(&stats.AssignedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE assignee_id = ? AND status = 'in_progress'", userID).Scan(&stats.InProgress)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE assignee_id = ? AND status IN ('resolved', 'closed')", userID).Scan(&stats.ResolvedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE (assignee_id = ? OR assignee_id IS NULL) AND priority IN ('high', 'urgent')", userID).Scan(&stats.UrgentTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE (assignee_id = ? OR assignee_id IS NULL) AND status NOT IN ('resolved', 'closed', 'rejected') AND deadline < ?", userID, time.Now()).Scan(&stats.OverdueTickets)
	} else {
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets").Scan(&stats.TotalTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'open'").Scan(&stats.OpenTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'assigned'").Scan(&stats.AssignedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'in_progress'").Scan(&stats.InProgress)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'waiting'").Scan(&stats.Waiting)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'resolved'").Scan(&stats.ResolvedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'closed'").Scan(&stats.ClosedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'rejected'").Scan(&stats.RejectedTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE priority = 'urgent'").Scan(&stats.UrgentTickets)
		db.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status NOT IN ('resolved', 'closed', 'rejected') AND deadline < ?", time.Now()).Scan(&stats.OverdueTickets)
	}

	ticketFilter := ""
	filterArgs := []interface{}{}
	if role == "employee" {
		ticketFilter = " WHERE reporter_id = ?"
		filterArgs = append(filterArgs, userID)
	} else if role == "it_support" {
		ticketFilter = " WHERE (assignee_id = ? OR assignee_id IS NULL)"
		filterArgs = append(filterArgs, userID)
	}

	stats.ByPriority = []models.PriorityStat{}
	if pRows, err := db.DB.Query("SELECT priority, COUNT(*) FROM tickets"+ticketFilter+" GROUP BY priority", filterArgs...); err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var ps models.PriorityStat
			pRows.Scan(&ps.Priority, &ps.Count)
			stats.ByPriority = append(stats.ByPriority, ps)
		}
	}

	stats.ByStatus = []models.StatusStat{}
	if sRows, err := db.DB.Query("SELECT status, COUNT(*) FROM tickets"+ticketFilter+" GROUP BY status", filterArgs...); err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var ss models.StatusStat
			sRows.Scan(&ss.Status, &ss.Count)
			stats.ByStatus = append(stats.ByStatus, ss)
		}
	}

	deptWhere := "1=1"
	deptArgs := []interface{}{}
	if role == "employee" {
		deptWhere = "t.reporter_id = ?"
		deptArgs = append(deptArgs, userID)
	} else if role == "it_support" {
		deptWhere = "(t.assignee_id = ? OR t.assignee_id IS NULL)"
		deptArgs = append(deptArgs, userID)
	}
	stats.ByDepartment = []models.DeptStat{}
	if dRows, err := db.DB.Query(`
		SELECT COALESCE(d.name, 'Chưa gán'), COUNT(t.id)
		FROM tickets t
		LEFT JOIN departments d ON t.department_id = d.id
		WHERE `+deptWhere+`
		GROUP BY d.name`, deptArgs...); err == nil {
		defer dRows.Close()
		for dRows.Next() {
			var ds models.DeptStat
			dRows.Scan(&ds.DepartmentName, &ds.Count)
			stats.ByDepartment = append(stats.ByDepartment, ds)
		}
	}

	stats.ByMonth = []models.MonthStat{}
	if mRows, err := db.DB.Query(`
		SELECT strftime('%Y-%m', created_at) as m, COUNT(*)
		FROM tickets`+ticketFilter+`
		GROUP BY m
		ORDER BY m DESC
		LIMIT 6`, filterArgs...); err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var ms models.MonthStat
			mRows.Scan(&ms.Month, &ms.Count)
			stats.ByMonth = append(stats.ByMonth, ms)
		}
	}

	RespondJSON(w, http.StatusOK, stats)
}
