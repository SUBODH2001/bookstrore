package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// Define the structure of the incoming JSON data
type ActivityLog struct {
	Action  string                 `json:"action"`
	Details map[string]interface{} `json:"details"`
}

var db *sql.DB

func main() {
	// 1. Load Environment Variables
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// 2. Connect to PostgreSQL
	dbPassword := os.Getenv("DB_PASSWORD")
	connStr := fmt.Sprintf("host=localhost port=5432 user=postgres password=%s dbname=mystore sslmode=disable", dbPassword)

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// 3. Set up the HTTP Route
	http.HandleFunc("/log-activity", handleLogActivity)

	fmt.Println("🚀 Go Telemetry Microservice running on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleLogActivity(w http.ResponseWriter, r *http.Request) {
	// CORS Headers: Allow the frontend on port 5000/Live Server to talk to this port
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Header.Get("Authorization")
	if token == "" {
		// Silent ignore for ghost activity
		w.WriteHeader(http.StatusOK)
		return
	}

	// Parse the incoming JSON body
	var logData ActivityLog
	if err := json.NewDecoder(r.Body).Decode(&logData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Convert the details map back to a JSON string for PostgreSQL
	detailsJSON, _ := json.Marshal(logData.Details)

	// 🔥 THE MAGIC: Fire and Forget!
	// This spins off a lightweight background thread to handle the database insert.
	go saveLogToDB(token, logData.Action, string(detailsJSON))

	// Instantly reply to the frontend so it doesn't have to wait for the database
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "logged asynchronously"})
}

func saveLogToDB(token string, action string, details string) {
	// 1. Find the user ID from the token
	var userID int
	err := db.QueryRow("SELECT user_id FROM sessions WHERE token = $1", token).Scan(&userID)
	if err != nil {
		// Invalid session or token not found
		return
	}

	// 2. Insert the log
	_, err = db.Exec("INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)", userID, action, details)
	if err != nil {
		log.Printf("Failed to insert activity log: %v", err)
	}
}
