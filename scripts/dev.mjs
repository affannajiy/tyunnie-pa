// Runs `next dev` and opens the app in the default browser once the server is
// ready. Cross-platform (win/mac/linux), zero extra dependencies.
import { spawn } from "node:child_process";
import { platform } from "node:os";

const URL = "http://localhost:3000";
let opened = false;

function openBrowser() {
  if (opened) return;
  opened = true;
  const os = platform();
  // Pass the whole line as one shell string (not spawn args) — avoids Node's
  // DEP0190 warning about unescaped args with `shell: true`.
  // `start` is a Windows shell builtin and needs an empty title arg first.
  const line =
    os === "win32" ? `start "" "${URL}"`
    : os === "darwin" ? `open "${URL}"`
    : `xdg-open "${URL}"`;
  spawn(line, { shell: true, stdio: "ignore", detached: true }).unref();
}

const dev = spawn("next dev", { shell: true });

dev.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  // Next prints "Ready in <n>ms" once the server can accept requests
  if (/Ready in/i.test(text)) openBrowser();
});

dev.stderr.on("data", (chunk) => process.stderr.write(chunk));
dev.on("exit", (code) => process.exit(code ?? 0));
