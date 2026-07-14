import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Vercel preview deployments use an isolated Neon branch: PREVIEW_POSTGRES_URL is
// only defined in Vercel's Preview environment, so production and local dev fall
// through to POSTGRES_URL unchanged.
let connectionString = process.env.PREVIEW_POSTGRES_URL || process.env.POSTGRES_URL;

// Use the local Docker Neon proxy only when no external POSTGRES_URL is set (or it
// already points at the local proxy). This lets local dev run against a real Neon
// branch by simply setting POSTGRES_URL — no Docker required. The URL is only
// parsed in development, so production behaviour is untouched.
const shouldUseLocalProxy = () =>
  !connectionString || new URL(connectionString).hostname === 'db.localtest.me';

// Configuring Neon for local development
if (process.env.NODE_ENV === 'development' && shouldUseLocalProxy()) {
  connectionString = 'postgres://postgres:postgres@db.localtest.me:5432/main';
  neonConfig.fetchEndpoint = (host) => {
    const [protocol, port] = host === 'db.localtest.me' ? ['http', 4444] : ['https', 443];

    return `${protocol}://${host}:${port}/sql`;
  };
  const connectionStringUrl = new URL(connectionString);
  neonConfig.useSecureWebSocket = connectionStringUrl.hostname !== 'db.localtest.me';
  neonConfig.wsProxy = (host) => (host === 'db.localtest.me' ? `${host}:4444/v2` : `${host}/v2`);
}
neonConfig.webSocketConstructor = ws;

// HTTP Client (sql)
// - Best for serverless functions and Lambda environments
// - Ideal for stateless operations and quick queries
// - Lower overhead for single queries
// - Better for applications with sporadic database access
export const sql = neon(connectionString);

// WebSocket Client (pool)
// - Best for long-running applications (like servers)
// - Maintains a persistent connection
// - More efficient for multiple sequential queries
// - Better for high-frequency database operations
export const pool = new Pool({ connectionString });

// Default export for backward compatibility
export default { sql, pool };
