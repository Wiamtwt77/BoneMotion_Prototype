export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body;
  const apiKey = process.env.OPENROUTER_KEY;

  // --- 1. حسم الجولة والبطاقات والتحالفات ---
  if (action === 'resolve_round') {
    let { players, actions, alliances, mobTarget } = req.body;
    let logs = [];
    let newAlliances = { ...alliances };

    // أ) معالجة بطاقات التحالف الخفي أولاً
    actions.forEach(act => {
      if (act.card.id === 'ALLIANCE' && act.targetIdx !== null) {
        const p1 = act.playerIdx;
        const p2 = act.targetIdx;
        const key = [Math.min(p1, p2), Math.max(p1, p2)].join('-');
        newAlliances[key] = true;
        logs.push(`نشأ عقد تحالف ظلي بين طرفين مجهولين.`);
      }
    });

    // ب) معالجة بقية البطاقات مع تطبيق ربط التحالف والمقاطعة
    actions.forEach(act => {
      const p = players[act.playerIdx];
      if (p.reputation <= 0) return;

      const card = act.card;
      let target = act.targetIdx !== null ? players[act.targetIdx] : null;

      // تطبيق التغير المباشر على صاحب البطاقة
      p.reputation += card.repChange || 0;

      // تطبيق التغير على الهدف (إن وجد) مع درع التحالف
      if (target && card.targetRepChange < 0) {
        let dmg = Math.abs(card.targetRepChange);
        
        // التحقق من وجود حليف لحمايته وتوزيع الضرر
        let allyIdx = players.findIndex((ally, idx) => {
          if (idx === target.id) return false;
          const key = [Math.min(target.id, idx), Math.max(target.id, idx)].join('-');
          return newAlliances[key] === true;
        });

        // إذا كانت البطاقة خيانة، تكسر الحلف سرّاً وتأخذ الضرر كاملاً
        if (card.id === 'BETRAY') {
          const key = [Math.min(p.id, target.id), Math.max(p.id, target.id)].join('-');
          delete newAlliances[key]; // كسر الحلف سرّاً
          target.reputation = Math.max(0, target.reputation - dmg);
          p.reputation += dmg; // سرقة السمعة
          logs.push(`انخفضت سمعة ${target.name} بمقدار ${dmg} جراء خديعة خفية.`);
        } else if (allyIdx !== -1 && players[allyIdx].reputation > 0) {
          // توزيع الضرر بين الحليفين (درع التحالف)
          const halfDmg = Math.ceil(dmg / 2);
          target.reputation = Math.max(0, target.reputation - halfDmg);
          players[allyIdx].reputation = Math.max(0, players[allyIdx].reputation - halfDmg);
          logs.push(`امتص درع التحالف الهجوم! تخفضت سمعة ${target.name} و${players[allyIdx].name} بمقدار ${halfDmg}.`);
        } else {
          target.reputation = Math.max(0, target.reputation - dmg);
          logs.push(`تأثرت سمعة ${target.name} وانخفضت بمقدار ${dmg}.`);
        }
      } else if (target && card.targetRepChange > 0) {
        target.reputation += card.targetRepChange;
      }

      p.reputation = Math.max(0, p.reputation);
    });

    // ج) صياغة الراوي السريعة والساخرة من AI (سريع وبدون تطويل)
    let narrative = "اختلطت الحابل بالنابل في أروقة المحكمة، وانخفضت سمعة البعض واعتلت سمعة آخرين في الظلام...";
    if (apiKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "anthropic/claude-3-haiku",
            messages: [{
              role: "user",
              content: `أنت راوٍ ساخر وموجز في لعبة "المحكمة السرية". اكتب تقريراً غامضاً وسريعاً من سطرين فقط باللغة العربية حول الأحداث التالية دون ذكر بطاقات أو فاعلين:
${logs.join('\n')}
ثم اطرح سؤالاً إتهامياً قصيراً جداً.`
            }]
          })
        });
        const aiData = await response.json();
        narrative = aiData.choices?.[0]?.message?.content || narrative;
      } catch (e) { console.error(e); }
    }

    return res.status(200).json({ players, alliances: newAlliances, narrative });
  }

  // --- 2. حسم التصويت الجماعي وإصدار الأحكام ---
  if (action === 'resolve_group_vote') {
    const { players, accusedIdx, actions, mobTarget } = req.body;

    if (accusedIdx === null || accusedIdx === undefined) {
      return res.status(200).json({ players, msg: "اتفق الجميع على الصمت والتغاضي. لم يُعاقب أحد." });
    }

    const accused = players[accusedIdx];
    const isGuilty = actions.some(a => a.playerIdx === accusedIdx && a.card.targetRepChange < 0);

    let msg = "";

    // التحقق من فوز المظلوم بدوره السري
    if (accused.role === 'VICTIM' && !isGuilty) {
      return res.status(200).json({
        players,
        gameEnded: true,
        msg: `🎉 فوز ساحق ومباغت! اتهمتم ${accused.name} وهو يحمل دور "المظلوم"! ينتهي النزاع بفوزه المباشر!`
      });
    }

    if (isGuilty) {
      accused.reputation = Math.max(0, accused.reputation - 4);
      msg = `ثبتت التهمة على ${accused.name}! تم فضح تحركاته المباشرة وتجريده من 4 نقاط سمعة.`;

      // مكافأة الجلاد
      players.forEach(p => {
        if (p.role === 'EXECUTIONER' && p.id !== accusedIdx) p.reputation += 2;
      });
    } else {
      // البريء ينجو والمصوتون يدفعون الغرامة
      players.forEach((p, idx) => {
        if (idx !== accusedIdx && p.reputation > 0) {
          p.reputation = Math.max(0, p.reputation - 2);
        }
      });
      accused.reputation += 2;
      msg = `سقطتم في الفخ! اتضح أن ${accused.name} بريء! خسر كل مصوّت 2 سمعة، واسترد المتهم عافيته (+2).`;
    }

    return res.status(200).json({ players, msg, gameEnded: false });
  }
}
