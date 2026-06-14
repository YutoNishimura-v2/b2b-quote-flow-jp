function notFound() {
  return Response.json(
    { ok: false, error: "Not found" },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export const action = notFound;
export const loader = notFound;
