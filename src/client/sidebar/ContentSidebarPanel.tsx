import { useEffect, useRef, useState } from "react";
import {
  Button,
  IconBrowseOutline16,
  IconCloseFill14,
  IconProjectAddOutline16,
  IconRefreshOutline16,
  IconSearchOutline16,
  Input,
  Modal,
  Tooltip,
} from "@deepseek-ai/dsh-client-ui-primitives";

import type { ContentSummary, WorkflowStage } from "../../types.ts";
import { CoverThumb, coverThumbRevision } from "../CoverThumb.tsx";
import type { CreatorViewFace } from "../face.ts";
import { useLibraryEpoch, useSelectedContentId } from "../contentSelection.ts";
import type { CreatorKey } from "../locales.ts";
import { formatRelativeTime } from "../relativeTime.ts";
import { StatusPill, type StatusTone } from "../ui/StatusPill.tsx";
import "./ContentSidebarPanel.css";

export const WORKFLOW_TONE: Record<WorkflowStage, StatusTone> = {
  idle: "neutral",
  record: "pending",
  cut: "pending",
  finish: "pending",
  publish: "pending",
  live: "success",
};

function sortByRecency(items: ContentSummary[]): ContentSummary[] {
  return [...items].sort((a, b) => {
    if (a.recordedAt !== b.recordedAt) return b.recordedAt - a.recordedAt;
    return b.createdMs - a.createdMs;
  });
}

export function ContentSidebarPanel({
  t,
  ready,
  listContents,
  getCoverThumb,
  refreshCatalog,
  createContent,
}: CreatorViewFace & {
  t: (key: CreatorKey) => string;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRoot = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const libraryEpoch = useLibraryEpoch();
  const [selectedId, setSelectedId] = useSelectedContentId();
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | undefined>(undefined);

  const loadList = async (nextQuery = query) => {
    if (!ready()) {
      setError(t("empty.remote"));
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await listContents(nextQuery, "all");
      setItems(sortByRecency(result.items));
      const currentId = selectedIdRef.current;
      if (nextQuery === "" && currentId !== null && !result.items.some((item) => item.id === currentId)) {
        setSelectedId(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("empty.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadList(query);
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, [query, libraryEpoch]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInput.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) {
        return;
      }
      searchInput.current?.blur();
      if (query !== "") return;
      setSearchOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); };
  }, [searchOpen, query]);

  const closeSearch = (): void => {
    setQuery("");
    setSearchOpen(false);
  };

  const closeCreate = (): void => {
    if (creating) return;
    setCreateOpen(false);
    setCreateName("");
    setCreateError(undefined);
  };

  const onCreate = async () => {
    const title = createName.trim();
    if (title === "" || creating) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const created = await createContent(title);
      setCreateOpen(false);
      setCreateName("");
      await loadList(query);
      setSelectedId(created.id);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : t("create.failed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="contentPanel" data-surface="content-panel">
      <div className="contentHeader">
        <div className={searchOpen ? "searchSlot expanded" : "searchSlot"}>
          <div
            ref={searchRoot}
            className={searchOpen ? "contentSearch expanded" : "contentSearch"}
            onClick={() => {
              if (searchOpen) return;
              setSearchOpen(true);
            }}
          >
            <Tooltip label={t("toolbar.search")} delayMs={500} disabled={searchOpen}>
              <button
                type="button"
                className="searchButton"
                aria-label={t("toolbar.search.aria")}
                aria-expanded={searchOpen}
                onClick={() => { setSearchOpen(true); }}
              >
                <IconSearchOutline16 size={searchOpen ? 11 : 14} />
              </button>
            </Tooltip>
            <input
              ref={searchInput}
              className="searchInput"
              value={query}
              placeholder={t("toolbar.search")}
              tabIndex={searchOpen ? 0 : -1}
              onChange={(event) => { setQuery(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                closeSearch();
              }}
            />
            {searchOpen && (
              <button
                type="button"
                className="clearButton"
                aria-label={t("toolbar.search.clear")}
                onClick={(event) => {
                  event.stopPropagation();
                  closeSearch();
                }}
              >
                <IconCloseFill14 />
              </button>
            )}
          </div>
        </div>
        <div className={searchOpen ? "headerActions hidden" : "headerActions"}>
          <Tooltip label={t("toolbar.refresh")} delayMs={500}>
            <button
              type="button"
              className="iconButton"
              aria-label={t("toolbar.refresh")}
              onClick={() => {
                void refreshCatalog().then(() => loadList(query));
              }}
            >
              <IconRefreshOutline16 size={16} />
            </button>
          </Tooltip>
          <Tooltip label={t("toolbar.create")} delayMs={500}>
            <button
              type="button"
              className="iconButton"
              aria-label={t("toolbar.create.aria")}
              onClick={() => { setCreateOpen(true); }}
            >
              <IconProjectAddOutline16 size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={t("create.title")}
        closeLabel={t("create.cancel")}
        footer={(
          <>
            <Button variant="outline" disabled={creating} onClick={closeCreate}>
              {t("create.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={creating || createName.trim() === ""}
              onClick={() => { void onCreate(); }}
            >
              {t("create.confirm")}
            </Button>
          </>
        )}
      >
        <div data-plugin="jacky-creator" data-surface="create-dialog">
          <div className="createField">
            <label className="createLabel" htmlFor="oil-create-name">{t("create.name")}</label>
            <Input
              id="oil-create-name"
              className="createInput"
              value={createName}
              placeholder={t("create.name.placeholder")}
              autoFocus={true}
              disabled={creating}
              onChange={(event) => { setCreateName(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void onCreate();
              }}
            />
          </div>
          {createError !== undefined && <div className="createError">{createError}</div>}
        </div>
      </Modal>
      <div className="contentList">
        {error !== undefined && <div className="contentEmpty">{error}</div>}
        {error === undefined && items.length === 0 && !loading && (
          <div className="contentEmpty">{t("empty.library")}</div>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === selectedId ? "contentRow selected" : "contentRow"}
            onClick={() => {
              setSelectedId(item.id === selectedId ? null : item.id);
            }}
          >
            <span className="rowCover">
              <CoverThumb
                id={item.id}
                load={getCoverThumb}
                revision={coverThumbRevision(item.covers)}
                fallback={<IconBrowseOutline16 className="coverFallback" size={20} />}
              />
            </span>
            <span className="rowBody">
              <span className="rowTitle">{item.title}</span>
              <span className="rowMeta">
                <StatusPill tone={WORKFLOW_TONE[item.workflow]}>
                  {t(`inspector.stage.${item.workflow}` as CreatorKey)}
                </StatusPill>
                <span className="rowDate">{formatRelativeTime(item.recordedAt, Date.now(), t)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
