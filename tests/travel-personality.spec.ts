import { expect, test } from "@playwright/test";
import { matchPersona, questions, scoreAnswers, skyscannerUrl } from "../lib/scoring";
import { createResultHash } from "../lib/share";
import { calculateFriendMatch, decodeFriendSnapshot, encodeFriendSnapshot } from "../lib/friend-match";
import { createRuleBasedAnalysis } from "../lib/analysis";
import { getPersona, getWorld } from "../data/catalog";
import { dimensionLevel } from "../lib/constants";

test("turns numeric travel DNA scores into five-cell symbol meters", () => {
  expect([0, 1, 39, 40, 59, 60, 79, 80, 100].map(dimensionLevel)).toEqual([
    "□□□□□", "■□□□□", "■■□□□", "■■□□□", "■■■□□", "■■■□□", "■■■■□", "■■■■□", "■■■■■",
  ]);
});

test("creates a stable result hash from persona, scores and answers", () => {
  const scores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const first = createResultHash("chaos-traveller", scores, "aaaaaaaaaaaaaaaa");
  expect(first).toMatch(/^#TPI-[0-9A-F]{8}$/);
  expect(createResultHash("chaos-traveller", scores, "aaaaaaaaaaaaaaaa")).toBe(first);
  expect(createResultHash("chaos-traveller", scores, "baaaaaaaaaaaaaaa")).not.toBe(first);
});

test("calculates friend match from the six real score differences", () => {
  const first = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const identical = calculateFriendMatch(first, first);
  expect(identical.percentage).toBe(100);
  expect(identical.closest.difference).toBe(0);

  const opposite = calculateFriendMatch(first, { npc: 75, chaos: 0, hype: 20, spend: 60, camera: 45, control: 90 });
  expect(opposite.percentage).toBe(47);
  expect(opposite.friction.dimension).toBe("chaos");

  const encoded = encodeFriendSnapshot({ p: "chaos-traveller", s: first });
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(decodeFriendSnapshot(encoded)).toEqual({ p: "chaos-traveller", s: first });
});

test("varies the compatibility overview by actual behavior without exposing dimensions or scores", () => {
  const cameraLed = calculateFriendMatch(
    { npc: 20, chaos: 20, hype: 20, spend: 20, camera: 90, control: 20 },
    { npc: 30, chaos: 30, hype: 30, spend: 30, camera: 80, control: 30 },
  );
  const planningLed = calculateFriendMatch(
    { npc: 20, chaos: 20, hype: 20, spend: 20, camera: 20, control: 90 },
    { npc: 30, chaos: 30, hype: 30, spend: 30, camera: 30, control: 80 },
  );

  expect(cameraLed.percentage).toBe(planningLed.percentage);
  expect(cameraLed.summary).not.toBe(planningLed.summary);
  expect(cameraLed.summary).not.toMatch(/NPC|整活|上头|氪金|出片|拿捏|\d/);
  expect(planningLed.summary).not.toMatch(/NPC|整活|上头|氪金|出片|拿捏|\d/);
});

test("ends destination copy after its catalog connection", () => {
  const persona = getPersona("fomo-rocketeer");
  const world = getWorld(persona.worldId);
  const scores = { npc: 37, chaos: 45, hype: 69, spend: 30, camera: 21, control: 11 };
  const analysis = createRuleBasedAnalysis(scores, persona, world);

  expect(analysis.destinationReasons).toEqual(world.destinations.map(
    (destination) => `${destination.city}：${destination.reason} ${destination.connection}`,
  ));
  expect(analysis.destinationReasons.join(" ")).not.toMatch(/很适合你|逼到加班|最容易订到票的替身/);
});

test("builds China and UK departure links from the interface language", () => {
  const zh = new URL(skyscannerUrl("EDI", "zh"));
  expect(Object.fromEntries(zh.searchParams)).toMatchObject({
    origin: "CN", destination: "EDI", market: "CN", locale: "zh-CN", currency: "CNY",
  });

  const en = new URL(skyscannerUrl("EDI", "en"));
  expect(Object.fromEntries(en.searchParams)).toMatchObject({
    origin: "UK", destination: "EDI", market: "UK", locale: "en-GB", currency: "GBP",
  });
});

test("uses answer motives to separate otherwise close persona results", () => {
  const cases = [
    {
      scores: { npc: 20, chaos: 55, hype: 39, spend: 51, camera: 32, control: 22 },
      path: "cbddbcacbdbd",
      base: "fomo-rocketeer",
      resolved: "food-hunter",
    },
    {
      scores: { npc: 34, chaos: 43, hype: 35, spend: 28, camera: 29, control: 26 },
      path: "dacabaddabca",
      base: "fomo-rocketeer",
      resolved: "planet-earth-expat",
    },
    {
      scores: { npc: 35, chaos: 60, hype: 54, spend: 29, camera: 21, control: 16 },
      path: "ababacbdabcc",
      base: "fomo-rocketeer",
      resolved: "chaos-traveller",
    },
    {
      scores: { npc: 30, chaos: 22, hype: 5, spend: 36, camera: 36, control: 47 },
      path: "bcddbaaddbdc",
      base: "soft-life-migrant",
      resolved: "luxury-escaper",
    },
  ] as const;

  for (const example of cases) {
    const answers = questions.map((question, index) => ({
      questionId: question.id,
      optionId: example.path[index],
    }));
    expect(matchPersona(example.scores).id).toBe(example.base);
    expect(matchPersona(example.scores, answers).id).toBe(example.resolved);
  }
});

test("keeps every individual question below the persona-change sensitivity limit", () => {
  let seed = 724;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const samples = 48_000;
  const totals = questions.map(() => 0);
  const changes = questions.map(() => 0);

  for (let sample = 0; sample < samples; sample += 1) {
    const optionIndexes = questions.map(() => Math.floor(random() * 4));
    const answers = questions.map((question, index) => ({
      questionId: question.id,
      optionId: question.options[optionIndexes[index]].id,
    }));
    const original = matchPersona(scoreAnswers(answers), answers).id;
    const changedQuestion = sample % questions.length;
    let replacement = Math.floor(random() * 3);
    if (replacement >= optionIndexes[changedQuestion]) replacement += 1;
    const changedAnswers = answers.map((answer, index) => index === changedQuestion
      ? { ...answer, optionId: questions[index].options[replacement].id }
      : answer);

    totals[changedQuestion] += 1;
    if (matchPersona(scoreAnswers(changedAnswers), changedAnswers).id !== original) {
      changes[changedQuestion] += 1;
    }
  }

  const rates = questions.map((question, index) => ({
    question: question.id,
    rate: changes[index] / totals[index],
  }));
  rates.forEach(({ question, rate }) => expect(rate, question).toBeLessThan(0.45));
  expect(Math.max(...rates.map(({ rate }) => rate)) - Math.min(...rates.map(({ rate }) => rate))).toBeLessThan(0.08);
});

test("keeps primary screens inside narrow and wide viewports", async ({ page }) => {
  const scores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const result = Buffer.from(JSON.stringify({ p: "chaos-traveller", s: scores, a: "aaaaaaaaaaaaaaaa" })).toString("base64url");
  const match = Buffer.from(JSON.stringify({ p: "fomo-rocketeer", s: { ...scores, chaos: 80, control: 30 } })).toString("base64url");

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

    await page.getByRole("button", { name: /开始暴露自己/ }).click();
    await expect(page.getByTestId("question")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

    await page.goto(`/?result=${result}&match=${match}`);
    await expect(page.getByTestId("friend-match")).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    if (viewport.width < 390) await expect(page.getByTestId("result-edition")).toBeHidden();
    else await expect(page.getByTestId("result-edition")).toBeVisible();
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`/?result=${result}`);
  await page.getByRole("button", { name: "生成人格海报" }).click();
  const dialog = page.getByRole("dialog", { name: "人格海报预览" });
  await expect(dialog).toBeVisible();
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBounds?.x ?? 0) + (dialogBounds?.width ?? 0)).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("previews an option reaction on hover without showing a check", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /开始暴露自己/ }).click();

  const option = page.getByTestId("answer-a");
  const reaction = page.getByText(questions[0].options[0].reaction, { exact: true });
  await expect(reaction).toBeHidden();

  await option.hover();
  await expect(reaction).toBeVisible();
  await expect(option.locator("svg")).toHaveCount(0);

  await option.click();
  await expect(option.locator("svg")).toHaveCount(1, { timeout: 250 });
});

test("shows the next option reaction when the pointer stays still between questions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /开始暴露自己/ }).click();

  const question = page.getByTestId("question");
  const firstQuestionId = await question.getAttribute("data-question-id");
  await question.locator('[data-testid^="answer-"]').first().click();
  await expect.poll(async () => page.getByTestId("question").getAttribute("data-question-id")).not.toBe(firstQuestionId);

  const reactions = page.getByTestId("question").locator('[data-testid^="answer-"] p');
  await expect.poll(() => reactions.evaluateAll((elements) => elements.filter((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.height > 0 && getComputedStyle(element).opacity === "1";
  }).length)).toBe(1);
});

test("completes the 12-question experience and renders a shareable result", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /AI看穿\s*你的旅行人格/ })).toBeVisible();
  await page.getByRole("button", { name: /开始暴露自己/ }).click();

  for (let index = 1; index <= questions.length; index += 1) {
    await expect(page.getByTestId("question")).toHaveCount(1);
    const question = page.getByTestId("question");
    const questionId = await question.getAttribute("data-question-id");
    await page.getByTestId("answer-a").click();
    if (index < questions.length) {
      await page.waitForFunction((previousId) => {
        const questions = document.querySelectorAll('[data-testid="question"]');
        return questions.length === 1 && questions[0].getAttribute("data-question-id") !== previousId;
      }, questionId);
    }
  }

  await expect(page.getByText("Local roast engine", { exact: true })).toBeVisible();
  await expect(page.getByText("AI 总结", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/方案 [1-6] ·/)).toBeVisible();
  await expect(page.getByTestId("travel-advice")).toContainText("旅行建议");
  await expect(page.getByTestId("travel-advice")).not.toContainText(/\d+ 分/);
  await expect(page.getByText(/很适合你 \d+ 分的/)).toHaveCount(0);
  await expect(page.getByText(/逼到加班/)).toHaveCount(0);
  await expect(page.getByText("互联网行为小票")).toHaveCount(0);
  await expect(page.getByText("旅行处方")).toHaveCount(0);
  await expect(page.getByTestId("persona-code")).toHaveText(/^(JOKER|FOOD|RICH|C位|FOMO|ZZZZ|NPC|GPS|404)$/);
  await expect(page.getByTestId("result-hash")).toHaveText(/^#TPI-[0-9A-F]{8}$/);
  await expect(page.locator('[aria-label="旅行人格六维雷达图"] svg')).toBeVisible();
  const flightLinks = page.getByRole("link", { name: /从中国飞往/ });
  await expect(flightLinks).toHaveCount(3);
  for (const href of await flightLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
    const url = new URL(String(href));
    expect(`${url.origin}${url.pathname}`).toBe("https://www.skyscanner.net/g/referrals/v1/flights/browse-view");
    expect(url.searchParams.get("origin")).toBe("CN");
    expect(url.searchParams.get("destination")).toMatch(/^[A-Z]{3}$/);
    expect(url.searchParams.get("market")).toBe("CN");
    expect(url.searchParams.get("locale")).toBe("zh-CN");
    expect(url.searchParams.get("currency")).toBe("CNY");
  }
  await expect(page.getByRole("button", { name: "生成人格海报" })).toBeVisible();
  await expect(page.getByRole("button", { name: "分享结果链接" })).toBeVisible();
  await expect(page.getByRole("button", { name: "邀请朋友来测" })).toBeVisible();
});

test("ships without an AI analysis endpoint", async ({ request }) => {
  const response = await request.post("/api/analyze", { data: { answers: [] } });
  expect(response.status()).toBe(404);
});

test("opens an invited quiz with a neutral invitation", async ({ page }) => {
  await page.goto("/?from=chaos-traveller");
  await expect(page.getByText(/Chaos Traveller.*邀请你来对答案/)).toBeVisible();
  await expect(page.getByText(/伟大航路/)).toHaveCount(1); // teaser card only; no inviter result disclosure
});

test("serves a fully localized English entry and invitation identity", async ({ page }) => {
  await page.goto("/en/?from=main-character");

  await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
  await expect(page).toHaveTitle("Travel Personality Indicator | Discover Your Travel Type");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /12 playful questions/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_GB");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /social-preview-en\.png$/);
  await expect(page.getByText(/LEAD · Main Character Traveller.*sent you this/)).toBeVisible();
  await expect(page.getByText(/C位/)).toHaveCount(0);
  await expect(page.getByAltText("JOKER geometric raccoon travel personality")).toBeVisible();
  await expect(page.getByRole("group", { name: "Language" })).toBeVisible();
});

test("renders a score-based friend match from an invitation snapshot", async ({ page }) => {
  const scores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const result = Buffer.from(JSON.stringify({ p: "chaos-traveller", s: scores, a: "aaaaaaaaaaaaaaaa" })).toString("base64url");
  const match = Buffer.from(JSON.stringify({ p: "fomo-rocketeer", s: { ...scores, chaos: 80, control: 30 } })).toString("base64url");
  await page.goto(`/?result=${result}&match=${match}`);

  await expect(page.getByTestId("friend-match-percentage")).toHaveText("93%");
  await expect(page.getByTestId("friend-match")).toContainText("旅行脑电波疑似共用同一条 Wi‑Fi");
  await expect(page.getByTestId("friend-match")).not.toContainText("JOKER × FOMO");
  await expect(page.getByTestId("friend-match")).not.toContainText("最合拍分项");
  await expect(page.getByTestId("friend-match")).not.toContainText("最容易互相无语");
});

test("returns a connected match link to the original inviter", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  const inviterScores = { npc: 25, chaos: 80, hype: 80, spend: 40, camera: 55, control: 30 };
  const friendScores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const result = Buffer.from(JSON.stringify({ p: "chaos-traveller", s: friendScores, a: "aaaaaaaaaaaaaaaa" })).toString("base64url");
  const match = encodeFriendSnapshot({ p: "fomo-rocketeer", s: inviterScores });
  await page.goto(`/?result=${result}&match=${match}`);

  await page.getByTestId("friend-match-share").click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const returned = new URL(copied.match(/https?:\/\/\S+/)?.[0] ?? copied);
  const returnedResult = decodeFriendSnapshot(String(returned.searchParams.get("result")));
  const returnedMatch = decodeFriendSnapshot(String(returned.searchParams.get("match")));
  expect(returnedResult).toEqual({ p: "fomo-rocketeer", s: inviterScores });
  expect(returnedMatch).toEqual({ p: "chaos-traveller", s: friendScores });

  await page.goto(returned.toString());
  await expect(page.getByTestId("friend-match-percentage")).toHaveText("93%");
  await expect(page.getByTestId("friend-match")).toContainText("旅行脑电波疑似共用同一条 Wi‑Fi");
});

test("creates a private-score match invitation without the answer path", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  const scores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const result = Buffer.from(JSON.stringify({ p: "chaos-traveller", s: scores, a: "aaaaaaaaaaaaaaaa" })).toString("base64url");
  await page.goto(`/?result=${result}`);
  await page.getByRole("button", { name: "邀请朋友来测" }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const invite = new URL(copied.match(/https?:\/\/\S+/)?.[0] ?? copied);
  expect(invite.searchParams.get("from")).toBe("chaos-traveller");
  expect(invite.searchParams.has("result")).toBe(false);
  const snapshot = decodeFriendSnapshot(String(invite.searchParams.get("match")));
  expect(snapshot).toEqual({ p: "chaos-traveller", s: scores });
});

test("shares varied friend invitations as intro followed by the connected link", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload: ShareData) => sessionStorage.setItem("last-share-payload", JSON.stringify(payload)),
    });
  });
  const scores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const result = Buffer.from(JSON.stringify({ p: "chaos-traveller", s: scores, a: "aaaaaaaaaaaaaaaa" })).toString("base64url");
  await page.goto(`/?result=${result}`);

  const button = page.getByRole("button", { name: "邀请朋友来测" });
  await button.click();
  const first = JSON.parse(await page.evaluate(() => sessionStorage.getItem("last-share-payload") ?? "{}"));
  await button.click();
  const second = JSON.parse(await page.evaluate(() => sessionStorage.getItem("last-share-payload") ?? "{}"));

  expect(first.url).toBeUndefined();
  expect(first.text).toMatch(/^.+：\nhttps?:\/\/[^\s]+\?[^\s]+$/);
  expect(new URL(first.text.split("\n").at(-1)).searchParams.get("match")).toBeTruthy();
  expect(second.text.split("\n")[0]).not.toBe(first.text.split("\n")[0]);
});

test("keeps old Airport Dad links working after its persona merge", async ({ page }) => {
  await page.goto("/?from=airport-dad");
  await expect(page.getByText(/GPS · Budget Alchemist.*邀请你来对答案/)).toBeVisible();
  await expect(page.getByText(/Airport Dad|老父亲/)).toHaveCount(0);
});

test("maps retired persona links to their closest retained result", async ({ page }) => {
  const aliases = [
    ["weekend-goblin", /FOMO · FOMO Rocketeer/],
    ["airport-guardian", /GPS · Budget Alchemist/],
    ["spreadsheet-pilot", /GPS · Budget Alchemist/],
    ["maps-believer", /GPS · Budget Alchemist/],
    ["aesthetic-smuggler", /C位 · Main Character Traveller/],
    ["dopamine-nomad", /FOMO · FOMO Rocketeer/],
    ["off-grid-oracle", /404 · Planet Earth Expat/],
    ["hidden-gem-collector", /404 · Planet Earth Expat/],
    ["culture-time-traveller", /GPS · Budget Alchemist/],
  ] as const;

  for (const [legacyId, expected] of aliases) {
    await page.goto(`/?from=${legacyId}`);
    await expect(page.getByText(new RegExp(`${expected.source}.*邀请你来对答案`))).toBeVisible();
  }
});

test("copies a URL-safe result link that restores the shared result", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  const payload = Buffer.from(JSON.stringify({
    p: "chaos-traveller",
    s: { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 },
    a: "aaaaaaaaaaaaaaaa",
  })).toString("base64");
  await page.goto(`/?result=${encodeURIComponent(payload)}`);

  await page.getByRole("button", { name: "分享结果链接" }).click();
  await expect(page.getByText("结果链接已复制，可直接粘贴打开")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const sharedUrl = new URL(copied);
  expect(sharedUrl.searchParams.has("rid")).toBe(false);
  expect(sharedUrl.hash).toMatch(/^#TPI-[0-9A-F]{8}$/);
  const encodedResult = sharedUrl.searchParams.get("result");
  expect(encodedResult).toMatch(/^[A-Za-z0-9_-]+$/);

  const receiver = await context.newPage();
  await receiver.goto(copied);
  await expect(receiver.getByTestId("persona-code")).toHaveText("JOKER");
  await expect(receiver.getByTestId("result-hash")).toHaveText(/^#TPI-[0-9A-F]{8}$/);
  await expect(receiver.getByText("AI 总结", { exact: true })).toBeVisible();
  await expect(receiver.getByTestId("persona-narrative")).toContainText("别人收藏景点。");
  await expect(receiver.getByText("“来都来了。”")).toBeVisible();
});

test("maps historical 16-answer result links onto the retained 12 questions", async ({ page }) => {
  const scores = { npc: 25, chaos: 100, hype: 80, spend: 40, camera: 55, control: 10 };
  const legacyPath = "abcdabcdabcdabcd";
  const legacyPositions = [0, 1, 3, 4, 5, 6, 9, 10, 11, 12, 14, 15];
  const answers = questions.map((question, index) => ({
    questionId: question.id,
    optionId: legacyPath[legacyPositions[index]],
  }));
  const persona = getPersona("chaos-traveller");
  const world = getWorld(persona.worldId);
  const expected = createRuleBasedAnalysis(scores, persona, world, answers);
  const result = Buffer.from(JSON.stringify({ p: persona.id, s: scores, a: legacyPath })).toString("base64url");

  await page.goto(`/?result=${result}`);
  await expect(page.getByText(expected.roast, { exact: true })).toBeVisible();
});
