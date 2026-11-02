import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';
const peakVUs = Number(__ENV.K6_VUS || 15);
const durationSeconds = Number(__ENV.K6_DURATION_SECONDS || 80);
const rampUpSeconds = Math.max(1, Math.floor(durationSeconds * 0.25));
const peakSeconds = Math.max(1, Math.floor(durationSeconds * 0.5));
const rampDownSeconds = Math.max(1, durationSeconds - rampUpSeconds - peakSeconds);

export const options = {
  scenarios: {
    catalog_browse: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: `${rampUpSeconds}s`, target: Math.max(1, Math.ceil(peakVUs / 3)) },
        { duration: `${peakSeconds}s`, target: peakVUs },
        { duration: `${rampDownSeconds}s`, target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/products`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'catalog' },
  });

  check(response, {
    'catalog returns 200': (result) => result.status === 200,
    'catalog returns all products': (result) => {
      try {
        return JSON.parse(result.body).length === 3;
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
