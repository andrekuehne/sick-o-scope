import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.html(<h1>sick-o-scope</h1>));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
