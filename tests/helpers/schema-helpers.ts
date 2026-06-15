// tests/helpers/schema-helpers.ts
// JSON Schema validation for API contract tests. Instead of dozens of manual
// `expect(typeof x).toBe(...)` lines, a response is validated against a single
// versioned schema file in tests/api/schemas/. One source of truth, reusable,
// and it catches drift (missing/retyped fields) automatically.

import Ajv, {type ErrorObject} from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({allErrors: true, strict: false});
addFormats(ajv);

export interface SchemaResult {
  valid: boolean;
  /** Human-readable validation errors, empty when valid. */
  errors: string[];
}

/** Validate `data` against a JSON Schema; returns validity + readable errors. */
export function validateSchema(schema: object, data: unknown): SchemaResult {
  const validate = ajv.compile(schema);
  const valid = validate(data) === true;
  const errors = (validate.errors ?? []).map((e: ErrorObject) =>
    `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim(),
  );
  return {valid, errors};
}
