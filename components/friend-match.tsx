import { HeartHandshake, Link2, Send, Sparkles, Users } from "lucide-react";
import { calculateFriendMatch, type FriendSnapshot } from "@/lib/friend-match";
import type { Scores } from "@/lib/types";
import type { Language } from "@/lib/i18n";

type Props = {
  scores: Scores;
  friend?: FriendSnapshot | null;
  language?: Language;
  onShareMatch?: () => void;
};

export function FriendMatch({ scores, friend, language = "zh", onShareMatch }: Props) {
  const en = language === "en";
  if (!friend) {
    return (
      <section data-testid="friend-match" className="mt-6 overflow-hidden rounded-[2rem] border-2 border-[#17142f] bg-[#ffd84d] p-6 shadow-[6px_6px_0_#17142f] sm:p-9">
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div className="grid h-20 w-20 place-items-center rounded-3xl border-2 border-[#17142f] bg-white shadow-[4px_4px_0_#7657ff]"><Users size={36} strokeWidth={2.5} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#5635c7]">Friend Match · {en ? "Locked" : "待解锁"}</p>
            <h2 className="display mt-2 text-3xl sm:text-5xl">{en ? "Now put the friendship through airport security" : "你负责交卷，好友负责接受友情质检"}</h2>
            <p className="mt-3 max-w-3xl font-bold leading-relaxed text-black/65">{en ? "Use “Invite a friend” at the bottom of the page. Once they finish, AI will decide whether you belong on the same flight—or in separate terminals." : "使用页面底部的“邀请朋友来测”发送链接。对方完成测试后，AI 会告诉你们：是该坐同一班飞机，还是保持安全距离。"}</p>
          </div>
        </div>
      </section>
    );
  }

  const match = calculateFriendMatch(scores, friend.s, language);

  return (
    <section data-testid="friend-match" className="mt-6 overflow-hidden rounded-[2rem] border-2 border-[#17142f] bg-[#ffd84d] p-6 shadow-[6px_6px_0_#17142f] sm:p-9">
      <div className="grid gap-7 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
        <div className="rounded-[1.75rem] border-2 border-[#17142f] bg-[#17142f] p-6 text-center text-white shadow-[6px_6px_0_#7657ff]">
          <HeartHandshake className="mx-auto text-[#c8ff55]" size={34} />
          <p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-white/65">Friend Match</p>
          <strong data-testid="friend-match-percentage" className="display mt-2 block text-7xl text-[#ffd84d] sm:text-8xl">{match.percentage}%</strong>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[#5635c7]"><Sparkles size={19} /><span className="text-xs font-black uppercase tracking-[.18em]">{en ? "Travel compatibility report" : "友情旅行兼容性报告"}</span></div>
          <h2 className="display mt-3 text-balance text-4xl leading-tight sm:text-5xl">{match.headline}</h2>
          <p className="mt-4 max-w-3xl text-lg font-bold leading-relaxed text-black/70">{match.summary}</p>
          {onShareMatch && <button data-testid="friend-match-share" onClick={onShareMatch} className="button-pop focus-ring mt-5 inline-flex items-center gap-2 rounded-xl border-2 border-[#17142f] bg-white px-5 py-3 font-black shadow-[4px_4px_0_#17142f]"><Send size={18} /> {en ? "Send match result back" : "把匹配结果发回给好友"}</button>}
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-black/50"><Link2 size={14} /> {en ? "This return link reconnects both scores, so either friend can open the same compatibility report." : "回传链接会接回双方分数，任意一方打开都能直接看到这份匹配报告。"}</p>
        </div>
      </div>
    </section>
  );
}
