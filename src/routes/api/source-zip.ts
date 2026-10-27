import { createFileRoute } from "@tanstack/react-router";

/** Source zip endpoint retired — use the GitHub repo instead. */
export const Route = createFileRoute("/api/source-zip")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            message:
              "Use https://github.com/DMcCormack61/cycling-fatalities-tracker instead of a deploy zip.",
          },
          { status: 410 },
        );
      },
    },
  },
});
