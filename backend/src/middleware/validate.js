const ApiError = require('../utils/ApiError');

/**
 * Validates req[source] against a zod schema and replaces it with the parsed
 * (trimmed / coerced) value. Unknown fields in bodies are rejected (.strict()).
 */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[source] ?? {});
  if (!parsed.success) {
    const fields = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return next(ApiError.badRequest('Validation failed', fields));
  }
  req[source] = parsed.data;
  return next();
};
