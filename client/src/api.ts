const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 - one call chain, one Online/Offline result.
// Throwing on any failure lets the UI show a single error state.
export async function checkSystem(): Promise<SystemStatus> {
  const health = await fetch(`${API_URL}/api/health`);
  if (!health.ok) throw new Error("Health check failed");

  const healthBody = await health.json();
  if (healthBody.status !== "ok") throw new Error("Service not healthy");

  const response = await fetch(`${API_URL}/api/categories`);
  if (!response.ok) throw new Error("Category request failed");

  const categories: Category[] = await response.json();
  return { online: true, categories };
}
