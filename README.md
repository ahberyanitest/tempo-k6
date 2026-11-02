# Spring Boot + React observability lab

A small local system for exploring request latency across a microservice chain:

```text
Browser / k6 -> React (5173) -> Spring Cloud Gateway (8080)
						 -> Catalog service (8081) -> Inventory service (8082)
```

The Spring services export traces to Tempo over OTLP, expose Prometheus metrics at `/actuator/prometheus`, and write logs to stdout. Grafana Alloy collects container logs and sends them to Loki. Tempo's metrics generator creates service-graph and span metrics and remote-writes them to Prometheus. The catalog stores products in PostgreSQL; the database volume keeps them across restarts.

## Start the stack

Requirements: Docker with the Compose plugin.

```bash
docker compose up --build -d
```

Open:

- React app: <http://localhost:5173>
- Gateway Swagger UI (Catalog and Inventory APIs): <http://localhost:8080/swagger-ui.html>
- Catalog Swagger UI: <http://localhost:8081/swagger-ui.html>
- Inventory Swagger UI: <http://localhost:8082/swagger-ui.html>
- Grafana: <http://localhost:3000> (user `admin`, password `admin`)
- Prometheus: <http://localhost:9090>
- Tempo: <http://localhost:3200>
- Loki: <http://localhost:3100>

The catalog seeds three sample products the first time its database is empty. Use the form in the React app to add products, or send `POST http://localhost:8080/api/products` with JSON such as `{"sku":"sku-404","name":"Trail Mug"}`. The catalog endpoint `GET http://localhost:8080/api/products` reads persisted products and calls inventory once for each product. The inventory endpoint is `GET http://localhost:8082/api/inventory/{sku}`.

Each Spring service publishes its OpenAPI document at `/v3/api-docs`. The gateway Swagger UI aggregates the Catalog and Inventory specifications and can send requests through the gateway.

## Run the performance test

Run k6 in the Compose network so it reaches the gateway by service name:

```bash
docker compose run --rm k6 run /scripts/browse.js
```

The scenario ramps from 1 to 15 virtual users and checks that requests succeed, return all products, and stay below the configured p95 threshold. It drives traffic through the same gateway endpoint used by the React app.

## Explore telemetry

- **Service latency dashboard:** Grafana -> Dashboards -> Microservices -> Microservice Latency. It plots Tempo service-graph p95 latency and call rate by `client` and `server`.
- **Service graph:** Grafana -> Explore -> Tempo -> Service Graph. Select Tempo as the trace source; Prometheus is already configured as the service-map metrics source. Run the k6 scenario first and allow a short time for spans and generated metrics to arrive.
- **Traces:** Grafana -> Explore -> Tempo, then search by service name (`gateway`, `catalog`, or `inventory`). A request should show gateway -> catalog -> inventory spans.
- **Logs:** Grafana -> Explore -> Loki. Alloy discovers Docker container logs automatically.
- **Metrics:** Prometheus scrapes all three Spring services every five seconds. The dashboard also plots `http_server_requests_seconds_count`.

## Stop

```bash
docker compose down
```

Use `docker compose down -v` only when you also want to delete persisted Grafana, Loki, Tempo, Alloy, and PostgreSQL data.

This is a local learning environment, not a production deployment. It uses demo credentials, samples every trace, has no authentication or TLS, stores telemetry locally, and mounts the Docker socket for log collection. Change those settings before exposing it beyond your machine.