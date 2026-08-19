export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body;

  // --- أ) حسم الجولة وتحديد قضية المحكمة ---
  if (action === 'resolve_round') {
    let { players, actions, pendingOffers, pendingMessages } = req.body;
    let newOffers = { ...pendingOffers };
    let newMessages = { ...pendingMessages };
    let detectedCrimes = [];

    actions.forEach(act => {
      const p = players[act.playerIdx];
      if (p.reputation <= 0) return;

      // 1. عرض تحالف
      if (act.card.id === 'ALLIANCE_OFFER' && act.targetIdx !== null) {
        if (!newOffers[act.targetIdx]) newOffers[act.targetIdx] = [];
        newOffers[act.targetIdx].push({ senderIdx: act.playerIdx, senderName: p.name });
      } 
      // 2. رسالة سرية
      else if (act.card.id === 'SECRET_MSG' && act.targetIdx !== null) {
        if (!newMessages[act.targetIdx]) newMessages[act.targetIdx] = [];
        newMessages[act.targetIdx].push({ senderName: p.name, text: act.customText || "رسالة غامضة..." });
      } 
      // 3. بطاقات الهجوم والسرقة
      else if (act.card.id === 'ATTACK' && act.targetIdx !== null) {
        let target = players[act.targetIdx];
        target.reputation = Math.max(0, target.reputation - 3);
        detectedCrimes.push({ type: 'ATTACK', culpritIdx: act.playerIdx, targetName: target.name });
      }
      else if (act.card.id === 'STEAL' && act.targetIdx !== null) {
        let target = players[act.targetIdx];
        let amount = Math.min(2, target.reputation);
        target.reputation -= amount;
        p.reputation += amount;
        detectedCrimes.push({ type: 'STEAL', culpritIdx: act.playerIdx, targetName: target.name });
      }
      else if (act.card.id === 'BOOST') {
        p.reputation += 2;
      }
    });

    // بناء قضية الجولة بناءً على الأحداث الفعلية
    let courtCase = { title: "", trueCulpritIdx: null };

    if (detectedCrimes.length > 0) {
      const crime = detectedCrimes[Math.floor(Math.random() * detectedCrimes.length)];
      courtCase.trueCulpritIdx = crime.culpritIdx;

      if (crime.type === 'ATTACK') {
        courtCase.title = `⚖️ قضية الجولة: تعرض [${crime.targetName}] لإدانة وهجوم سري! من الفاعل؟`;
      } else if (crime.type === 'STEAL') {
        courtCase.title = `⚖️ قضية الجولة: تمت سرقة نفوذ وسمعة من [${crime.targetName}]! من السارق؟`;
      }
    } else {
      courtCase.trueCulpritIdx = null; // لا أحد
      courtCase.title = `⚖️ قضية الجولة: تسود المحكمة أجواء هادئة... هل تعتقدون أن هناك مجرماً خفياً أم "لا أحد"؟`;
    }

    return res.status(200).json({
      players,
      pendingOffers: newOffers,
      pendingMessages: newMessages,
      courtCase
    });
  }

  // --- ب) حسم التصويت المحدد ---
  if (action === 'resolve_case_vote') {
    const { players, accusedIdx, trueCulpritIdx } = req.body;

    // إذا صوتوا على "لا أحد" (accusedIdx === null)
    if (accusedIdx === null) {
      if (trueCulpritIdx === null) {
        return res.status(200).json({ players, msg: "🎯 قرار صائب! بالفعل لم يرتكب أحد جُرمًا هذه الجولة. نَجَا الجميع." });
      } else {
        const culprit = players[trueCulpritIdx];
        culprit.reputation += 2;
        return res.status(200).json({ players, msg: `❌ خطأ! تم التغاضي عن الجريمة وإفلات الجاني [${culprit.name}] وتكافأ بـ +2 سمعة!` });
      }
    }

    // إذا تم اتهام لاعب معين
    if (accusedIdx === trueCulpritIdx) {
      const accused = players[accusedIdx];
      accused.reputation = Math.max(0, accused.reputation - 4);
      return res.status(200).json({ players, msg: `⚖️ حكم عادل! اتضح أن [${accused.name}] هو الفاعل الحقيقي وصُدِرت بحقه العقوبة (-4 سمعة)!` });
    } else {
      const accused = players[accusedIdx];
      accused.reputation += 2; // تعويض مظلوم
      return res.status(200).json({ players, msg: `😱 اتّهام باطل! [${accused.name}] بريء من هذه التهمة، وحصل على +2 سمعة كتعويض!` });
    }
  }
}
