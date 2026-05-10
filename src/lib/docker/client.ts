/**
 * Client per il docker-socket-proxy (Tecnativa).
 * Comunica solo HTTP GET sull'host interno della rete Docker.
 */
const host = process.env.DOCKER_SOCKET_PROXY_HOST || "opsconsole-socketproxy";
const port = process.env.DOCKER_SOCKET_PROXY_PORT || "2375";
const base = `http://${host}:${port}`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`docker-proxy ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export type ContainerInfo = {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>;
};

export async function listContainers(): Promise<ContainerInfo[]> {
  return get<ContainerInfo[]>("/containers/json?all=1");
}

export async function dockerInfo(): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>("/info");
}

export async function dockerVersion(): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>("/version");
}
