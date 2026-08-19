/* Wraps a handler so a rejected promise reaches the error middleware
   instead of hanging the request. */
export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
