/* ============================================================
 * 青晏的个人工作台 · 渲染与交互
 * 依赖：js/data.js (window.WB_DATA)
 * 状态：localStorage 'wb.v1'（勾选、自建任务、主题）
 * ============================================================ */
(function () {
  'use strict';
  const D = window.WB_DATA;

  /* ---------- 工具 ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const pad = n => String(n).padStart(2, '0');
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysUntil = s => Math.round((parseDate(s) - today0()) / 86400000);
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

  function semesterWeek() {
    const diff = Math.floor((today0() - parseDate(D.semester.start)) / 86400000 / 7) + 1;
    return Math.min(Math.max(diff, 1), D.semester.totalWeeks);
  }
  function isoWeekKey() {
    const d = new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const wk = Math.ceil((((t - y0) / 86400000) + 1) / 7);
    return t.getUTCFullYear() + '-W' + pad(wk);
  }
  const fmtCN = d => `${d.getMonth() + 1} 月 ${d.getDate()} 日`;

  /* ---------- 状态 ---------- */
  const SKEY = 'wb.v1';
  let state = { checks: {}, custom: [], theme: 'light' };
  try { Object.assign(state, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* 首次使用 */ }
  // 产品定版浅色为默认：每个迁移版本强制切一次浅色，之后尊重用户手动切换
  if (state.themeV3 !== 'light') { state.theme = 'light'; state.themeV3 = 'light'; try { save(); } catch (e) { } }
  const save = () => localStorage.setItem(SKEY, JSON.stringify(state));

  // 勾选键：周常量任务按「周」记忆，其余按「永久」记忆
  const checkKey = (id, weekly) => weekly ? `${id}@${isoWeekKey()}` : id;
  const isChecked = (id, weekly) => !!state.checks[checkKey(id, weekly)];
  const setCheck = (id, weekly, val) => {
    const k = checkKey(id, weekly);
    if (val) state.checks[k] = 1; else delete state.checks[k];
    save();
  };

  /* ---------- 视图注册 ---------- */
  const VIEWS = {};
  function renderActive() {
    const name = (location.hash || '#dashboard').slice(1);
    const view = VIEWS[name] ? name : 'dashboard';
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    const fn = VIEWS[view];
    if (fn) { fn($('#view-' + view)); window.scrollTo({ top: 0 }); }
  }

  /* ============================================================
   * 视图：总览
   * ============================================================ */
  VIEWS.dashboard = function (root) {
    const now = new Date();
    const wk = semesterWeek();
    const hour = now.getHours();
    const greet = hour < 5 ? '夜深了' : hour < 10 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

    const cd = D.countdowns.map(c => {
      const n = daysUntil(c.date);
      return { ...c, n };
    });

    // 今日课程
    const dow = now.getDay();
    const todayCourses = D.courses
      .filter(c => c.day === dow && wk >= c.from && wk <= c.to)
      .sort((a, b) => toMin(a.start) - toMin(b.start))
      .map(c => {
        const nm = toMin(c.start), ne = toMin(c.end), cur = now.getHours() * 60 + now.getMinutes();
        return { ...c, status: cur < nm ? 'up' : cur <= ne ? 'now' : 'past' };
      });
    const nextC = todayCourses.find(c => c.status === 'up');
    const nowC = todayCourses.find(c => c.status === 'now');

    // 冲刺任务（按截止排序，取最近 5 条）
    const sprints = D.tasks.sprint.map(s => ({ ...s, n: daysUntil(s.due) })).sort((a, b) => a.n - b.n).slice(0, 5);

    // 求职差距总进度
    const allSteps = D.career.gaps.flatMap(g => g.steps.map(s => g.id + '::' + s.t));
    const doneSteps = allSteps.filter(k => state.checks[k]).length;
    const gapPct = Math.round(doneSteps / allSteps.length * 100);

    // 本周常量完成度
    const wDone = D.tasks.weekly.filter(t => isChecked(t.id, true)).length;
    const wPct = Math.round(wDone / D.tasks.weekly.length * 100);

    root.innerHTML = `
      <div class="hero card">
        <div class="hero-text">
          <div class="hero-hi">${greet}，${D.profile.alias} 👋</div>
          <div class="hero-date">${now.getFullYear()} 年 ${fmtCN(now)} · ${D.dayNames[dow]} · 第 ${wk} 周 / 共 ${D.semester.totalWeeks} 周</div>
          <div class="hero-next">${nowC ? `📌 正在上：${nowC.name}（至 ${nowC.end} · ${nowC.loc || '见教务通知'}）`
        : nextC ? `⏭️ 下一节：${nextC.name} ${nextC.start} @ ${nextC.loc || '见教务通知'}`
          : (todayCourses.length ? '✅ 今天课都上完了' : '🌤️ 今天没有课，自由时间')}</div>
        </div>
        <div class="hero-avatar"><img src="${D.profile.avatar}" alt="avatar"></div>
      </div>

      <div class="grid-4">
        ${cd.map(c => `
          <div class="card cd-card ${c.n <= 3 && c.hot ? 'cd-hot' : ''} ${c.n < 0 ? 'cd-past' : ''}">
            <div class="cd-num">${c.n < 0 ? `+${-c.n}` : c.n}<span class="cd-unit">天</span></div>
            <div class="cd-label">${c.label}</div>
            <div class="cd-note">${c.note}</div>
          </div>`).join('')}
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>📐 求职补齐进度</h3>
          <div class="bigbar"><div class="bigbar-fill" style="width:${gapPct}%"></div></div>
          <div class="bar-caption">${doneSteps} / ${allSteps.length} 项补齐动作完成 · 通往「京东采销 2029 届」</div>
          <h3 style="margin-top:18px">🔁 本周常量</h3>
          <div class="bigbar green"><div class="bigbar-fill" style="width:${wPct}%"></div></div>
          <div class="bar-caption">${wDone} / ${D.tasks.weekly.length} 项 · ${wPct >= 100 ? '本周全清，漂亮 ✨' : '周日晚复盘前清完'}</div>
        </div>
        <div class="card">
          <h3>🎯 冲刺任务 · 最近截止</h3>
          <ul class="mini-list">
            ${sprints.map(s => `
              <li>
                <span class="mini-dot ${s.n < 0 ? 'over' : s.n <= 7 ? 'soon' : ''}"></span>
                <span class="mini-text">${s.t}</span>
                <span class="mini-due ${s.n < 0 ? 'over' : s.n <= 7 ? 'soon' : ''}">${s.n < 0 ? `超 ${-s.n} 天` : s.n === 0 ? '今天' : `${s.n} 天`}</span>
              </li>`).join('')}
          </ul>
          <a class="more-link" href="#tasks">去任务板 →</a>
        </div>
      </div>

      <div class="card">
        <h3>📖 今日课程</h3>
        ${todayCourses.length ? `
          <ul class="course-today">
            ${todayCourses.map(c => `
              <li class="${c.status}">
                <div class="ct-time">${c.start}<span> - ${c.end}</span></div>
                <div class="ct-main"><b>${c.name}</b><span>${c.loc || '见教务通知'}${c.teacher ? ' · ' + c.teacher : ''}</span></div>
                <div class="ct-status">${c.status === 'now' ? '<em class="tag now">进行中</em>' : c.status === 'past' ? '<em class="tag past">已结束</em>' : '<em class="tag up">未开始</em>'}</div>
              </li>`).join('')}
          </ul>` : '<p class="muted">今天没有课。适合推一格求职进度 🚀</p>'}
      </div>`;
  };

  /* ============================================================
   * 视图：求职作战室
   * ============================================================ */
  VIEWS.career = function (root) {
    const C = D.career;
    root.innerHTML = `
      <h2>🎯 求职作战室</h2>
      <p class="page-sub">主目标锁定京东采销 · 每一格进度都在为 2028 年 3 月的 JD YOUNG 投递蓄力</p>

      <div class="card target-card">
        <div class="target-head">
          <div>
            <div class="target-title">${C.target.title}</div>
            <div class="target-sub">${C.target.cohort} · ${C.target.salary}</div>
          </div>
          <div class="target-badge">主攻</div>
        </div>
        <p class="target-route"><b>路线：</b>${C.target.route}</p>
        <p class="target-why">${C.target.why}</p>
      </div>

      <h3>🧩 差异化定位</h3>
      <div class="grid-3">
        ${C.positioning.map(p => `
          <div class="card pos-card">
            <div class="pos-icon">${p.icon}</div>
            <div class="pos-title">${p.title}</div>
            <p>${p.desc}</p>
          </div>`).join('')}
      </div>

      <h3>⚔️ 五大差距 · 补齐清单 <span class="h3-tip">（勾选自动存进度）</span></h3>
      <div class="gap-list">
        ${C.gaps.map(g => {
      const total = g.steps.length;
      const done = g.steps.filter(s => state.checks[g.id + '::' + s.t]).length;
      const pct = Math.round(done / total * 100);
      return `
          <div class="card gap-card">
            <div class="gap-head" data-gap="${g.id}">
              <div class="gap-name">${g.name}<span class="gap-now">${g.now}</span></div>
              <div class="gap-meta">
                <div class="gap-bar"><div class="gap-bar-fill" style="width:${pct}%"></div></div>
                <span class="gap-pct">${done}/${total}</span>
                <span class="gap-arrow">▾</span>
              </div>
            </div>
            <div class="gap-body ${done ? '' : 'open'}" id="body-${g.id}">
              <p class="gap-action"><b>补齐动作：</b>${g.action}</p>
              <ul class="check-list">
                ${g.steps.map(s => {
        const k = g.id + '::' + s.t;
        return `<li><label class="ck"><input type="checkbox" data-ck="${k}" ${state.checks[k] ? 'checked' : ''}><span>${s.t}</span></label></li>`;
      }).join('')}
              </ul>
            </div>
          </div>`;
    }).join('')}
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>🔁 每周常量动作</h3>
          <ul class="dot-list">${C.weeklyLoop.map(x => `<li>${x}</li>`).join('')}</ul>
        </div>
        <div class="card">
          <h3>🚦 三轨并行</h3>
          ${D.about.tracks.map((t, i) => `
            <div class="track ${i === 0 ? 'main' : ''}">
              <div class="track-name">${t.name}</div>
              <p>${t.desc}</p>
            </div>`).join('')}
        </div>
      </div>

      <h3>🗺️ 里程碑时间线 · 2026 → 2029</h3>
      <div class="timeline">
        ${C.milestones.map((m, i) => `
          <div class="tl-item ${m.done ? 'done' : ''} ${i === C.milestones.findIndex(x => !x.done) ? 'current' : ''}">
            <div class="tl-dot"></div>
            <div class="tl-card">
              <div class="tl-period">${m.period}<span>${m.time}</span>${i === C.milestones.findIndex(x => !x.done) ? '<em class="tag now">当前阶段</em>' : ''}</div>
              <p>${m.goal}</p>
            </div>
          </div>`).join('')}
      </div>`;
  };

  /* ============================================================
   * 视图：课表
   * ============================================================ */
  VIEWS.schedule = function (root) {
    const wk = semesterWeek();
    const now = new Date();
    const dow = now.getDay();
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const bands = [...new Set(D.courses.map(c => c.start))].sort((a, b) => toMin(a) - toMin(b));
    const active = c => wk >= c.from && wk <= c.to;

    root.innerHTML = `
      <h2>📅 本学期课表</h2>
      <p class="page-sub">2026-2027-1 学期 · 现在是第 ${wk} 周（共 ${D.semester.totalWeeks} 周）· 灰色课程本周不上</p>
      <div class="card table-wrap">
        <div class="tt">
          <div class="tt-row tt-head">
            <div class="tt-time"></div>
            ${dayOrder.map(d => `<div class="tt-day ${d === dow ? 'is-today' : ''}">${D.dayNames[d]}${d === dow ? ' · 今' : ''}</div>`).join('')}
          </div>
          ${bands.map(t => `
            <div class="tt-row">
              <div class="tt-time">${t}</div>
              ${dayOrder.map(d => {
      const c = D.courses.find(x => x.day === d && x.start === t && active(x));
      const inactive = D.courses.find(x => x.day === d && x.start === t && !active(x));
      return `<div class="tt-cell ${d === dow ? 'is-today' : ''}">
                  ${c ? `<div class="tt-course" style="--hue:${(toMin(t) / 3) % 360}"><b>${c.name}</b><span>${c.loc || ''}</span></div>`
          : inactive ? `<div class="tt-course off"><b>${inactive.name}</b><span>${inactive.from}-${inactive.to}周</span></div>` : ''}
                </div>`;
    }).join('')}
            </div>`).join('')}
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>🕘 每天固定节奏</h3>
          <ul class="dot-list">
            <li>周一 / 周四晚：高数、线代作业优先清零</li>
            <li>每晚 21:00-22:00：求职常量时段（案例拆解 / 账号更新）</li>
            <li>周日晚：固定复盘 + 只写下周计划</li>
          </ul>
        </div>
        <div class="card">
          <h3>📝 备注</h3>
          <ul class="dot-list">
            <li>「形势与政策」第 6-9 周周六晚上课，别漏</li>
            <li>「职业发展与就业指导3」第 5-7 周周五上午</li>
            <li>教室以教务最新通知为准；调课在这里改 <code>js/data.js</code></li>
          </ul>
        </div>
      </div>`;
  };

  /* ============================================================
   * 视图：任务板
   * ============================================================ */
  function taskGroup(title, icon, items, opts = {}) {
    const done = items.filter(t => isChecked(t._key, opts.weekly)).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    return `
      <div class="card task-group">
        <div class="tg-head">
          <h3>${icon} ${title}</h3>
          <div class="tg-meta"><div class="gap-bar"><div class="gap-bar-fill" style="width:${pct}%"></div></div><span>${done}/${items.length}</span></div>
        </div>
        <ul class="check-list">
          ${items.map(t => `
            <li>
              <label class="ck">
                <input type="checkbox" data-ck="${t._key}" data-weekly="${opts.weekly ? 1 : ''}" ${isChecked(t._key, opts.weekly) ? 'checked' : ''}>
                <span>${t.t}</span>
              </label>
              ${t.due ? `<span class="mini-due ${daysUntil(t.due) < 0 ? 'over' : daysUntil(t.due) <= 7 ? 'soon' : ''}">${daysUntil(t.due) < 0 ? '逾期' : daysUntil(t.due) === 0 ? '今天' : daysUntil(t.due) + ' 天'}</span>` : ''}
              ${opts.deletable ? `<button class="del-task" data-del="${t.id}" title="删除">✕</button>` : ''}
            </li>`).join('')}
        </ul>
        ${opts.weekly ? '<p class="tg-note">每周一自动清零重新开始</p>' : ''}
      </div>`;
  }

  VIEWS.tasks = function (root) {
    const weekly = D.tasks.weekly.map(t => ({ ...t }));
    const sprint = D.tasks.sprint.map(t => ({ ...t, _key: t.id }));
    const term = D.tasks.term.map(t => ({ ...t, _key: t.id }));
    const custom = state.custom.map(t => ({ ...t, _key: 'c_' + t.id }));
    weekly.forEach(t => t._key = t.id);

    root.innerHTML = `
      <h2>✅ 任务板</h2>
      <p class="page-sub">勾选即时保存到本机浏览器 · 每周常量周一自动重置</p>
      <div class="task-cols">
        ${taskGroup('每周常量', '🔁', weekly, { weekly: true })}
        ${taskGroup('求职冲刺', '🚀', sprint)}
        ${taskGroup('本学期', '📚', term)}
      </div>
      <div class="card">
        <div class="tg-head"><h3>➕ 我的追加</h3></div>
        <form id="add-form" class="add-form">
          <input id="add-input" type="text" placeholder="想到什么要做的，直接丢进来…" maxlength="60" autocomplete="off">
          <button type="submit" class="btn">添加</button>
        </form>
        ${custom.length ? taskGroup('✍️ 追加列表', '', custom, { deletable: true }).replace('class="card task-group"', 'class="task-group inner"') : '<p class="muted">暂无追加任务</p>'}
      </div>`;
  };

  /* ============================================================
   * 视图：成果库
   * ============================================================ */
  VIEWS.achievements = function (root) {
    root.innerHTML = `
      <h2>🏆 成果库 · 简历素材</h2>
      <p class="page-sub">写简历 / 面试自我介绍时来这翻素材 · 竞赛与专利按个人实际角色表述</p>
      <div class="ach-grid">
        ${D.achievements.map(a => `
          <div class="card ach-card">
            <div class="ach-head">
              <span class="ach-icon">${a.icon}</span>
              <div><div class="ach-title">${a.title}</div><em class="tag">${a.tag}</em></div>
            </div>
            <ul class="dot-list">${a.points.map(p => `<li>${p}</li>`).join('')}</ul>
            <div class="resume-line"><b>简历一句话：</b>${a.resume}</div>
          </div>`).join('')}
      </div>`;
  };

  /* ============================================================
   * 视图：北辰实习
   * ============================================================ */
  VIEWS.beichen = function (root) {
    const B = D.beichen;
    root.innerHTML = `
      <h2>🌏 北辰青年 · 第四期线上实习</h2>
      <p class="page-sub">${B.intro}</p>
      <div class="grid-2">
        <div class="card">
          <h3>📌 第二周任务</h3>
          <ul class="check-list">
            ${B.tasks.map(t => {
      const k = 'bc::' + t.t;
      return `<li><label class="ck"><input type="checkbox" data-ck="${k}" ${state.checks[k] ? 'checked' : ''}><span><em class="tag">${t.type}</em> ${t.t}${t.due ? ` <span class="mini-due soon">${daysUntil(t.due) >= 0 ? '还剩 ' + daysUntil(t.due) + ' 天' : '已结束'}</span>` : ''}</span></label></li>`;
    }).join('')}
          </ul>
          <p class="tg-note">路演内容按项目组安排的各组路演汇报主题准备</p>
        </div>
        <div class="card">
          <h3>🏅 第一周成果</h3>
          <ul class="dot-list">${B.week1.map(x => `<li>${x}</li>`).join('')}</ul>
          <h3 style="margin-top:16px">🔗 相关链接</h3>
          <ul class="dot-list">${B.links.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.name} ↗</a></li>`).join('')}</ul>
        </div>
      </div>`;
  };

  /* ============================================================
   * 视图：关于我
   * ============================================================ */
  VIEWS.about = function (root) {
    const A = D.about;
    root.innerHTML = `
      <h2>🧭 关于我 · 使用说明</h2>
      <p class="page-sub">源自《AI 时代个人说明书》V1.1 与大五人格测评（2026.08）· 与人协作、与自己相处，都看这页</p>

      <h3>🔑 五个关键词</h3>
      <div class="grid-3">
        ${A.keywords.map(k => `
          <div class="card kw-card"><div class="kw-k">${k.k}</div><p>${k.v}</p></div>`).join('')}
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>📊 大五人格画像</h3>
          ${A.bigfive.map(b => `
            <div class="bf-row">
              <div class="bf-dim">${b.dim}<span>${b.score}</span></div>
              <div class="bf-bar"><div class="bf-fill ${b.neg ? 'warm' : ''}" style="width:${b.pct}%"></div></div>
              <div class="bf-tag">${b.tag}</div>
            </div>`).join('')}
        </div>
        <div class="card">
          <h3>💡 三项核心发现</h3>
          ${A.findings.map((f, i) => `<div class="finding"><b>${i + 1}. ${f.t}</b><p>${f.d}</p></div>`).join('')}
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>🤝 协作须知</h3>
          <ul class="dot-list">${A.collab.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
        <div class="card">
          <h3>🚦 职业三轨</h3>
          ${A.tracks.map((t, i) => `<div class="track ${i === 0 ? 'main' : ''}"><div class="track-name">${t.name}</div><p>${t.desc}</p></div>`).join('')}
        </div>
      </div>

      <p class="muted foot-note">完整版见 <code>D:\\ZCodeProject\\AI时代个人说明书\\</code> 与 <code>D:\\ZCodeProject\\职业规划咨询\\</code></p>`;
  };

  /* ============================================================
   * 事件绑定（委托：勾选、折叠、删除、添加）
   * ============================================================ */
  document.addEventListener('change', e => {
    const ck = e.target.closest('input[data-ck]');
    if (ck) {
      const weekly = !!ck.dataset.weekly;
      if (weekly) setCheck(ck.dataset.ck, true, ck.checked);
      else {
        if (ck.checked) state.checks[ck.dataset.ck] = 1; else delete state.checks[ck.dataset.ck];
        save();
      }
      renderActive();
    }
  });

  document.addEventListener('click', e => {
    const head = e.target.closest('.gap-head');
    if (head) {
      $('#body-' + head.dataset.gap)?.classList.toggle('open');
      return;
    }
    const del = e.target.closest('.del-task');
    if (del) {
      state.custom = state.custom.filter(t => t.id !== del.dataset.del);
      save(); renderActive();
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'add-form') return;
    e.preventDefault();
    const inp = $('#add-input');
    const v = inp.value.trim();
    if (!v) return;
    state.custom.push({ id: 'c' + Date.now(), t: v });
    save(); renderActive();
  });

  /* ---------- 主题 & 导航 ---------- */
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    $('#theme-btn').textContent = state.theme === 'dark' ? '🌙 深色' : '☀️ 浅色';
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#theme-btn')) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      save(); applyTheme();
    }
  });
  window.addEventListener('hashchange', renderActive);

  /* ---------- 启动 ---------- */
  function boot() {
    const nav = $('#nav');
    nav.innerHTML = [
      ['dashboard', '🏠', '总览'],
      ['career', '🎯', '求职作战室'],
      ['schedule', '📅', '课表'],
      ['tasks', '✅', '任务板'],
      ['achievements', '🏆', '成果库'],
      ['beichen', '🌏', '北辰实习'],
      ['about', '🧭', '关于我']
    ].map(([v, i, n]) => `<button class="nav-btn" data-view="${v}" onclick="location.hash='${v}'"><span class="nv-icon">${i}</span>${n}</button>`).join('');

    $('#brand-name').textContent = D.profile.alias + ' 的工作台';
    $('#brand-sub').textContent = `${D.profile.school} · 生物材料 · 大二`;
    $('#updated').textContent = '数据更新于 ' + D.updated;
    applyTheme();
    renderActive();

    // 每分钟刷新一次总览（课程状态/倒计时跨天）
    setInterval(() => { if ((location.hash || '#dashboard').slice(1) === 'dashboard') renderActive(); }, 60000);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
