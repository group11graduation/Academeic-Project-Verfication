export function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function successMessage(res, message, data = null, status = 200) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  return res.status(status).json(body);
}

export function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}
