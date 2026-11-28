// Réglages Remotion du montage TikTok (le rendu final est piloté par ../outils/rendre.mjs)
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// Le navigateur de Remotion ne peut pas être téléchargé ici (hôte bloqué) : on prend le Chrome du système,
// le même que pour les captures. Ailleurs, supprimer ces deux lignes laisse Remotion utiliser le sien.
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? "/usr/bin/google-chrome");
Config.setChromiumOpenGlRenderer("swiftshader");
