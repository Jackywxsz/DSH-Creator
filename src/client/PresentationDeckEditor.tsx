import { useEffect, useState } from "react";

import type { ContentDetail, PresentationDeck, PresentationPage } from "../types.ts";

export function PresentationDeckEditor({
  detail,
  getDeck,
  saveDeck,
  onSaved,
}: {
  detail: ContentDetail;
  getDeck: (id: string) => Promise<PresentationDeck>;
  saveDeck: (id: string, deck: PresentationDeck) => Promise<ContentDetail>;
  onSaved: (detail: ContentDetail) => void;
}) {
  const [deck, setDeck] = useState<PresentationDeck | undefined>(undefined);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(undefined);
    void getDeck(detail.id).then((next) => {
      if (!live) return;
      setDeck(next);
      setActive(0);
      setDirty(false);
    }, (cause: unknown) => {
      if (!live) return;
      setError(cause instanceof Error ? cause.message : "加载失败");
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, [detail.id, detail.presentations["16x9"]]);

  const page = deck?.pages[active];

  const update = (patch: Partial<PresentationPage>): void => {
    if (deck === undefined || page === undefined) return;
    const pages = deck.pages.map((item, index) => index === active ? { ...item, ...patch } : item);
    setDeck({ ...deck, pages });
    setDirty(true);
  };

  const addPage = (): void => {
    if (deck === undefined) return;
    const next: PresentationPage = {
      id: `p${Date.now()}`,
      title: "新页面",
      body: "",
      notes: "",
    };
    const pages = [...deck.pages, next];
    setDeck({ ...deck, pages });
    setActive(pages.length - 1);
    setDirty(true);
  };

  const removePage = (index: number): void => {
    if (deck === undefined || deck.pages.length <= 1) return;
    const pages = deck.pages.filter((_, itemIndex) => itemIndex !== index);
    setDeck({ ...deck, pages });
    setActive(Math.max(0, Math.min(active, pages.length - 1)));
    setDirty(true);
  };

  const movePage = (index: number, delta: number): void => {
    if (deck === undefined) return;
    const target = index + delta;
    if (target < 0 || target >= deck.pages.length) return;
    const pages = [...deck.pages];
    const [item] = pages.splice(index, 1);
    if (item === undefined) return;
    pages.splice(target, 0, item);
    setDeck({ ...deck, pages });
    setActive(target);
    setDirty(true);
  };

  const save = (): void => {
    if (deck === undefined || saving) return;
    setSaving(true);
    setError(undefined);
    void saveDeck(detail.id, deck).then((next) => {
      onSaved(next);
      setDirty(false);
    }, (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }).finally(() => setSaving(false));
  };

  if (loading && deck === undefined) {
    return <div className="deckEditor deckLoading">加载页面…</div>;
  }
  if (deck === undefined) {
    return <div className="deckEditor deckLoading">{error ?? "没有页面数据"}</div>;
  }

  return (
    <section className="deckEditor">
      <div className="deckHeader">
        <div>
          <strong>页面编辑</strong>
          <span>{deck.pages.length} 页 · {dirty ? "未保存" : "已保存"}</span>
        </div>
        <div className="deckHeaderActions">
          <button type="button" onClick={addPage}>新增页</button>
          <button type="button" className="primary" disabled={saving || !dirty} onClick={save}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
      {error !== undefined && <div className="deckError">{error}</div>}
      <div className="deckBody">
        <div className="deckList">
          {deck.pages.map((item, index) => (
            <div key={item.id} className={index === active ? "deckListItem active" : "deckListItem"}>
              <button type="button" className="deckPick" onClick={() => setActive(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{item.title.trim() === "" ? "未命名" : item.title}</b>
              </button>
              <div className="deckItemActions">
                <button type="button" aria-label="上移" onClick={() => movePage(index, -1)}>↑</button>
                <button type="button" aria-label="下移" onClick={() => movePage(index, 1)}>↓</button>
                <button type="button" aria-label="删除" className="danger" onClick={() => removePage(index)}>×</button>
              </div>
            </div>
          ))}
        </div>
        {page !== undefined && (
          <div className="deckFields">
            <label>
              <span>标题</span>
              <input value={page.title} onChange={(event) => update({ title: event.target.value })} />
            </label>
            <label>
              <span>正文</span>
              <textarea rows={7} value={page.body} onChange={(event) => update({ body: event.target.value })} />
            </label>
            <label>
              <span>备注（不显示在画面）</span>
              <textarea rows={2} value={page.notes} onChange={(event) => update({ notes: event.target.value })} />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
