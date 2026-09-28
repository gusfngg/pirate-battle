import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// os mocks rodam em todo build, inclusive no deploy, porque não existe backend real
export async function startMockApi() {
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}
