import { withMarketplaceClient } from "./marketplace";

/**
 * DB Explorer helpers (read-only, masking + filtri guidati).
 *
 * Sicurezza:
 *  - Solo SELECT, statement_timeout 5s (ereditato dal ruolo opsconsole_ro)
 *  - Identifier quoting per schema/tabella/colonna (no SQL injection da nomi)
 *  - Filtri parametrizzati (no SQL injection da valori)
 *  - Masking automatico colonne con pattern PII (password/email/phone/token/secret)
 */

export type Column = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isMasked: boolean;
};

export type RowsResult = {
  columns: Column[];
  rows: Record<string, unknown>[];
  truncated: boolean;
};

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function quoteIdent(s: string): string {
  if (!IDENT_RE.test(s)) throw new Error(`Identifier non valido: ${s}`);
  return `"${s}"`;
}

const MASK_RE = /(^|_)(password|pwd|hash|token|secret|key|otp|pin|api_?key|access_?token|refresh_?token|email|mail|phone|telefono|cf|codice_?fiscale|iban|tax)(_|$)/i;
export function shouldMask(colName: string): boolean {
  return MASK_RE.test(colName);
}

export function maskValue(value: unknown): unknown {
  if (value == null) return value;
  const s = String(value);
  if (s.length <= 3) return "***";
  if (s.includes("@")) {
    const [user, domain] = s.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `${s.slice(0, 2)}***${s.slice(-1)}`;
}

export async function listColumns(schema: string, table: string): Promise<Column[]> {
  return withMarketplaceClient(async (c) => {
    const q = `
      SELECT column_name AS name,
             data_type   AS type,
             is_nullable = 'YES' AS nullable,
             column_default AS default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;
    const r = await c.query(q, [schema, table]);
    return r.rows.map((row) => ({
      name: row.name as string,
      type: row.type as string,
      nullable: !!row.nullable,
      default: row.default as string | null,
      isMasked: shouldMask(row.name as string),
    }));
  });
}

export type FilterOp = "=" | "!=" | "ILIKE" | ">" | "<" | "IS NULL" | "IS NOT NULL";
const ALLOWED_OPS: ReadonlySet<FilterOp> = new Set(["=", "!=", "ILIKE", ">", "<", "IS NULL", "IS NOT NULL"]);

export type Filter = { column: string; op: FilterOp; value?: string };

export async function fetchRows(opts: {
  schema: string;
  table: string;
  limit?: number;
  offset?: number;
  filter?: Filter;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
}): Promise<RowsResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const offset = Math.max(0, opts.offset ?? 0);

  const columns = await listColumns(opts.schema, opts.table);
  if (columns.length === 0) throw new Error("Tabella non trovata");

  const colNames = new Set(columns.map((c) => c.name));
  const qSchema = quoteIdent(opts.schema);
  const qTable = quoteIdent(opts.table);

  let where = "";
  const params: unknown[] = [];
  if (opts.filter && colNames.has(opts.filter.column) && ALLOWED_OPS.has(opts.filter.op)) {
    const qc = quoteIdent(opts.filter.column);
    if (opts.filter.op === "IS NULL" || opts.filter.op === "IS NOT NULL") {
      where = `WHERE ${qc} ${opts.filter.op}`;
    } else if (opts.filter.value != null && opts.filter.value !== "") {
      params.push(opts.filter.op === "ILIKE" ? `%${opts.filter.value}%` : opts.filter.value);
      where = `WHERE ${qc} ${opts.filter.op} $${params.length}`;
    }
  }

  let orderClause = "";
  if (opts.orderBy && colNames.has(opts.orderBy)) {
    const dir = opts.orderDir === "DESC" ? "DESC" : "ASC";
    orderClause = `ORDER BY ${quoteIdent(opts.orderBy)} ${dir} NULLS LAST`;
  }

  const sql = `SELECT * FROM ${qSchema}.${qTable} ${where} ${orderClause} LIMIT ${limit + 1} OFFSET ${offset}`;
  return withMarketplaceClient(async (c) => {
    const r = await c.query(sql, params);
    const rows = r.rows.slice(0, limit).map((row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        out[col.name] = col.isMasked ? maskValue(row[col.name]) : row[col.name];
      }
      return out;
    });
    return { columns, rows, truncated: r.rows.length > limit };
  });
}

export async function countRows(schema: string, table: string): Promise<number | null> {
  try {
    return await withMarketplaceClient(async (c) => {
      const r = await c.query(`SELECT COUNT(*)::bigint AS n FROM ${quoteIdent(schema)}.${quoteIdent(table)}`);
      return Number(r.rows[0]?.n ?? 0);
    });
  } catch { return null; }
}
