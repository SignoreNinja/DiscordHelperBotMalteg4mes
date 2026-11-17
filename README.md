# DiscordHelperBotMalteg4mes

Dieser Starter enthält:

- Willkommensnachrichten bei Serverbeitritt
- `/ban`, `/timeout` und `/warn` für Moderationsteams
- Filter für Begriffe oder Domains mit `delete`, `timeout` oder bewusst explizit `ban`
- Moderationsprotokoll in einem separaten Kanal

## Einmalig in Discord einrichten

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications) und wähle **New Application**.
2. Unter **Bot**: Bot erstellen und den Token zurücksetzen/kopieren. Der Token ist ein Passwort: nie posten, nie in Git einchecken.
3. Unter **Bot > Privileged Gateway Intents** aktiviere **Server Members Intent** (Begrüßung) und **Message Content Intent** (Textfilter).
4. Unter **OAuth2 > URL Generator** wähle die Scopes `bot` und `applications.commands`; bei Bot Permissions mindestens `View Channels`, `Send Messages`, `Manage Messages`, `Moderate Members`, `Ban Members` und `Embed Links`. Öffne die erzeugte URL und füge den Bot deinem Server hinzu.
5. Stelle die Bot-Rolle in der Server-Rollenliste über die Rollen, die er moderieren soll. Er kann niemals den Serverinhaber oder gleich-/höhergestellte Rollen moderieren.

## Lokal starten

Voraussetzung: aktuelle Node.js-LTS-Version.

```powershell
Copy-Item .env.example .env
# .env öffnen und Token, IDs sowie Regeln eintragen
npm install
npm run register
npm start
```

Für Kanal- und Server-IDs: Discord-Einstellungen > Erweitert > **Entwicklermodus** aktivieren, dann per Rechtsklick **ID kopieren**.

`npm run register` registriert die Befehle nur in deinem Testserver; dadurch erscheinen Änderungen sofort. Teste dort zuerst mit einem zweiten Testkonto.

## Hosting

Der Bot muss dauerhaft laufen. Für den Anfang eignen sich ein kleiner VPS oder ein Node-kompatibler Host mit dauerhaftem Prozess. Dort hinterlegst du dieselben Umgebungsvariablen wie in `.env` als geheime Variablen und startest `npm start`. Einen Bot-Token niemals in den Code oder einen öffentlichen Screenshot schreiben.

## Wichtige Einstellung

Der Filter löscht standardmäßig und führt nur die Aktion aus, die in `FILTER_ACTION` steht. Für einen automatischen permanenten Bann muss dort ausdrücklich `ban` stehen. Ein Timeout ist für Fehlalarme in der Regel die bessere Startregel.

Aktuelle Discord-Hinweise: Für Begrüßungen und das Lesen von Nachrichten werden privilegierte Intents benötigt; diese müssen im Developer Portal gezielt aktiviert werden. Bei kleineren Apps lassen sie sich dort aktivieren, ab 10.000 erreichbaren Nutzern ist eine Überprüfung erforderlich. Siehe [Discord: Privileged Intents](https://support-dev.discord.com/hc/de/articles/6207308062871-Was-sind-Privileged-Intents) und [Application Commands](https://docs.discord.com/developers/docs/interactions/slash-commands).
