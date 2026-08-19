export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body;
  const apiKey = process.env.OPENROUTER_KEY;

  // --- أ) حسم الجولة والتحالفات والخيانة المظلمة ---
  if (action === 'resolve_round') {
    let { players, actions, alliances } = req.body;
    
    // مصفوفة لتسجيل حركة السمعة وتحديث التحالفات
    let roundLogs = [];
    let newAlliances = { ...alliances };

    // 1. معالجة طلبات التحالف السرية
    actions.forEach(act => {
      if (act.cardId === 'ALLIANCE' && act.targetIdx !== null && act.targetIdx !== undefined) {
        const p1 = act.playerIdx;
        const p2 = act.targetIdx;
        
        // التحالف يتم إنشاؤه وثيقة ثنائية
        const key = [Math.min(p1, p2), Math.max(p1, p2)].join('-');
        newAlliances[key] = true;
      }
    });

    // 2. تطبيق البطاقات العادية والمخاطرة
    actions.forEach(act => {
      const player = players[act.playerIdx];
      if (player.reputation <= 0) return;

      switch (act.cardId) {
        case 'BOOST':
          player.reputation += 2;
          roundLogs.push(`ارتفعت سمعة ${player.name} بمقدار 2.`);
          break;
        case 'BLESSING':
          player.reputation += 2; // نعمة بلا فاعل
          roundLogs.push(`حلت نعمة مجهولة وارتفعت سمعة ${player.name} بمقدار 2.`);
          break;
        case 'DISASTER':
          player.reputation = Math.max(0, player.reputation - 2); // نكبة بلا ذنب
          roundLogs.push(`أصابت نكبة غامضة ${player.name} وانخفضت سمعته بمقدار 2.`);
          break;
        case 'RISK':
          const win = Math.random() > 0.45;
          if (win) {
            player.reputation += 4;
            roundLogs.push(`شهدت الساحة قفزة في نفوذ ${player.name} (+4).`);
          } else {
            player.reputation = Math.max(0, player.reputation - 3);
            roundLogs.push(`تكبد ${player.name} انتكاسة شديدة (-3).`);
          }
          break;
        case 'ATTACK':
        case 'SLANDER':
          if (act.targetIdx !== null && act.targetIdx !== undefined) {
            const target = players[act.targetIdx];
            const dmg = act.cardId === 'ATTACK' ? 3 : 2;
            target.reputation = Math.max(0, target.reputation - dmg);
            roundLogs.push(`تذبذبت سمعة ${target.name} وانخفضت بمقدار ${dmg}.`);
          }
          break;
        case 'BETRAY':
          // الخيانة: تُلعب على الحليف حصراً ومخفية تماماً
          if (act.targetIdx !== null && act.targetIdx !== undefined) {
            const ally = players[act.targetIdx];
            const key = [Math.min(act.playerIdx, act.targetIdx), Math.max(act.playerIdx, act.targetIdx)].join('-');

            if (newAlliances[key]) {
              // قرعة الثمن الحتمي للفشل/النجاح
              const roll = Math.random(); // 0 to 1
              if (roll < 0.35) {
                // فشلت الخيانة: دفع 2 ثمنًا بلا مكسب
                player.reputation = Math.max(0, player.reputation - 2);
                roundLogs.push(`انخفضت سمعة ${player.name} بمقدار 2.`);
              } else if (roll < 0.70) {
                // نجاح جزئي: سحب 2 سمعة ودفع ضريبة 1
                const steal = Math.min(2, ally.reputation);
                ally.reputation = Math.max(0, ally.reputation - steal);
                player.reputation = Math.max(0, player.reputation + steal - 1);
                roundLogs.push(`انخفضت سمعة ${ally.name} بمقدار ${steal}.`);
                roundLogs.push(`انخفضت سمعة ${player.name} بمقدار 1.`);
              } else {
                // نجاح كامل: سحب 3 سمعة مع ضريبة 2
                const steal = Math.min(3, ally.reputation);
                ally.reputation = Math.max(0, ally.reputation - steal);
                player.reputation = Math.max(0, player.reputation + steal - 2);
                roundLogs.push(`انخفضت سمعة ${ally.name} بمقدار ${steal}.`);
                roundLogs.push(`انخفضت سمعة ${player.name} بمقدار 2.`);
              }
            }
          }
          break;
      }
    });

    // 3. بناء نص الراوي (AI Narrative) عبر OpenRouter
    let aiPrompt = `أنت القاضي والراوي المظلم في "المحكمة السرية".
احداث الجولة الدقيقة بدون كشف الفاعلين:
${roundLogs.join('\n')}

حالة السمعة الحالية للاعبين:
${JSON.stringify(players.map(p => ({ name: p.name, rep: p.reputation })))}

المطلوب: صغ نصاً أدبياً غامضاً ومشوّقاً من 3 أسطر باللغة العربية يصف التغيرات في سمعة اللاعبين دون ذكر البطاقات الملعوبة أو الفاعلين إطلاقاً. ثم اطرح سؤالاً بليغاً في النهاية يثير الشك والريبة لبدء النقاش.`;

    let narrativeText = "تساقطت الظلال في أروقة المحكمة واهتزت السمعة دون أن يفصح أحد عن جريرته...";

    if (apiKey) {
      try {
        const response = await fetch("https://openrouter.ai/ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "anthropic/claude-3-haiku",
            messages: [{ role: "user", content: aiPrompt }]
          })
        });
        const aiData = await response.json();
        narrativeText = aiData.choices?.[0]?.message?.content || narrativeText;
      } catch (e) {
        console.error("AI Error:", e);
      }
    }

    return res.status(200).json({
      players,
      alliances: newAlliances,
      narrative: narrativeText
    });
  }

  // --- ب) حسم التصويت وعواقب البراءة والاتهام ---
  if (action === 'resolve_vote') {
    const { players, accusedIdx, votes, actions } = req.body;
    const accused = players[accusedIdx];

    // التحقق هل أقدم المتهم على فعل هجومي أو تشهير حقيقي ضد أي لاعب في هذه الجولة؟
    const wasGuilty = actions.some(a => 
      a.playerIdx === accusedIdx && (a.cardId === 'ATTACK' || a.cardId === 'SLANDER')
    );

    let votersAgainst = [];
    Object.keys(votes).forEach(voterIdx => {
      if (votes[voterIdx] === accusedIdx) {
        votersAgainst.push(parseInt(voterIdx));
      }
    });

    let resultMsg = "";

    if (wasGuilty) {
      // المتهم مذنب: ينزل العقاب عليه بخصم 3 سمعة إضافية
      accused.reputation = Math.max(0, accused.reputation - 3);
      resultMsg = `ثبتت التهمة على ${accused.name}! تم فضح تحركاته المباشرة وخصم 3 نقاط سمعة إضافية منه.`;
    } else {
      // المتهم بريء: نجا المتهم والمصوتون عليه يتحملون العواقب (خصم 2 سمعة من كل مصوّت)
      votersAgainst.forEach(vIdx => {
        players[vIdx].reputation = Math.max(0, players[vIdx].reputation - 2);
      });
      accused.reputation += 1; // تعويض عن التهمة الباطلة
      resultMsg = `تبين أن ${accused.name} بريء من الهجوم المباشر! طال الخزي المصوتين وضاعت من كل منهم 2 سمعة، بينما كسب المتهم 1 سمعة تعويضية.`;
    }

    return res.status(200).json({
      players,
      wasGuilty,
      resultMsg
    });
  }
}
