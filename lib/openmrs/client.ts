const OPENMRS_URL = process.env.OPENMRS_URL;
const OPENMRS_USERNAME = process.env.OPENMRS_USERNAME;
const OPENMRS_PASSWORD = process.env.OPENMRS_PASSWORD;

function authHeader() {
  const token = Buffer.from(`${OPENMRS_USERNAME}:${OPENMRS_PASSWORD}`).toString("base64");

  return `Basic ${token}`;
}

export async function openmrsFetch(path: string, init?: RequestInit) {
  if (!OPENMRS_URL) {
    throw new Error("OPENMRS_URL is not configured");
  }

  const response = await fetch(`${OPENMRS_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenMRS request failed: ${response.status} ${text}`);
  }

  return response.json();
}