import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    catalog_browse: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 5 },
        { duration: '40s', target: 15 },
        { duration: '20s', target: 0 },
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
