import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = buildApp();

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Laylaty API listening on :${config.port}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
