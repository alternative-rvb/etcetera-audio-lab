import { Fragment } from "react";

// ANCHOR: affiche un hint serveur en transformant les passages `entre backticks` en code (commandes à lancer).
export function HintText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="rounded bg-[color-mix(in_srgb,currentColor_12%,transparent)] px-1 py-px font-mono text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

/** Version texte brut (toasts) : les backticks sont simplement retirés. */
export function hintToPlainText(text: string | undefined): string | undefined {
  return text?.replace(/`/g, "");
}
