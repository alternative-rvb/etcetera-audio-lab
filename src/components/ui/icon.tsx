import { Icon as IconifyIcon } from "@iconify/react/offline";
import audioFile from "@iconify-icons/material-symbols/audio-file-outline-rounded";
import check from "@iconify-icons/material-symbols/check-rounded";
import chevronRight from "@iconify-icons/material-symbols/chevron-right-rounded";
import cloud from "@iconify-icons/material-symbols/cloud-outline-rounded";
import close from "@iconify-icons/material-symbols/close-rounded";
import contentCopy from "@iconify-icons/material-symbols/content-copy-outline-rounded";
import darkMode from "@iconify-icons/material-symbols/dark-mode-outline-rounded";
import deleteOutline from "@iconify-icons/material-symbols/delete-outline-rounded";
import download from "@iconify-icons/material-symbols/download-rounded";
import editNote from "@iconify-icons/material-symbols/edit-note-rounded";
import expandMore from "@iconify-icons/material-symbols/expand-more-rounded";
import favorite from "@iconify-icons/material-symbols/favorite-rounded";
import favoriteOutline from "@iconify-icons/material-symbols/favorite-outline-rounded";
import female from "@iconify-icons/material-symbols/female-rounded";
import graphicEq from "@iconify-icons/material-symbols/graphic-eq-rounded";
import history from "@iconify-icons/material-symbols/history-rounded";
import info from "@iconify-icons/material-symbols/info-outline-rounded";
import language from "@iconify-icons/material-symbols/language-rounded";
import libraryMusic from "@iconify-icons/material-symbols/library-music-outline-rounded";
import lightMode from "@iconify-icons/material-symbols/light-mode-outline-rounded";
import male from "@iconify-icons/material-symbols/male-rounded";
import memory from "@iconify-icons/material-symbols/memory-rounded";
import mic from "@iconify-icons/material-symbols/mic-rounded";
import openInNew from "@iconify-icons/material-symbols/open-in-new-rounded";
import pause from "@iconify-icons/material-symbols/pause-rounded";
import playArrow from "@iconify-icons/material-symbols/play-arrow-rounded";
import receiptLong from "@iconify-icons/material-symbols/receipt-long-outline-rounded";
import refresh from "@iconify-icons/material-symbols/refresh-rounded";
import restartAlt from "@iconify-icons/material-symbols/restart-alt-rounded";
import search from "@iconify-icons/material-symbols/search-rounded";
import speechToText from "@iconify-icons/material-symbols/speech-to-text-rounded";
import speed from "@iconify-icons/material-symbols/speed-rounded";
import star from "@iconify-icons/material-symbols/star-rounded";
import starOutline from "@iconify-icons/material-symbols/star-outline-rounded";
import stop from "@iconify-icons/material-symbols/stop-rounded";
import terminal from "@iconify-icons/material-symbols/terminal-rounded";
import textToSpeech from "@iconify-icons/material-symbols/text-to-speech-rounded";
import translate from "@iconify-icons/material-symbols/translate-rounded";
import tune from "@iconify-icons/material-symbols/tune-rounded";
import unfoldLess from "@iconify-icons/material-symbols/unfold-less-rounded";
import unfoldMore from "@iconify-icons/material-symbols/unfold-more-rounded";
import uploadFile from "@iconify-icons/material-symbols/upload-file-outline-rounded";
import verticalAlignBottom from "@iconify-icons/material-symbols/vertical-align-bottom-rounded";
import voiceSelection from "@iconify-icons/material-symbols/voice-selection-rounded";
import warning from "@iconify-icons/material-symbols/warning-outline-rounded";
import { cn } from "@/lib/client/cn";

// SECTION: Icônes Material Symbols Rounded (Google, Apache 2.0), importées une par une en SVG.
// NOTE: registre unique nom métier → icône, pour qu'une même action garde la même icône partout.
// ANCHOR: une icône seulement pour une action, une source audio, un état ou la navigation, jamais dans un titre.

const ICONS = {
  brand: graphicEq,
  tts: textToSpeech,
  stt: speechToText,
  logs: receiptLong,
  voice: voiceSelection,
  play: playArrow,
  pause,
  stop,
  mic,
  upload: uploadFile,
  demo: libraryMusic,
  audioFile,
  speed,
  female,
  male,
  multilingual: translate,
  runtimeCloud: cloud,
  runtimeLocal: memory,
  runtimeBrowser: language,
  download,
  copy: contentCopy,
  check,
  close,
  favorite,
  favoriteOutline,
  star,
  starOutline,
  reuse: editNote,
  delete: deleteOutline,
  tune,
  reset: restartAlt,
  refresh,
  info,
  warning,
  history,
  expand: expandMore,
  chevronRight,
  unfoldMore,
  unfoldLess,
  lightMode,
  darkMode,
  retro: terminal,
  openInNew,
  search,
  scrollBottom: verticalAlignBottom,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <IconifyIcon icon={ICONS[name]} width={size} height={size} aria-hidden className={cn("shrink-0", className)} />;
}
