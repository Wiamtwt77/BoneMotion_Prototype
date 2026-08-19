export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body;
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'مفتاح OPENROUTER_KEY غير مفعّل في بيئة Vercel' });
  }

  // --- 1. توليد بطاقات ديناميكية ومبتكرة للاعب ---
  if (action === 'generate_cards') {
    const { player, reputation } = req.body;
    
    // احتمال 20% لفرض "بطاقة مجبرة" (نعمة أو نقمة)
    const isForced = Math.random() < 0.20;

    const prompt = `أنت محرك لعبة "المحكمة السرية".
قم بابتكار بطاقات للاعب اسمه "${player}" ورصيد سمعته الحالي ${reputation}.

المطلوب:
${isForced 
  ? `ابتكر بطاقة واحدة إجبارية فقط (إما "نعمة حتمية" تعطي سمعة، أو "نقمة مظلمة" تخصم سمعة). اجعل isForced: true.`
  : `ابتكر 3 بطاقات فريدة وجديدة تماماً. كل بطاقة يجب أن تحتوي على ميزة (جيدة) وعيب/مخاطرة (سيئة).`
}

أخرج الناتج بصيغة JSON فقط بهذا الشكل الدقيق دون أي نص إضافي:
{
  "isForced": ${isForced},
  "cards": [
    {
      "id": "معرف_فريد",
      "name": "اسم البطاقة المبتكر",
      "desc": "شرح الميزة والمخاطرة",
      "repChange": 2, // التغير في سمعة صاحبها (موجب أو سالب)
      "targetRepChange": -2, // التغير في سمعة الهدف إن وجد (أو 0)
      "requiresTarget": true, // هل تتطلب اختيار خصم؟
      "isBetrayal": false // هل هي خيانة تحالف؟
    }
  ]
}`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
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
      // احتياطي في حال تعثر الـ AI
      return res.status(200).json({
        isForced: false,
        cards: [
          { id: 'c1', name: 'صفقة مظلمة', desc: '+3 سمعة لك، وتخصم -2 من خصمك', repChange: 3, targetRepChange: -2, requiresTarget: true },
          { id: 'c2', name: 'تضحية استراتيجية', desc: '-1 سمعة لك مقابل حماية مستقبليّة', repChange: -1, targetRepChange: 0, requiresTarget: false }
        ]
      });
    }
  }

  // --- 2. معالجة الجولة وصياغة الراوي ---
  if (action === 'resolve_round') {
    const { players, actions } = req.body;
    let logs = [];

    actions.forEach(act => {
      const p = players[act.playerIdx];
      if (p.reputation <= 0) return;

      p.reputation += act.card.repChange || 0;

      if (act.targetIdx !== null && act.targetIdx !== undefined) {
        const target = players[act.targetIdx];
        target.reputation += act.card.targetRepChange || 0;
        logs.push(`تأثرت سمعة ${target.name} بسبب تحرك مجهول.`);
      }

      p.reputation = Math.max(0, p.reputation);
    });

    const aiPrompt = `صغ تقريراً أدبياً غامضاً من 3 أسطر عن تغيرات السمعة هذه دون كشف الفاعلين أو أسماء البطاقات:
${JSON.stringify(players.map(p => ({ name: p.name, rep: p.reputation })))}.
ثم اختم بسؤال مثير للشك لبدء النقاش الجماعي.`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      return res.status(200).json({
        players,
        narrative: aiData.choices?.[0]?.message?.content || "اهتزت الأركان واختلطت الأوراق..."
      });
    } catch (e) {
      return res.status(200).json({ players, narrative: "تغيرت موازين السمعة في الظلام..." });
    }
  }

  // --- 3. التصويت الجماعي العلني وحسم البراءة/الإدانة ---
  if (action === 'resolve_group_vote') {
    const { players, accusedIdx, actions } = req.body;
    
    if (accusedIdx === null || accusedIdx === undefined) {
      return res.status(200).json({ players, msg: "اتفق الجميع على التغاضي ولم يُعاقب أحد في هذه الجولة." });
    }

    const accused = players[accusedIdx];
    // التحقق هل ألحق المتهم ضرراً بغيره فعلاً في هذه الجولة؟
    const isGuilty = actions.some(a => a.playerIdx === accusedIdx && a.card.targetRepChange < 0);

    if (isGuilty) {
      accused.reputation = Math.max(0, accused.reputation - 3);
      return res.status(200).json({
        players,
        msg: `ثبتت التهمة بالتصويت الجماعي على ${accused.name}! تم كشف جرمه وخصم 3 نقاط سمعة إضافية منه.`
      });
    } else {
      // البريء ينجو والمصوتون (بقية الأحياء) يدفعون الثمن
      players.forEach((p, idx) => {
        if (idx !== accusedIdx && p.reputation > 0) {
          p.reputation = Math.max(0, p.reputation - 2);
        }
      });
      accused.reputation += 1;
      return res.status(200).json({
        players,
        msg: `اتضح أن ${accused.name} بريء! دفع جميع المصوتين الثمن (-2 سمعة لكل منهم)، وكسب المتهم +1 تعويضاً.`
      });
    }
  }
}
