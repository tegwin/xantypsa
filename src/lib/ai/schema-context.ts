// ============================================================
// Teaching the model the data model
// ============================================================
// The schema file is the single source of truth for what XantyPSA *is*, so we
// parse it rather than maintaining a prose description that would drift.
//
// Two tiers, because the full schema is far too large to sit in every prompt:
//   1. An index (model names + field names) goes in the system prompt.
//   2. Full detail for a specific model is fetched on demand via describe_schema.

import fs from 'fs';
import path from 'path';

export interface SchemaField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  isRelation: boolean;
  /** The trailing `// comment` in the schema, which often carries the allowed values. */
  comment?: string;
  attributes?: string;
}

export interface SchemaModel {
  name: string;
  /** The physical table name from @@map, which raw SQL must use. */
  tableName: string;
  fields: SchemaField[];
}

let cache: Map<string, SchemaModel> | null = null;

function schemaPath(): string {
  return path.join(process.cwd(), 'prisma', 'schema.prisma');
}

/** Scalar types Prisma knows about; anything else is a relation to another model. */
const SCALARS = new Set([
  'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'BigInt', 'Bytes',
]);

function parseSchema(): Map<string, SchemaModel> {
  if (cache) return cache;

  const source = fs.readFileSync(schemaPath(), 'utf8');
  const models = new Map<string, SchemaModel>();

  // Match `model Foo { ... }` blocks.
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match: RegExpExecArray | null;

  while ((match = modelRe.exec(source)) !== null) {
    const [, name, body] = match;
    const fields: SchemaField[] = [];
    let tableName = name;

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//')) continue;

      // @@map("tickets") tells us the real table name for SQL.
      const mapMatch = line.match(/^@@map\("([^"]+)"\)/);
      if (mapMatch) {
        tableName = mapMatch[1];
        continue;
      }
      if (line.startsWith('@@')) continue;

      // `name  Type?  @attrs // comment`
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType, list, optional, rest] = fieldMatch;
      const commentSplit = rest.split('//');

      fields.push({
        name: fieldName,
        type: fieldType,
        isList: Boolean(list),
        isOptional: Boolean(optional),
        isRelation: !SCALARS.has(fieldType),
        attributes: commentSplit[0].trim() || undefined,
        comment: commentSplit[1]?.trim(),
      });
    }

    models.set(name, { name, tableName, fields });
  }

  cache = models;
  return models;
}

export function getModel(name: string): SchemaModel | undefined {
  const models = parseSchema();
  // Tolerate the casing the model is likely to guess: ticket, Ticket, tickets.
  return (
    models.get(name) ||
    [...models.values()].find(
      (m) =>
        m.name.toLowerCase() === name.toLowerCase() ||
        m.tableName.toLowerCase() === name.toLowerCase()
    )
  );
}

export function listModels(): SchemaModel[] {
  return [...parseSchema().values()];
}

/**
 * The compact index for the system prompt: every model, its table, and its
 * field names. Enough for the model to plan; not enough to bloat the prompt.
 */
export function buildSchemaIndex(): string {
  const lines: string[] = [];
  for (const model of listModels()) {
    const scalars = model.fields.filter((f) => !f.isRelation).map((f) => f.name);
    const relations = model.fields.filter((f) => f.isRelation).map((f) => f.name);
    lines.push(
      `${model.name} (table: ${model.tableName})\n` +
        `  fields: ${scalars.join(', ')}` +
        (relations.length ? `\n  relations: ${relations.join(', ')}` : '')
    );
  }
  return lines.join('\n');
}

/** Full detail for one model - types, optionality, and the enum-ish comments. */
export function describeModel(name: string): string {
  const model = getModel(name);
  if (!model) {
    const names = listModels().map((m) => m.name).join(', ');
    return `No model named "${name}". Available models: ${names}`;
  }

  const rows = model.fields.map((f) => {
    const type = `${f.type}${f.isList ? '[]' : ''}${f.isOptional ? '?' : ''}`;
    const note = f.comment ? `  // ${f.comment}` : '';
    const kind = f.isRelation ? ' (relation)' : '';
    return `  ${f.name.padEnd(20)} ${type}${kind}${note}`;
  });

  return `model ${model.name}  (SQL table: "${model.tableName}")\n${rows.join('\n')}`;
}
