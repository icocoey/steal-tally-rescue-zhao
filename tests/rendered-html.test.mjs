import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the complete game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>窃符救赵 · 魏宫夜行<\/title>/);
  assert.match(html, /窃符救赵/);
  assert.match(html, /信陵君的门客/);
  assert.match(html, /WASD 移动/);
  assert.match(html, /scene-mount/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the three mission objectives and ending copy", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /避开内侍/);
  assert.match(html, /盗取虎符|取走案上虎符/);
  assert.match(html, /将虎符交给接应将军/);
  assert.match(html, /任务完成/);
});
