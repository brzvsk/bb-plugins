import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { COARSE_POINTER_ICON_SIZE_CLASS } from "@/components/ui/coarse-pointer-sizing";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PROJECT_LIST_ACTION_BUTTON_CLASS,
  SIDEBAR_CONTROL_PRIMARY_BUTTON_CLASS,
} from "@/components/ui/sidebar-row-classes";
import { sidebarThreadLifecyclesAtom } from "../preferences/atoms.js";
import { threadSearchQueryAtom } from "./thread-search.js";

const INCLUDE_ARCHIVED_LABEL = "Include archived";

function IncludeArchivedToggle() {
  const [lifecycles, setLifecycles] = useAtom(sidebarThreadLifecyclesAtom);
  const included = lifecycles.includes("archived");
  return (
    <Tooltip delayDuration={350} disableHoverableContent>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={INCLUDE_ARCHIVED_LABEL}
          aria-pressed={included}
          data-state={included ? "on" : "off"}
          className={cn(
            SIDEBAR_CONTROL_PRIMARY_BUTTON_CLASS,
            included &&
              "bg-state-active text-sidebar-foreground hover:text-sidebar-foreground",
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            setLifecycles(included ? ["active"] : ["active", "archived"])
          }
        >
          <Icon name="Archive" className={COARSE_POINTER_ICON_SIZE_CLASS} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {included ? "Archived threads shown" : INCLUDE_ARCHIVED_LABEL}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A "Search" row under bb's New thread button. Clicking it swaps the row for
 * an input that filters the list below by title; Escape or clearing it while
 * unfocused swaps the row back.
 */
export function ThreadSearchBar() {
  const [query, setQuery] = useAtom(threadSearchQueryAtom);
  const [isEditing, setIsEditing] = useState(query !== "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const close = () => {
    setQuery("");
    setIsEditing(false);
  };

  return (
    <div data-thread-search="" className="flex w-full min-w-0 items-center gap-0.5 pb-1">
      {isEditing ? (
        <label
          className={cn(
            PROJECT_LIST_ACTION_BUTTON_CLASS,
            "flex-1 cursor-text bg-sidebar-accent hover:bg-sidebar-accent",
          )}
        >
          <Icon
            name="Search"
            aria-hidden="true"
            className="size-4 shrink-0 text-subtle-foreground"
          />
          <input
            ref={inputRef}
            type="search"
            aria-label="Search threads by title"
            placeholder="Search threads"
            value={query}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-sidebar-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
            onBlur={() => {
              if (query.trim() === "") close();
            }}
          />
          {query !== "" ? (
            <button
              type="button"
              aria-label="Clear search"
              className="mr-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-subtle-foreground hover:text-muted-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <Icon name="X" aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </label>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(PROJECT_LIST_ACTION_BUTTON_CLASS, "w-auto flex-1")}
          onClick={() => setIsEditing(true)}
        >
          <Icon name="Search" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">Search</span>
        </Button>
      )}
      <IncludeArchivedToggle />
    </div>
  );
}
