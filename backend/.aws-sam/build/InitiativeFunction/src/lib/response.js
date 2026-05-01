function ok(body) {
  return { statusCode: 200, body: JSON.stringify(body) };
}

function created(body) {
  return { statusCode: 201, body: JSON.stringify(body) };
}

function notFound(msg = "Not found") {
  return { statusCode: 404, body: JSON.stringify({ error: msg }) };
}

function forbidden(msg = "Invalid password") {
  return { statusCode: 403, body: JSON.stringify({ error: msg }) };
}

function badRequest(msg) {
  return { statusCode: 400, body: JSON.stringify({ error: msg }) };
}

function conflict(msg) {
  return { statusCode: 409, body: JSON.stringify({ error: msg }) };
}

module.exports = { ok, created, notFound, forbidden, badRequest, conflict };
