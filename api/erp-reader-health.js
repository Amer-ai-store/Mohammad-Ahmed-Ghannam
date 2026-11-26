import { neon } from '@neondatabase/serverless';
import { verifiedReaderIdentity, sanitizedReaderStatus } from './_erp_reader_policy.mjs';

// Private preview-only metadata probe. Do not query business tables or return
// credentials, row counts, raw errors, user data or financial records.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ status: 'METHOD_NOT_ALLOWED' });
  }
  const uri = process.env.ERP_REPORTS_READONLY_DATABASE_URL;
  if (!uri) {
    return response.status(503).json(sanitizedReaderStatus(false));
  }
  try {
    const sql = neon(uri);
    const identity = await sql`SELECT current_user::text AS connected_role, current_database()::text AS connected_db`;
    const verified = verifiedReaderIdentity(identity);
    return response.status(verified ? 200 : 503)
      .json(sanitizedReaderStatus(verified));
  } catch {
    // Deliberately omit the raw exception to avoid exposing connection data.
    return response.status(503).json(sanitizedReaderStatus(false));
  }
}
