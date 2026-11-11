"use client";

// SECTION: Erreur dans le layout racine (dernier filet de sécurité, sans styles de l'app).

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui", padding: 32 }}>
        <h1>Etcetera Audio Lab n&apos;a pas pu s&apos;afficher</h1>
        <p>{error.message}</p>
        <button type="button" onClick={reset}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
