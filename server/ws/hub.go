package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" || origin == ""
	},
}

type Client struct {
	UserID int64
	Role   string
	Conn   *websocket.Conn
	Send   chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	userMap    map[int64][]*Client
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

var GlobalHub = NewHub()

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		userMap:    make(map[int64][]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.userMap[client.UserID] = append(h.userMap[client.UserID], client)
			h.mu.Unlock()
			log.Printf("[WS] User %d connected", client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)

				// Remove from userMap
				clients := h.userMap[client.UserID]
				for i, c := range clients {
					if c == client {
						h.userMap[client.UserID] = append(clients[:i], clients[i+1:]...)
						break
					}
				}
				if len(h.userMap[client.UserID]) == 0 {
					delete(h.userMap, client.UserID)
				}
			}
			h.mu.Unlock()
			log.Printf("[WS] User %d disconnected", client.UserID)
		}
	}
}

type WSEvent struct {
	Event   string      `json:"event"`
	Payload interface{} `json:"payload"`
}

func (h *Hub) SendToUser(userID int64, event string, payload interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	msg, err := json.Marshal(WSEvent{Event: event, Payload: payload})
	if err != nil {
		return
	}

	if clients, ok := h.userMap[userID]; ok {
		for _, c := range clients {
			select {
			case c.Send <- msg:
			default:
				close(c.Send)
				delete(h.clients, c)
			}
		}
	}
}

func (h *Hub) SendToRole(role string, event string, payload interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	msg, err := json.Marshal(WSEvent{Event: event, Payload: payload})
	if err != nil {
		return
	}

	for c := range h.clients {
		if c.Role == role {
			select {
			case c.Send <- msg:
			default:
				close(c.Send)
				delete(h.clients, c)
			}
		}
	}
}

func (h *Hub) BroadcastAll(event string, payload interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	msg, err := json.Marshal(WSEvent{Event: event, Payload: payload})
	if err != nil {
		return
	}

	for c := range h.clients {
		select {
		case c.Send <- msg:
		default:
			close(c.Send)
			delete(h.clients, c)
		}
	}
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, userID int64, role string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[WS Upgrade Error]:", err)
		return
	}

	client := &Client{
		UserID: userID,
		Role:   role,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}

	hub.register <- client

	// Writer pump
	go func() {
		defer func() {
			conn.Close()
		}()
		for message := range client.Send {
			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		}
	}()

	// Reader pump
	go func() {
		defer func() {
			hub.unregister <- client
			conn.Close()
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}
