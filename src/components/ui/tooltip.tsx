"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

// SECTION: Infobulle accessible (survol après un court délai, focus clavier immédiat, Échap pour fermer).
// NOTE: rendue en portail et en position fixe pour ne jamais être coupée par un conteneur qui défile.

const HOVER_DELAY_MS = 300;
const VIEWPORT_MARGIN = 8;
const OFFSET = 6;

type TriggerProps = {
  ref?: Ref<HTMLElement>;
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  "aria-describedby"?: string;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export function Tooltip({
  label,
  children,
  describe = false,
}: {
  label: ReactNode;
  /** Élément déclencheur (bouton, lien...), qui reçoit les gestionnaires et la ref. */
  children: ReactElement<TriggerProps>;
  /** Vrai quand l'infobulle complète l'intitulé accessible (aria-describedby) ; faux quand elle le répète. */
  describe?: boolean;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
    setPosition(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && hide();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ANCHOR: placement au-dessus du déclencheur, ou en dessous faute de place, puis recadrage horizontal dans la fenêtre.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !bubbleRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current.getBoundingClientRect();
    const below = trigger.top - bubble.height - OFFSET < VIEWPORT_MARGIN;
    const half = bubble.width / 2;
    const center = Math.min(Math.max(trigger.left + trigger.width / 2, VIEWPORT_MARGIN + half), window.innerWidth - VIEWPORT_MARGIN - half);
    setPosition({ left: center - half, top: below ? trigger.bottom + OFFSET : trigger.top - bubble.height - OFFSET, below });
  }, [open]);

  const childProps = children.props;
  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      assignRef(childProps.ref, node);
    },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      childProps.onPointerEnter?.(event);
      if (event.pointerType === "touch") return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      childProps.onPointerLeave?.(event);
      hide();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(event);
      if (event.currentTarget.matches(":focus-visible")) setOpen(true);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(event);
      hide();
    },
    ...(describe ? { "aria-describedby": open ? id : undefined } : {}),
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            aria-hidden={!describe}
            style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
            className="pointer-events-none fixed z-50 max-w-64 rounded-md bg-ink px-2 py-1 text-xs leading-snug text-bg shadow-lg retro:border retro:border-accent retro:bg-surface retro:text-accent"
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}
