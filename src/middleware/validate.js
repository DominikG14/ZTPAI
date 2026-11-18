const { ValidationError } = require('../errors/app-error');

function validate({ params, query, body } = {}) {
  return (req, res, next) => {
    const validated = {};
    const details = [];
    const inputs = { params, query, body };

    for (const [location, schema] of Object.entries(inputs)) {
      if (!schema) continue;
      const result = schema.safeParse(req[location]);
      if (result.success) {
        validated[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          const field = issue.path.length ? issue.path.join('.') : (issue.keys?.join(', ') || '_');
          details.push({ location, field, message: issue.message });
        }
      }
    }

    if (details.length) {
      return next(new ValidationError(details));
    }

    req.validated = validated;
    return next();
  };
}

module.exports = { validate };
