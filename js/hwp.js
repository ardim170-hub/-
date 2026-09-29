/* 한글(.hwp 5.x) 파일에서 표만 읽어 오는 최소 리더.
 * 복합 문서(CFB) → BodyText/SectionN 스트림 → 압축 해제 → 표·칸·문단 레코드를 따라 칸별 글자를 모은다. */
window.HWP = (() => {
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const ENDOFCHAIN = 0xFFFFFFFE;

  /** 복합 문서에서 스트림 경로 → 바이트 */
  function cfb(buf) {
    const b = new Uint8Array(buf);
    if (u32(b, 0) !== 0xE011CFD0 || u32(b, 4) !== 0xE11AB1A1) throw new Error('한글(.hwp) 파일이 아닙니다. 한글 2002 이후의 .hwp 파일만 읽을 수 있습니다 (.hwpx는 한글에서 .hwp로 다시 저장하세요).');
    const ss = 1 << u16(b, 0x1E), mss = 1 << u16(b, 0x20);
    const sec = n => 512 + n * ss;
    const difat = [];
    for (let i = 0; i < 109; i++) difat.push(u32(b, 0x4C + i * 4));
    for (let d = u32(b, 0x44), n = u32(b, 0x48); n-- > 0 && d < ENDOFCHAIN;) {
      for (let i = 0; i < ss / 4 - 1; i++) difat.push(u32(b, sec(d) + i * 4));
      d = u32(b, sec(d) + ss - 4);
    }
    const fat = [];
    difat.filter(x => x < ENDOFCHAIN).forEach(s => { for (let i = 0; i < ss / 4; i++) fat.push(u32(b, sec(s) + i * 4)); });
    const chain = (start, table) => { const out = []; for (let s = start, guard = 0; s < ENDOFCHAIN && guard < 1e6; s = table[s], guard++) out.push(s); return out; };
    const readBig = (start, size) => { const out = new Uint8Array(size); let o = 0; for (const s of chain(start, fat)) { const n = Math.min(ss, size - o); if (n <= 0) break; out.set(b.subarray(sec(s), sec(s) + n), o); o += n; } return out; };
    const dirBytes = readBig(u32(b, 0x30), chain(u32(b, 0x30), fat).length * ss);
    const dir = [];
    for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
      const nl = u16(dirBytes, o + 64);
      let name = '';
      for (let i = 0; i < Math.max(0, nl - 2); i += 2) name += String.fromCharCode(u16(dirBytes, o + i));
      dir.push({ name, type: dirBytes[o + 66], left: u32(dirBytes, o + 68), right: u32(dirBytes, o + 72), child: u32(dirBytes, o + 76), start: u32(dirBytes, o + 116), size: u32(dirBytes, o + 120) });
    }
    const root = dir[0];
    const miniStream = readBig(root.start, root.size);
    const minifat = [];
    chain(u32(b, 0x3C), fat).forEach(s => { for (let i = 0; i < ss / 4; i++) minifat.push(u32(b, sec(s) + i * 4)); });
    const cutoff = u32(b, 0x38);
    const read = e => {
      if (e.size >= cutoff) return readBig(e.start, e.size);
      const out = new Uint8Array(e.size); let o = 0;
      for (const s of chain(e.start, minifat)) { const n = Math.min(mss, e.size - o); if (n <= 0) break; out.set(miniStream.subarray(s * mss, s * mss + n), o); o += n; }
      return out;
    };
    const children = id => { const out = []; const walk = i => { if (i >= dir.length || i >= 0xFFFFFFFA) return; const e = dir[i]; walk(e.left); out.push(e); walk(e.right); }; walk(id); return out; };
    return {
      get(path) {
        let list = children(root.child), e;
        for (const part of path.split('/')) { e = list.find(x => x.name === part); if (!e) return null; list = children(e.child); }
        return e && e.type === 2 ? read(e) : null;
      },
      list(storage) { const s = children(root.child).find(x => x.name === storage); return s ? children(s.child).map(x => x.name) : []; },
    };
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 한글 파일 읽기를 지원하지 않습니다. 최신 크롬에서 열어 주세요.');
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});
    // 한글 파일은 압축 데이터 뒤에 여분 바이트가 붙는 경우가 있어, 끝에서 나는 오류는 무시하고 풀린 만큼 쓴다
    const reader = ds.readable.getReader(), parts = [];
    let len = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); len += value.length; } }
    catch (err) { if (!len) throw new Error('한글 파일 압축을 풀지 못했습니다.'); }
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }

  /** 문단 글자 레코드 → 문자열 (조판 부호는 건너뜀) */
  function paraText(b, o, size) {
    let t = '';
    for (let j = 0; j + 1 < size;) {
      const c = u16(b, o + j);
      if (c < 32) { j += [0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31].includes(c) ? 2 : 16; continue; }
      t += String.fromCharCode(c); j += 2;
    }
    return t;
  }

  /** 섹션 레코드에서 표를 뽑는다: [{ rows: [[칸 글자...]...] }] */
  function tables(b) {
    const out = [];
    let tbl = null, cell = null, cellLevel = -1;
    for (let i = 0; i + 4 <= b.length;) {
      const h = u32(b, i); i += 4;
      const tag = h & 0x3FF, level = (h >> 10) & 0x3FF;
      let size = (h >>> 20) & 0xFFF;
      if (size === 0xFFF) { size = u32(b, i); i += 4; }
      if (cell && level < cellLevel) cell = null; // 칸 밖으로 나옴
      if (tag === 77) { tbl = { rows: [], spans: [] }; out.push(tbl); cell = null; }
      else if (tag === 72 && tbl && size >= 16) {
        const col = u16(b, i + 8), row = u16(b, i + 10);
        (tbl.rows[row] = tbl.rows[row] || [])[col] = '';
        (tbl.spans[row] = tbl.spans[row] || [])[col] = u16(b, i + 12) || 1;
        cell = { row, col }; cellLevel = level;
      } else if (tag === 67 && cell) {
        const t = paraText(b, i, size).trim();
        if (t) { const r = tbl.rows[cell.row]; r[cell.col] = r[cell.col] ? r[cell.col] + '\n' + t : t; }
      }
      i += size;
    }
    out.forEach(t => { t.rows = Array.from(t.rows, r => Array.from(r || [], c => (c || '').normalize('NFKC'))); t.spans = Array.from(t.spans, r => Array.from(r || [], x => x || 1)); });
    return out;
  }

  /** .hwp 파일(ArrayBuffer) → 표 목록 */
  async function readTables(buf) {
    const doc = cfb(buf);
    const head = doc.get('FileHeader');
    if (!head) throw new Error('한글 문서 머리 정보를 찾지 못했습니다.');
    const flags = u32(head, 36);
    if (flags & 2) throw new Error('암호가 걸린 한글 파일은 읽을 수 없습니다.');
    if (flags & 4) throw new Error('배포용 한글 문서는 읽을 수 없습니다.');
    const names = doc.list('BodyText').filter(n => /^Section\d+$/.test(n)).sort((a, b) => a.slice(7) - b.slice(7));
    const all = [];
    for (const n of names) {
      let data = doc.get('BodyText/' + n);
      if (flags & 1) data = await inflateRaw(data);
      all.push(...tables(data));
    }
    return all;
  }

  return { readTables };
})();
