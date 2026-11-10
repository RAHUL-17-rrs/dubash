// Every route returns JSON errors with the upstream status, so the UI can say what failed.
export const route = (fn) => async (req) => {
  try {
    return await fn(req);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
};

export const parse = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};
