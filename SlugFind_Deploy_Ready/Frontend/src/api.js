// Change the API URL if your backend uses a different forwarded port.
export const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function parseResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(typeof data?.detail === "string" ? data.detail : `API request failed (${response.status})`);
  }
  return response.json();
}

export async function submitItem({ item_type, title, description, location, event_time, category, image }) {
  const form = new FormData();
  form.append("item_type", item_type);
  form.append("title", title || "");
  form.append("description", description || "");
  form.append("location", location);
  form.append("event_time", event_time);
  form.append("category", category || "Other");
  if (image) form.append("image", image);
  return parseResponse(await fetch(`${API_URL}/api/items`, { method: "POST", body: form }));
}

export async function getItems() {
  return parseResponse(await fetch(`${API_URL}/api/items`));
}

export async function getMatches(itemId) {
  return parseResponse(await fetch(`${API_URL}/api/matches/${encodeURIComponent(itemId)}`));
}


// Claims are stored privately by FastAPI. This endpoint does not approve ownership.
export async function submitClaim({ item_id, contact_email, private_detail, additional_context }) {
  return parseResponse(await fetch(`${API_URL}/api/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id, contact_email, private_detail, additional_context })
  }));
}
