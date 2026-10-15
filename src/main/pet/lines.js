'use strict';
// Câu thoại mặc định của core (dùng khi ctx.persona.pick không có / trả null).
// Xưng "tớ", gọi "cậu". Nhắc lịch: nói rõ việc gì, giờ nào trước rồi mới dễ thương. Không emoji. <=120 ký tự.
// Biến: {title} {time} {left} {label} {count}

const LINES = {
  pre: [
    'Sắp tới giờ rồi: {title}, lúc {time}, còn {left} nữa. Cậu chuẩn bị nha.',
    '{title} lúc {time}, còn {left} nữa thôi đó. Tớ nhắc trước nè.',
    'Còn {left} nữa là tới {title} ({time}). Cậu xong việc đang làm chưa?',
    'Cậu ơi, {time} có {title}, còn {left} nữa. Đừng quên nha.'
  ],
  due: [
    'Tới giờ rồi: {title} ({time}). Tớ cầm note lên cho cậu đó.',
    '{time} rồi nè, tới giờ {title}. Cậu làm thôi nào.',
    'Tới giờ {title} rồi cậu ơi ({time}). Tớ không quên đâu nha.',
    '{title}, {time}, ngay bây giờ nè. Cậu đi thôi.'
  ],
  due_again: [
    'Cậu ơi, {title} (lúc {time}) vẫn chưa xong đó. Tớ nhắc lại nè.',
    'Này, đừng làm lơ tớ chứ. {title} đang chờ cậu đó.',
    'Tớ gọi lần nữa nè: {title}, đã {time} rồi mà.',
    '{title} vẫn đang chờ cậu đó. Xong thì bấm giúp tớ nha.'
  ],
  nag: [
    'Còn {count} việc quá hạn đó. Cậu xem thử hoặc hoãn giúp tớ nha.',
    'Có {count} việc quá hạn chưa xong. Tớ hơi lo đó, cậu xem nha.',
    'Cậu ơi, {count} việc quá hạn đang chờ. Làm hay hoãn đi mà.'
  ],
  alarm: [
    'Báo thức {label} kêu rồi nè! Cậu bấm Tắt hoặc Hoãn giúp tớ nha.',
    '{label}: tới giờ báo thức rồi đó. Tắt hay hoãn đây cậu?',
    'Reng reng, {label}! Cậu dậy xử lý giúp tớ với.'
  ],
  alarm_stop: [
    'Tắt rồi nè. Tớ cũng đỡ ồn tai.',
    'Xong, tớ tắt báo thức rồi nha.'
  ],
  alarm_snooze: [
    'Ừ, hoãn {left} nữa rồi tớ gọi lại nha.',
    'Hoãn {left} nè. Hết giờ là tớ réo lại đó.'
  ],
  memo: [
    'Cậu dặn tớ nhắc: {title}. Tớ nhắc đây nha.',
    'Dặn dò nè: {title}. Cậu nhớ giúp tớ nhé.',
    'Tớ nhớ cậu có dặn: {title}. Giờ là lúc đó rồi.'
  ],
  done: [
    'Giỏi quá! Tớ biết cậu làm được mà.',
    'Xong rồi hả, tuyệt quá. Tớ vui lắm đó.',
    'Cậu làm xong rồi nè. Hì, tớ tự hào ghê.'
  ],
  done_late: [
    'Xong rồi là tốt rồi. Lần sau cậu nhớ sớm hơn chút nha.',
    'Muộn một chút cũng không sao. Cậu làm xong là được rồi.'
  ],
  snooze: [
    'Ừa, 10 phút nữa tớ gọi lại nha.',
    'Hoãn 10 phút nhé. Hết giờ tớ nhắc lại liền.'
  ],
  startup: [
    'Chào cậu! Tới giờ là tớ chạy ra nhắc liền.',
    'Tớ đây. Cậu cứ làm việc đi, giờ nào tớ nhớ giờ đó.',
    'Hì, cậu gọi tớ hả? Có việc gì cần nhắc không?'
  ],
  click: [
    'Á, đừng chọc tớ mà, tớ ngại đó.',
    'Hửm? Cậu gọi tớ hả?',
    'Tớ đang nghĩ tới bánh mochi đây, ngọt ngọt dẻo dẻo.',
    'Đừng lo, tớ vẫn ở đây canh giờ cho cậu.',
    'Tớ muốn ôm một bé mèo quá, meo.'
  ],
  reward: [
    'Cậu giỏi quá, tớ có quà cho cậu nè.',
    'Hay lắm! Tớ vui ghê.'
  ],
  chatter: [
    'Tớ ngồi đây canh giờ cho cậu nha.',
    'Hì, hôm nay cậu làm việc chăm quá.',
    'Tớ thèm bánh ngọt một chút xíu.'
  ]
};

const recent = new Map();   // event -> index câu vừa dùng

function fill(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (_m, k) => (vars && vars[k] != null ? String(vars[k]) : ''))
    .replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** pick(event, vars) -> {text} | null. Tránh lặp câu vừa dùng của cùng event. */
function pick(event, vars, rnd = Math.random) {
  const arr = LINES[event];
  if (!arr || !arr.length) return null;
  let i = Math.floor(rnd() * arr.length) % arr.length;
  if (arr.length > 1 && recent.get(event) === i) i = (i + 1) % arr.length;
  recent.set(event, i);
  let text = fill(arr[i], vars);
  if (text.length > 120 && vars && vars.title) {
    // rút gọn tiêu đề cho vừa 120 ký tự
    const over = text.length - 120 + 1;
    const t = String(vars.title);
    const short = t.slice(0, Math.max(8, t.length - over)) + '…';
    text = fill(arr[i], Object.assign({}, vars, { title: short }));
  }
  return { text: text.slice(0, 120) };
}

module.exports = { LINES, pick, fill };
