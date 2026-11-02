package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const maxOutputBytes = 8192

type runConfig struct {
	VUs             int `json:"vus"`
	DurationSeconds int `json:"durationSeconds"`
}

type testRun struct {
	ID         string     `json:"id"`
	Status     string     `json:"status"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt,omitempty"`
	Config     runConfig  `json:"config"`
	Summary    *summary   `json:"summary,omitempty"`
	Error      string     `json:"error,omitempty"`
}

type summary struct {
	Metrics map[string]struct {
		Values map[string]float64 `json:"values"`
	} `json:"metrics"`
}

type runner struct {
	mu  sync.RWMutex
	run *testRun
}

type cappedBuffer struct {
	mu     sync.Mutex
	buffer bytes.Buffer
}

func (b *cappedBuffer) Write(value []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	length := len(value)
	if length > maxOutputBytes-b.buffer.Len() {
		value = value[:maxOutputBytes-b.buffer.Len()]
	}
	_, _ = b.buffer.Write(value)
	return length, nil
}

func (b *cappedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buffer.String()
}

func main() {
	mux := http.NewServeMux()
	r := &runner{}
	mux.HandleFunc("/api/runs", r.startRun)
	mux.HandleFunc("/api/runs/current", r.currentRun)

	origin := envOr("K6_UI_ORIGIN", "http://localhost:5173")
	handler := corsMiddleware(origin, mux)
	address := envOr("K6_RUNNER_ADDRESS", ":8090")
	log.Printf("k6 runner listening on %s", address)
	if err := http.ListenAndServe(address, handler); err != nil {
		log.Fatal(err)
	}
}

func (r *runner) currentRun(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]*testRun{"run": r.run})
}

func (r *runner) startRun(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	req.Body = http.MaxBytesReader(w, req.Body, 4096)
	decoder := json.NewDecoder(req.Body)
	decoder.DisallowUnknownFields()
	var config runConfig
	if err := decoder.Decode(&config); err != nil {
		writeError(w, http.StatusBadRequest, "request must contain valid JSON with vus and durationSeconds")
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "request must contain exactly one JSON object")
		return
	}
	if config.VUs < 1 || config.VUs > 50 {
		writeError(w, http.StatusBadRequest, "vus must be between 1 and 50")
		return
	}
	if config.DurationSeconds < 10 || config.DurationSeconds > 300 {
		writeError(w, http.StatusBadRequest, "durationSeconds must be between 10 and 300")
		return
	}

	run := &testRun{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Status:    "running",
		StartedAt: time.Now().UTC(),
		Config:    config,
	}
	r.mu.Lock()
	if r.run != nil && r.run.Status == "running" {
		r.mu.Unlock()
		writeError(w, http.StatusConflict, "a k6 test is already running")
		return
	}
	r.run = run
	responseRun := *run
	r.mu.Unlock()

	go r.execute(run)
	writeJSON(w, http.StatusAccepted, map[string]*testRun{"run": &responseRun})
}

func (r *runner) execute(run *testRun) {
	script := envOr("K6_SCRIPT", "/scripts/browse.js")
	summaryFile, err := os.CreateTemp("", "k6-summary-*.json")
	if err != nil {
		r.finish(run, nil, err)
		return
	}
	summaryPath := summaryFile.Name()
	if err := summaryFile.Close(); err != nil {
		_ = os.Remove(summaryPath)
		r.finish(run, nil, err)
		return
	}
	defer os.Remove(summaryPath)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(run.Config.DurationSeconds+120)*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "k6", "run", "--summary-export", summaryPath, script)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("K6_VUS=%d", run.Config.VUs),
		fmt.Sprintf("K6_DURATION_SECONDS=%d", run.Config.DurationSeconds),
	)
	var output cappedBuffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	runErr := cmd.Run()

	data, err := os.ReadFile(summaryPath)
	if err != nil {
		if runErr != nil {
			outputText := strings.TrimSpace(output.String())
			if outputText != "" {
				runErr = fmt.Errorf("%w: %s", runErr, outputText)
			}
			r.finish(run, nil, runErr)
			return
		}
		r.finish(run, nil, fmt.Errorf("could not read k6 summary: %w", err))
		return
	}
	var result summary
	if err := json.Unmarshal(data, &result); err != nil {
		r.finish(run, nil, fmt.Errorf("could not parse k6 summary: %w", err))
		return
	}
	if runErr != nil {
		outputText := strings.TrimSpace(output.String())
		if outputText != "" {
			runErr = fmt.Errorf("%w: %s", runErr, outputText)
		}
	}
	r.finish(run, &result, runErr)
}

func (r *runner) finish(run *testRun, result *summary, runErr error) {
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	run.FinishedAt = &now
	run.Summary = result
	if runErr != nil {
		run.Status = "failed"
		run.Error = runErr.Error()
		return
	}
	run.Status = "completed"
}

func corsMiddleware(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Header.Get("Origin") == origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if req.Method == http.MethodOptions {
			if req.Header.Get("Origin") != origin {
				writeError(w, http.StatusForbidden, "origin not allowed")
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if req.Method == http.MethodPost && req.Header.Get("Origin") != origin {
			writeError(w, http.StatusForbidden, "origin not allowed")
			return
		}
		next.ServeHTTP(w, req)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("could not write JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
