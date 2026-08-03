export const config = {
  runtime: "edge",
};

export default function handler() {
  return new Response(
    JSON.stringify({
      applinks: {
        apps: [],
        details: [
          {
            appID: "G5RLSW66VS.com.tariqislam.app",
            paths: ["/reset-password", "/reset-password/*"],
          },
        ],
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
