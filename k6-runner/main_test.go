package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStartRunRejectsInvalidConfiguration(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "zero users", body: `{"vus":0,"durationSeconds":60}`},
		{name: "too many users", body: `{"vus":51,"durationSeconds":60}`},
		{name: "duration too short", body: `{"vus":2,"durationSeconds":9}`},
		{name: "unknown field", body: `{"vus":2,"durationSeconds":60,"script":"other.js"}`},
		{name: "extra JSON value", body: `{"vus":2,"durationSeconds":60} {}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			r := &runner{}
			request := httptest.NewRequest(http.MethodPost, "/api/runs", strings.NewReader(test.body))
			response := httptest.NewRecorder()
			r.startRun(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
			}
		})
	}
}

func TestRunnerRejectsConcurrentRun(t *testing.T) {
	r := &runner{run: &testRun{Status: "running"}}
	request := httptest.NewRequest(http.MethodPost, "/api/runs", strings.NewReader(`{"vus":2,"durationSeconds":60}`))
	response := httptest.NewRecorder()
	r.startRun(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, response.Code)
	}
}

func TestRunnerRequiresAllowedOriginForPost(t *testing.T) {
	handler := corsMiddleware("http://localhost:5173", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	request := httptest.NewRequest(http.MethodPost, "/api/runs", nil)
	request.Header.Set("Origin", "http://example.test")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, response.Code)
	}
}
