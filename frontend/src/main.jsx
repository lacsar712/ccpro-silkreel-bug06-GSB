import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { api, clearToken, setToken, token } from "./api.js";
import "./app.css";

const STATUS_LABEL = { soaking: "浸茧", reeling: "缫丝中", reeled: "已缫完" };

function Login({ onOk }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(data.access_token);
      onOk();
    } catch (ex) {
      setErr(ex.message);
    }
  }
  return (
    <div class="login">
      <h1>江口缫丝坞</h1>
      <p>汤温环盆作业台，不是列表台账。</p>
      <form onSubmit={submit} autocomplete="off">
        <label>
          用户名
          <input name="username" autocomplete="off" value={username} onInput={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          密码
          <input name="password" type="password" autocomplete="off" value={password} onInput={(e) => setPassword(e.target.value)} />
        </label>
        <p class="hint">已预填 admin / 123456，另有 worker / 123456</p>
        <button type="submit">登录</button>
      </form>
      {err && <p class="err">{err}</p>}
    </div>
  );
}

function Yard() {
  const [board, setBoard] = useState(null);
  const [picked, setPicked] = useState(null);
  const [temp, setTemp] = useState("40");
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [litIds, setLitIds] = useState([]);
  const [hitCount, setHitCount] = useState(0);
  const [codeEdit, setCodeEdit] = useState("");

  async function refresh() {
    const data = await api("/api/board");
    setBoard(data);
    if (picked) {
      setPicked(data.basins.find((b) => b.id === picked.id) || data.basins[0]);
    }
    return data;
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  if (!board) {
    return (
      <div class="yard">
        {err || "装载环盆…"}
      </div>
    );
  }

  const n = board.basins.length;
  async function writeTemp() {
    setErr("");
    try {
      const row = await api(`/api/basins/${picked.id}/readings`, {
        method: "POST",
        body: JSON.stringify({ waterTempC: Number(temp) }),
      });
      await refresh();
      setPicked(row);
    } catch (ex) {
      setErr(ex.message);
    }
  }
  async function setStatus(status) {
    setErr("");
    try {
      const row = await api(`/api/basins/${picked.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await refresh();
      setPicked(row);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function runSearch() {
    setErr("");
    try {
      const q = query.trim();
      const data = await api(`/api/basins/search?q=${encodeURIComponent(q)}`);
      // 点亮与底部命中数同源：都以服务器的精确匹配结果为准，
      // 每次查找整体替换，清掉关键字再搜即全部熄灭、命中归零。
      setLitIds(data.ids);
      setHitCount(data.hitCount);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function saveCode() {
    setErr("");
    try {
      const row = await api(`/api/basins/${picked.id}/code`, {
        method: "POST",
        body: JSON.stringify({ code: codeEdit, expectedCode: picked.code }),
      });
      await refresh();
      setPicked(row);
      // 盆码已变：按当前关键字重查，点亮与底部命中立即与新库对齐
      // （旧码此时精确查找必为 0）。
      await runSearch();
    } catch (ex) {
      // 409：盆码刚被他人改走，刷新到最新盆码，本版不覆盖
      const latestBoard = await refresh().catch(() => null);
      if (latestBoard) {
        const latest = latestBoard.basins.find((b) => b.id === picked.id);
        if (latest) {
          setPicked(latest);
          setCodeEdit(latest.code);
        }
      }
      setErr(ex.message);
    }
  }

  return (
    <div class="yard">
      <div class="topbar">
        <div>
          <h1>{board.filature}</h1>
          <p>{board.riverside} · 点盆登记汤温；已缫完须最近汤温 38～42℃</p>
        </div>
        <button
          onClick={() => {
            clearToken();
            location.reload();
          }}
        >
          退出
        </button>
      </div>
      <div class="search-bar">
        <input
          value={query}
          placeholder="精确查找盆码"
          onInput={(e) => setQuery(e.target.value)}
        />
        <button type="button" onClick={runSearch}>
          查找
        </button>
        <span class="hit-count">底部命中：{hitCount}</span>
      </div>
      <div class="ring">
        {board.basins.map((b, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const left = 50 + Math.cos(angle) * 38;
          const top = 50 + Math.sin(angle) * 38;
          const lit = litIds.includes(b.id);
          return (
            <button
              key={b.id}
              class={`basin ${b.status}${lit ? " is-lit" : ""}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              onClick={() => {
                setPicked(b);
                setCodeEdit(b.code);
              }}
            >
              <strong>{b.code}</strong>
              <span>{STATUS_LABEL[b.status]}</span>
            </button>
          );
        })}
      </div>
      {picked && (
        <div class="drawer">
          <h3>
            {picked.code} · {STATUS_LABEL[picked.status]}
          </h3>
          <p>最近汤温：{picked.latestTempC ?? "无"} ℃ · 记录 {picked.readingCount} 次</p>
          <input value={temp} onInput={(e) => setTemp(e.target.value)} />
          <button onClick={writeTemp}>登记汤温</button>
          <div class="code-edit">
            <input value={codeEdit} onInput={(e) => setCodeEdit(e.target.value)} />
            <button type="button" onClick={saveCode}>
              改盆码
            </button>
          </div>
          <div>
            <button onClick={() => setStatus("soaking")}>浸茧</button>
            <button onClick={() => setStatus("reeling")}>缫丝中</button>
            <button onClick={() => setStatus("reeled")}>已缫完</button>
          </div>
          {err && <p class="err">{err}</p>}
        </div>
      )}
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(Boolean(token()));
  return ready ? <Yard /> : <Login onOk={() => setReady(true)} />;
}

render(<App />, document.getElementById("app"));
