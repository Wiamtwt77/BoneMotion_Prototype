export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body;
  const apiKey = process.env.OPENROUTER_KEY;

  // --- أ) تحليل بطاقة "الصندوق الحر" بواسطة AI ---
  if (action === 'analyze_custom_card') {
    const { player, text, targetName } = req.body;
    
    const prompt = `أنت القاضي في لعبة "المحكمة السرية".
اللاعب: "${player}" اختار بطاقة "الصندوق الحر" وكتب الفعل التالي:
"${text}" ${targetName ? `ضد الهدف: "${targetName}"` : ''}

قم بتقييم هذا الفعل بحيادية ومغامرة:
1. حدد التغير في سمعة صاحب الفعل (repChange: رقم موجب أو سالب بين -3 و +3).
2. حدد التغير في سمعة الهدف إن وجد (targetRepChange: رقم بين -3 و +3).
3. اكتب نتيجة قصيرة ودرامية جداً في سطر واحد بدون ذكر التفاصيل المباشرة.

أخرج الناتج بصيغة JSON فقط:
{"repChange": 0, "targetRepChange": 0, "log": "نص النتيجة"}`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "anthropic/claude-3-haiku",
          messages: [{ role: "user", content: prompt }]
        })
      });
      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1));
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(200).json({ repChange: 1, targetRepChange: -1, log: "نفذ الحركة ولكن أثرها كان غامضاً." });
    }
  }

  // --- ب) حسم الجولة وتقرير التحقيق ---
  if (action === 'resolve_round') {
    let { players, actions, alliances, pendingAllianceOffers } = req.body;
    let logs = [];
    let newAlliances = { ...alliances };
    let newPending = { ...pendingAllianceOffers };

    actions.forEach(act => {
      const p = players[act.playerIdx];
      if (p.reputation <= 0) return;

      if (act.card.id === 'ALLIANCE_OFFER' && act.targetIdx !== null) {
        newPending[act.targetIdx] = act.playerIdx; // تسجيل عرض معلق للهدف
        logs.push(`تم إرسال عرض تحالف خفي في الظلام.`);
      } else if (act.card.id === 'CUSTOM_ACT') {
        p.reputation += act.customResult.repChange || 0;
        if (act.targetIdx !== null && players[act.targetIdx]) {
          players[act.targetIdx].reputation += act.customResult.targetRepChange || 0;
        }
        logs.push(act.customResult.log);
      } else {
        p.reputation += act.card.repChange || 0;
        if (act.targetIdx !== null && players[act.targetIdx]) {
          let target = players[act.targetIdx];
          target.reputation = Math.max(0, target.reputation + (act.card.targetRepChange || 0));
          logs.push(`تأثرت سمعة ${target.name} بفعل سري.`);
        }
      }
      p.reputation = Math.max(0, p.reputation);
    });

    // احتمال 35% لصدور تقرير تحقيق كاشف للشبهات
    const isSuspiciousRound = Math.random() < 0.35;
    let suspectPlayer = null;
    if (isSuspiciousRound && actions.length > 0) {
      const randomAct = actions[Math.floor(Math.random() * actions.length)];
      suspectPlayer = players[randomAct.playerIdx]?.name;
    }

    let narrative = isSuspiciousRound && suspectPlayer
      ? `🚨 تحذير القاضي: أدلة سريّة تشير إلى أن تحركات [${suspectPlayer}] هذه الجولة كانت خبيثة ومريبة جداً!`
      : "مرت الجولة بسلام ظاهري، لكن التغيرات في السمعة تومئ باستعدادات تحت الطاولة...";

    return res.status(200).json({ players, alliances: newAlliances, pendingAllianceOffers: newPending, narrative });
  }

  // --- ج) حسم التصويت ---
  if (action === 'resolve_group_vote') {
    const { players, accusedIdx, actions } = req.body;
    if (accusedIdx === null) return res.status(200).json({ players, msg: "تم التغاضي عن الجميع." });

    const accused = players[accusedIdx];
    const isGuilty = actions.some(a => a.playerIdx === accusedIdx && (a.card.targetRepChange < 0 || (a.customResult && a.customResult.targetRepChange < 0)));

    if (isGuilty) {
      accused.reputation = Math.max(0, accused.reputation - 4);
      return res.status(200).json({ players, msg: `ثبتت التهمة على ${accused.name}! تم كشف جرمه وخصم 4 سمعة منه.` });
    } else {
      players.forEach((p, idx) => {
        if (idx !== accusedIdx && p.reputation > 0) p.reputation = Math.max(0, p.reputation - 2);
      });
      accused.reputation += 2;
      return res.status(200).json({ players, msg: `ظلمتم ${accused.name}! اتضح أنه بريء وسقط خصم 2 سمعة على كل مصوّت.` });
    }
  }
}
