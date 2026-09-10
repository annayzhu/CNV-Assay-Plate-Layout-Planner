import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("builds a static CNV planner with no server runtime", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>TaqMan CNV 板布局规划工具<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /_next|vinext|worker/i);

  const assetsDirectory = new URL("../dist/assets/", import.meta.url);
  const assets = await readdir(assetsDirectory);
  const javascript = assets.find((file) => file.endsWith(".js"));
  const css = assets.find((file) => file.endsWith(".css"));
  assert.ok(javascript, "JavaScript bundle is missing");
  assert.ok(css, "CSS bundle is missing");

  const bundle = await readFile(new URL(javascript, assetsDirectory), "utf8");
  assert.match(bundle, /CNV Analysis/);
  assert.match(bundle, /适用于QS1\/QS3\/QS5\/QS6\/QS7\/QSDX\/ViiA7机型的软件/);
  assert.match(bundle, /A\/C\/E\/G\/I\/K\/M\/O/);
});
