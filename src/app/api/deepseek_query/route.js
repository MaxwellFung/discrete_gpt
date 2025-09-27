
export const runtime = "nodejs";

export async function POST(req) {
    try {
      const { query } = await req.json();
  
      const upstream = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer sk-56357ef3743c45c29d8345771ece3ba4`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: query }],
          stream: true,
        }),
      });
  
      if (!upstream.ok || !upstream.body) {
        return new Response(
          JSON.stringify({ status: "error", message: "Upstream request failed" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
  
      // Stream DeepSeek response directly back to the client
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ status: "error", message: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
}


