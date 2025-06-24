/**
 * Async error handler middleware
 * Wraps async route handlers to automatically catch and pass errors to error handler
 */

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;