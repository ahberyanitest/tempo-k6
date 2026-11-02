FROM golang:1.24-alpine AS build
WORKDIR /src
COPY k6-runner/go.mod ./
COPY k6-runner/main.go ./
RUN CGO_ENABLED=0 go build -o /k6-runner .

FROM grafana/k6:2.3.0
COPY --from=build /k6-runner /usr/local/bin/k6-runner
ENTRYPOINT ["/usr/local/bin/k6-runner"]
