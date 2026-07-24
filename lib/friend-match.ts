import { dimensionLabels, englishDimensionLabels } from "@/lib/constants";
import type { Language } from "@/lib/i18n";
import { decodeSharedResult, encodeSharedResult } from "@/lib/share";
import { dimensionIds, type DimensionId, type Scores } from "@/lib/types";

export type FriendSnapshot = { p: string; s: Scores };

const frictionTeases: Record<DimensionId, string> = {
  npc: "一个等对方拍板，一个已经替全队做主；群聊不会冷场，但可能很长。",
  chaos: "一个把意外叫隐藏支线，另一个已经在搜索客服；翻车时记得先保护友情。",
  hype: "一个已经付款，另一个还在研究退款规则；限定名额会成为感情压力测试。",
  spend: "一个想升级房型，一个在心算人均；建议出发前先统一“值得”的定义。",
  camera: "一个在追光找角度，一个已经走出画面；摄影师岗位需要提前排班。",
  control: "一个想给散步建表格，一个把表格当壁纸；行程表最好准备可编辑版本。",
};

function isScores(value: unknown): value is Scores {
  if (!value || typeof value !== "object") return false;
  return dimensionIds.every((dimension) => {
    const score = (value as Record<string, unknown>)[dimension];
    return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
  });
}

export function encodeFriendSnapshot(snapshot: FriendSnapshot) {
  return encodeSharedResult(snapshot);
}

export function decodeFriendSnapshot(value: string): FriendSnapshot {
  const payload = decodeSharedResult(value);
  if (typeof payload.p !== "string" || !isScores(payload.s)) throw new Error("Invalid friend snapshot");
  return { p: payload.p, s: payload.s };
}

function matchVerdict(percentage: number) {
  if (percentage >= 90) return { headline: "旅行脑电波疑似共用同一条 Wi‑Fi", summary: "默契高到有点可疑，唯一的风险是你们可能一起冲得太快，却没人负责踩刹车。" };
  if (percentage >= 75) return { headline: "适合一起出发，偶尔争夺导游话筒", summary: "大方向不用解释，小分歧足够制造旅途素材，属于回来后还能继续约下一次。" };
  if (percentage >= 60) return { headline: "有默契也有分工，吵完还能赶上车", summary: "你们不是复制粘贴，但差异暂时还在友情可承受范围内。" };
  if (percentage >= 40) return { headline: "互补得很具体，出发前建议先划分权限", summary: "一个人的理所当然，可能是另一个人的突发事故；好消息是至少不容易无聊。" };
  return { headline: "友情经得起考验，行程未必经得起", summary: "建议购买可取消选项、准备两份路线，并约定谁先翻白眼谁负责买咖啡。" };
}

const harmonySummaries: Record<DimensionId, { zh: string; en: string }> = {
  npc: { zh: "好在需要做决定时，你们通常能很快读懂彼此的节奏。", en: "When a decision is needed, you usually read each other’s rhythm without a committee meeting." },
  chaos: { zh: "面对临时变化时，你们大概率能用相近的心态把意外接住。", en: "When plans change, you are likely to absorb the surprise with a very similar attitude." },
  hype: { zh: "遇到新鲜玩法时，你们的兴奋点通常来得很同步。", en: "New experiences tend to excite both of you at almost exactly the same moment." },
  spend: { zh: "对什么体验值得投入，你们通常不用解释太久。", en: "You rarely need a long debate about which experiences are worth the investment." },
  camera: { zh: "对记录旅程还是专心体验，你们往往很有默契。", en: "You tend to agree on when to capture the moment and when to simply live it." },
  control: { zh: "在提前规划和临场发挥之间，你们通常能找到相近的节奏。", en: "You usually find a similar balance between planning ahead and improvising." },
};

const coordinationSummaries: Record<DimensionId, { zh: string; en: string }> = {
  npc: { zh: "需要拍板时最好先说清谁带头，免得一个还在等信号，另一个已经替全队决定。", en: "Decide who takes the lead before one person waits for a signal while the other forms a transport ministry." },
  chaos: { zh: "临时状况出现时，你们对“惊喜”和“事故”的定义可能不太一样，提前留点缓冲会更轻松。", en: "Your definitions of ‘surprise’ and ‘emergency’ may differ, so leave some breathing room in the plan." },
  hype: { zh: "遇到限时优惠和热门玩法时，最好给彼此一点冷静确认的时间。", en: "When a countdown or trending experience appears, give each other a moment for a calm confirmation." },
  spend: { zh: "升级体验之前先确认彼此的预算边界，能省掉不少旅途小情绪。", en: "Agree on budget boundaries before upgrading the experience; it will save several small travel resentments." },
  camera: { zh: "行程里留一点记录时间，也留一点不等镜头的自由，双方都会更自在。", en: "Leave room both for capturing the trip and for moving on without waiting for the perfect shot." },
  control: { zh: "把必须执行和可以随缘的安排分开，你们的旅程会轻松很多。", en: "Separate the non-negotiable plans from the optional ones and the trip will feel much easier." },
};

export function calculateFriendMatch(yours: Scores, friend: Scores, language: Language = "zh") {
  const differences = dimensionIds
    .map((dimension) => ({ dimension, difference: Math.abs(yours[dimension] - friend[dimension]) }))
    .sort((a, b) => a.difference - b.difference);
  const averageDifference = differences.reduce((sum, item) => sum + item.difference, 0) / dimensionIds.length;
  const percentage = Math.max(0, Math.min(100, Math.round(100 - averageDifference)));
  const closest = differences[0];
  const friction = differences[differences.length - 1];
  const harmony = [...differences].sort((a, b) => {
    if (a.difference !== b.difference) return a.difference - b.difference;
    const aSharedSignal = yours[a.dimension] + friend[a.dimension];
    const bSharedSignal = yours[b.dimension] + friend[b.dimension];
    return bSharedSignal - aSharedSignal;
  })[0];
  const behavioralSummary = percentage >= 70 ? harmonySummaries[harmony.dimension] : coordinationSummaries[friction.dimension];
  if (language === "en") {
    const verdict = percentage >= 90 ? ["Same travel brain. One shared remaining brain cell.", "The compatibility is suspiciously high; your main risk is enabling each other while nobody remembers the passports."] : percentage >= 75 ? ["Book the trip. Expect one dramatic disagreement at Departures.", "You agree on the important things and differ just enough to generate excellent post-trip lore."] : percentage >= 60 ? ["Compatible enough to share a room—and the blame", "Not identical, but the differences are still within friendship’s baggage allowance."] : percentage >= 40 ? ["A strong case for separate itineraries and one shared dinner", "One person’s obvious choice may be the other’s minor emergency, but you will not be bored."] : ["The friendship is strong. It will need to be.", "Book cancellable everything, keep two itineraries, and decide in advance who gets custody of the charger."];
    const frictionCopy: Record<DimensionId, string> = { npc: "One is waiting for a decision; the other has formed a transport ministry. The group chat will require minutes.", chaos: "One calls it a side quest. The other is already on hold with customer service. Save the friendship before filming the recap.", hype: "One has paid; the other is reading the cancellation policy. A red countdown timer could end this friendship.", spend: "One wants the suite; the other has opened Splitwise. Define ‘worth it’ before anyone enters card details.", camera: "One is chasing golden hour; the other has walked out of frame. Photographer duties require a formal rota.", control: "One has made a spreadsheet for wandering. The other has muted the spreadsheet. Keep one editable copy and several deep breaths." };
    return { percentage, closest: { ...closest, label: englishDimensionLabels[closest.dimension] }, friction: { ...friction, label: englishDimensionLabels[friction.dimension] }, closestTease: `Only ${closest.difference} points apart on ${englishDimensionLabels[closest.dimension]}. Finally, something that does not need a poll.`, frictionTease: frictionCopy[friction.dimension], headline: verdict[0], summary: `${verdict[1]} ${behavioralSummary.en}` };
  }

  const verdict = matchVerdict(percentage);
  return {
    percentage,
    closest: { ...closest, label: dimensionLabels[closest.dimension] },
    friction: { ...friction, label: dimensionLabels[friction.dimension] },
    closestTease: `你们在「${dimensionLabels[closest.dimension]}」上只差 ${closest.difference} 分，至少这件事不用开会。`,
    frictionTease: frictionTeases[friction.dimension],
    headline: verdict.headline,
    summary: `${verdict.summary} ${behavioralSummary.zh}`,
  };
}
