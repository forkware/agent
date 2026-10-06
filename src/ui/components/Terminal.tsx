import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { attach, send } from "../api.ts";

/** The terminal of one agent session. Stays mounted while hidden, so switching tabs is instant. */
export function Terminal({ sessionId, visible }: { sessionId: string; visible: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const fit = useRef<() => void>(() => {});
  const focus = useRef<() => void>(() => {});

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const term = new XTerm({
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
      theme: {
        background: v("--bg"),
        foreground: v("--text"),
        cursor: v("--accent"),
        cursorAccent: v("--bg"),
        selectionBackground: `${v("--accent")}55`,
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon((_, uri) => window.open(uri, "_blank")));
    term.open(host.current!);

    focus.current = () => term.focus();
    fit.current = () => {
      fitAddon.fit();
      send({ t: "resize", id: sessionId, cols: term.cols, rows: term.rows });
    };
    const detach = attach(sessionId, (msg) => {
      if (msg.t === "pty-reset") term.reset();
      term.write(msg.data);
    });
    const input = term.onData((data) => send({ t: "input", id: sessionId, data }));
    const observer = new ResizeObserver(() => fit.current());
    observer.observe(host.current!);
    fit.current();

    return () => {
      observer.disconnect();
      input.dispose();
      detach();
      term.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => {
      fit.current();
      focus.current();
    });
  }, [visible]);

  return <div ref={host} className="absolute inset-0" style={{ visibility: visible ? "visible" : "hidden" }} />;
}
